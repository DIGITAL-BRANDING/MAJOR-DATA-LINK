import { Resend } from 'resend';
import { env } from '../config/env.js';

/**
 * All outgoing email goes through Resend. The sender is RESEND_FROM_EMAIL
 * (default "K-TECH SOLUTIONS COMPANY <support@k-tech.com.ng>"); that domain
 * must be verified in the Resend dashboard or Resend refuses every send.
 * Every message carries both an html and a plain-text body.
 */

export type SendResult = { sent: boolean; error?: string; delivered?: number; failed?: number };
export type EmailAttachment = { filename: string; content: Buffer; contentType: string };
export type EmailMessage = { subject: string; text: string; html: string; attachments?: EmailAttachment[] };

const BRAND = 'K-TECH SOLUTIONS';
const BATCH_SIZE = 100; // Resend's per-call maximum for batch.send
// Resend allows ~2 API requests a second per team; stay under it when sending in bulk.
const BULK_PAUSE_MS = 600;
// Errors that will repeat for every recipient - no point trying the remaining batches.
const FATAL_ERRORS = new Set(['missing_api_key', 'invalid_api_key', 'restricted_api_key', 'invalid_from_address', 'daily_quota_exceeded', 'monthly_quota_exceeded', 'security_error']);

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

const pause = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/** One message to one person: `{ from, to: [address], subject, html, text }`. */
async function sendEmail(to: string, message: EmailMessage): Promise<SendResult & { resendId?: string }> {
  const resend = getClient();
  if (!resend) {
    console.error('[email] RESEND_API_KEY is not set - cannot send email');
    return { sent: false, error: 'RESEND_API_KEY is not configured' };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.attachments?.length ? { attachments: message.attachments } : {})
    });
    if (error) {
      console.error('[email] Resend rejected email', error);
      return { sent: false, error: error.message ?? 'Resend rejected the email' };
    }
    return { sent: true, resendId: data?.id };
  } catch (error) {
    console.error('[email] Failed to send email', error);
    return { sent: false, error: 'Email delivery failed' };
  }
}

/**
 * The same message to many people, each as THEIR OWN email. (It used to put up
 * to 100 addresses in a single `to` list, so every recipient could read every
 * other recipient's address.) Uses Resend's batch API in "permissive" mode so
 * one bad address fails only itself, paced to Resend's rate limit, with a
 * retry when it answers "rate limit".
 */
/**
 * Per-recipient outcome of a bulk send: the Resend email id when Resend
 * accepted that address (later delivery events are matched on this id - see
 * the /api/webhooks/resend handler), or the reason it was rejected.
 */
export type DeliveryResult = { email: string; resendId?: string; error?: string };
export type BulkSendResult = SendResult & { results: DeliveryResult[] };

export type BulkSendOptions = {
  pauseMs?: number;
  /**
   * Called with each chunk's per-recipient results as soon as that chunk is
   * settled, so callers can persist them while the rest of a large send is
   * still running (Resend delivery webhooks can arrive before the send ends).
   * Errors thrown here are logged and do not stop the send.
   */
  onChunk?: (results: DeliveryResult[]) => Promise<void>;
};

export async function sendBulkEmail(recipients: string[], message: EmailMessage, options: BulkSendOptions = {}): Promise<BulkSendResult> {
  const resend = getClient();
  if (!resend) {
    console.error('[email] RESEND_API_KEY is not set - cannot send email');
    return { sent: false, error: 'RESEND_API_KEY is not configured', results: [] };
  }
  const pauseMs = options.pauseMs ?? BULK_PAUSE_MS;
  const unique = [...new Map(recipients.map((address) => [address.trim().toLowerCase(), address.trim()])).values()].filter(Boolean);

  if (message.attachments?.length) {
    if (unique.length > 500) {
      return { sent: false, error: 'Bulk email with an attachment is limited to 500 recipients per send.', results: [] };
    }
    const results: DeliveryResult[] = [];
    let flushedCount = 0;
    for (let index = 0; index < unique.length; index += 1) {
      if (index > 0) await pause(options.pauseMs ?? BULK_PAUSE_MS);
      const address = unique[index];
      const sent = await sendEmail(address, message);
      results.push(sent.sent
        ? { email: address, resendId: sent.resendId }
        : { email: address, error: sent.error ?? 'Email delivery failed' });
      if (options.onChunk && (results.length % BATCH_SIZE === 0 || index === unique.length - 1)) {
        try {
          await options.onChunk(results.slice(flushedCount));
          flushedCount = results.length;
        } catch (error) {
          console.error('[email] onChunk handler failed', error);
        }
      }
    }
    const delivered = results.filter((result) => !result.error).length;
    const failed = results.length - delivered;
    return { sent: delivered > 0, delivered, failed, results, ...(delivered > 0 ? {} : { error: results[0]?.error ?? 'Email delivery failed' }) };
  }

  let delivered = 0;
  let failed = 0;
  let firstError: string | undefined;
  const results: DeliveryResult[] = [];
  const flush = async (from: number) => {
    if (!options.onChunk || results.length <= from) return;
    try {
      await options.onChunk(results.slice(from));
    } catch (error) {
      console.error('[email] onChunk handler failed', error);
    }
  };

  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    const chunk = unique.slice(start, start + BATCH_SIZE);
    if (start > 0) await pause(pauseMs);

    const before = results.length;
    let chunkDone = false;
    for (let attempt = 0; attempt < 3 && !chunkDone; attempt += 1) {
      try {
        const { data, error } = await resend.batch.send(
          chunk.map((address) => ({ from: env.RESEND_FROM_EMAIL, to: [address], subject: message.subject, html: message.html, text: message.text })),
          { batchValidation: 'permissive' as const }
        );
        if (error) {
          if (error.name === 'rate_limit_exceeded' && attempt < 2) {
            await pause(pauseMs === 0 ? 0 : Math.max(pauseMs, 1200) * (attempt + 1));
            continue;
          }
          console.error('[email] Resend rejected a bulk batch', error);
          const reason = error.message ?? 'Resend rejected the email';
          firstError ??= reason;
          failed += chunk.length;
          for (const address of chunk) results.push({ email: address, error: reason });
          chunkDone = true;
          if (FATAL_ERRORS.has(error.name)) {
            // Every remaining batch would fail the same way - record them and stop.
            for (const address of unique.slice(start + chunk.length)) results.push({ email: address, error: reason });
            await flush(before);
            return { sent: delivered > 0, error: delivered > 0 ? undefined : firstError, delivered, failed: failed + (unique.length - start - chunk.length), results };
          }
          continue;
        }

        // In permissive mode Resend returns ids only for the addresses it accepted,
        // in order, and reports rejected ones by their index within this chunk.
        const rejected = new Map((data?.errors ?? []).map((item) => [item.index, item.message] as const));
        const ids = data?.data ?? [];
        let idCursor = 0;
        chunk.forEach((address, index) => {
          const reason = rejected.get(index);
          if (reason !== undefined) {
            results.push({ email: address, error: reason });
          } else {
            results.push({ email: address, resendId: ids[idCursor]?.id });
            idCursor += 1;
          }
        });
        delivered += ids.length;
        failed += rejected.size;
        for (const [index, reason] of rejected) console.error(`[email] Resend rejected recipient #${start + index} in a bulk send:`, reason);
        if (rejected.size) firstError ??= rejected.values().next().value;
        chunkDone = true;
      } catch (error) {
        console.error('[email] Failed to send a bulk batch', error);
        firstError ??= 'Email delivery failed';
        failed += chunk.length;
        for (const address of chunk) results.push({ email: address, error: 'Email delivery failed' });
        chunkDone = true;
      }
    }
    await flush(before);
  }
  return { sent: delivered > 0, error: delivered > 0 ? undefined : (firstError ?? 'Email delivery failed'), delivered, failed, results };
}

// ── Welcome email ────────────────────────────────────────────────────────

// Grouped to match what the app actually offers (see web/src/lib/services.ts).
const WELCOME_SERVICE_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Identity & verification', items: ['NIN verification and slips (by NIN or phone number)', 'BVN verification, retrieval, modification and licence services', 'IPE clearance, NIN validation, personalization and modifications'] },
  { title: 'Business & documents', items: ['CAC registration and verification', 'TIN certificate and SCUML registration', 'Newspaper publication and birth attestation'] },
  { title: 'Everyday payments', items: ['Mobile data, airtime and airtime-to-cash', 'Cable TV and electricity bills', 'Bulk SMS'] },
  { title: 'Education', items: ['JAMB services', 'WAEC, NECO and NABTEB result checker PINs'] }
];

/** "SUNUSI" / "sunusi" -> "Sunusi"; a mixed-case name is left exactly as typed. */
function friendlyFirstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? '';
  if (!first) return 'there';
  return first === first.toUpperCase() || first === first.toLowerCase() ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : first;
}

export function buildWelcomeEmail(params: { fullName: string; webUrl: string }): EmailMessage {
  const name = friendlyFirstName(params.fullName);
  const base = params.webUrl.replace(/\/+$/, '');
  const dashboardUrl = `${base}/dashboard`;

  const text = [
    `Hello ${name},`,
    '',
    `Welcome to ${BRAND}! Your account is ready.`,
    '',
    'Here is what you can do with us:',
    '',
    ...WELCOME_SERVICE_GROUPS.flatMap((group) => [`${group.title}`, ...group.items.map((item) => `  - ${item}`), '']),
    'Getting started: fund your wallet from your dashboard, pick a service, and track every request from Service History.',
    'Share your referral code (My Profile) with friends and earn when they buy.',
    '',
    `Open your dashboard: ${dashboardUrl}`,
    '',
    'Need help? Just reply to this email or open Complaints & Support in the app.',
    '',
    `Thank you for choosing us,`,
    `${BRAND} COMPANY Support`
  ].join('\n');

  const groups = WELCOME_SERVICE_GROUPS.map(
    (group) =>
      `<tr><td style="padding:14px 0 0"><p style="margin:0 0 6px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a6a12">${escapeHtml(group.title)}</p>` +
      `<ul style="margin:0;padding-left:20px;color:#201708;font-size:15px;line-height:1.6">${group.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></td></tr>`
  ).join('');

  const html =
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your ${BRAND} account is ready - here is what you can do.</div>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:24px 12px;font-family:Arial,Helvetica,sans-serif"><tr><td align="center">` +
    `<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">` +
    `<tr><td style="background:#0b2f73;padding:22px 28px"><span style="font-size:20px;font-weight:700;letter-spacing:.04em;color:#f6d36b">${BRAND}</span></td></tr>` +
    `<tr><td style="padding:28px">` +
    `<h1 style="margin:0 0 12px;font-size:24px;color:#0b2f73">Welcome, ${escapeHtml(name)}!</h1>` +
    `<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#201708">Your account is ready. Here is what you can do with ${BRAND}:</p>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${groups}</table>` +
    `<p style="margin:22px 0 0;font-size:15px;line-height:1.6;color:#201708"><strong>Getting started:</strong> fund your wallet from your dashboard, pick a service, and track every request from Service History. Share your referral code (My Profile) with friends and earn when they buy.</p>` +
    `<p style="margin:24px 0"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#d4af37;color:#0b2f73;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">Open my dashboard</a></p>` +
    `<p style="margin:0;font-size:14px;line-height:1.6;color:#4a4438">Need help? Just reply to this email or open <strong>Complaints &amp; Support</strong> in the app.</p>` +
    `<p style="margin:20px 0 0;font-size:14px;color:#4a4438">Thank you for choosing us,<br><strong>${BRAND} COMPANY Support</strong></p>` +
    `</td></tr>` +
    `<tr><td style="background:#f4f1ea;padding:14px 28px;font-size:12px;color:#7a7364">You received this email because an account was created with this address on ${escapeHtml(base.replace(/^https?:\/\//, ''))}.</td></tr>` +
    `</table></td></tr></table>`;

  return { subject: `Welcome to ${BRAND}`, text, html };
}

export async function sendWelcomeEmail(params: { email: string; fullName: string }): Promise<SendResult> {
  return sendEmail(params.email, buildWelcomeEmail({ fullName: params.fullName, webUrl: env.PUBLIC_WEB_URL }));
}

export async function sendPartnerLowBalanceEmail(params: { email: string; businessName: string; balanceNaira: number; thresholdNaira: number }): Promise<SendResult> {
  const businessName = params.businessName.trim() || 'API partner';
  const balance = `₦${params.balanceNaira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const threshold = `₦${params.thresholdNaira.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dashboardUrl = `${env.PUBLIC_WEB_URL.replace(/\/$/, '')}/partner-dashboard?view=wallet`;
  const subject = 'Your API wallet balance is low';
  const text = `Hello ${businessName},\n\nYour API wallet balance is ${balance}, below the low-balance alert threshold of ${threshold}. Requests that cost more than your available balance will be rejected before processing. Please fund your wallet to avoid interruptions. A low wallet balance does not change the accuracy of verification results.\n\nOpen your wallet: ${dashboardUrl}\n\nK-TECH SOLUTIONS Partner Support`;
  const html = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8;padding:24px 10px;font-family:Arial,Helvetica,sans-serif;color:#201708"><tr><td align="center"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#fff;border:1px solid #e1e7ef;border-radius:12px;overflow:hidden"><tr><td style="background:#0b2f73;padding:22px 28px;border-bottom:4px solid #d4af37"><div style="font-size:20px;font-weight:700;letter-spacing:1px;color:#fff">${BRAND}</div><div style="margin-top:5px;font-size:10px;font-weight:700;letter-spacing:2px;color:#f6d36b">PARTNER WALLET NOTICE</div></td></tr><tr><td style="padding:28px"><h1 style="margin:0 0 18px;font-size:21px;line-height:1.35;color:#0b2f73">Your API wallet balance is low</h1><p style="font-size:15px;line-height:1.7">Hello ${escapeHtml(businessName)},</p><p style="font-size:15px;line-height:1.7">Your API wallet balance is <strong>${balance}</strong>, below the alert threshold of <strong>${threshold}</strong>.</p><p style="font-size:15px;line-height:1.7">Requests that cost more than your available balance will be rejected before processing. Please fund your wallet to avoid interruptions. A low wallet balance does not change the accuracy of verification results.</p><p style="margin:24px 0"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#0b2f73;color:#fff;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:8px">Fund API wallet</a></p><p style="margin:22px 0 0;font-size:14px;color:#4a4438">Regards,<br><strong>${BRAND} Partner Support</strong></p></td></tr><tr><td style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">This service notice was sent to the email address registered to your API partner account.</td></tr></table></td></tr></table>`;
  return sendEmail(params.email, { subject, text, html });
}

// ── Admin announcements & password reset ─────────────────────────────────

export async function sendAdminEmail(params: { recipients: string[]; subject: string; message: string; attachments?: EmailAttachment[] }, options: Pick<BulkSendOptions, 'onChunk'> = {}): Promise<BulkSendResult> {
  const message = params.message.trim();
  const subject = params.subject.trim();
  const safeMessage = escapeHtml(message).split(/\r?\n\s*\r?\n/).map((paragraph) => `<p style="margin:0 0 16px;line-height:1.7">${paragraph.replace(/\r?\n/g, '<br>')}</p>`).join('');
  const text = `${BRAND}\nOFFICIAL COMMUNICATION\n\n${subject}\n\n${message}\n\nK-Tech Solutions\nAdministration\nOfficial Admin Office\n[OFFICIAL STAMP: K-TECH SOLUTIONS ADMIN OFFICE]`;
  const stamp = `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 0"><tr><td style="width:92px;height:92px;border:3px double #0b2f73;border-radius:50%;text-align:center;vertical-align:middle;color:#0b2f73;font-family:Arial,sans-serif"><span style="font-size:9px;font-weight:bold;letter-spacing:1px">K-TECH</span><br><span style="font-size:12px;font-weight:bold">OFFICIAL</span><br><span style="font-size:8px;letter-spacing:1px">ADMIN OFFICE</span></td></tr></table>`;
  return sendBulkEmail(params.recipients, {
    subject,
    text,
    html: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f8;padding:24px 10px;font-family:Arial,Helvetica,sans-serif;color:#201708"><tr><td align="center"><table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#fff;border:1px solid #e1e7ef;border-radius:12px;overflow:hidden"><tr><td style="background:#0b2f73;padding:22px 28px;border-bottom:4px solid #d4af37"><div style="font-size:20px;font-weight:700;letter-spacing:1px;color:#fff">${BRAND}</div><div style="margin-top:5px;font-size:10px;font-weight:700;letter-spacing:2px;color:#f6d36b">OFFICIAL COMMUNICATION</div></td></tr><tr><td style="padding:28px"><h1 style="margin:0 0 20px;font-size:20px;line-height:1.35;color:#0b2f73">${escapeHtml(subject)}</h1><div style="font-size:15px;color:#201708">${safeMessage}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;border-top:1px solid #e2e8f0"><tr><td style="padding-top:18px;vertical-align:bottom"><div style="font-family:'Segoe Script','Bradley Hand',cursive;font-size:23px;font-style:italic;font-weight:700;color:#0b2f73">K-Tech Solutions</div><div style="margin-top:4px;font-size:13px;font-weight:bold;color:#334155">Administration</div><div style="font-size:12px;color:#64748b">Official Admin Office</div></td><td align="right" style="width:110px;vertical-align:bottom">${stamp}</td></tr></table></td></tr><tr><td style="padding:12px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">This official communication was issued by ${BRAND} Administration. Please reply to this email for assistance.</td></tr></table></td></tr></table>`,
    attachments: params.attachments
  }, options);
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<{ sent: boolean }> {
  const safeCode = escapeHtml(code);
  const result = await sendEmail(email, {
    subject: `${code} is your ${BRAND} password reset code`,
    text: `Your password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email - your password won't change.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px"><p>Someone requested a password reset for your ${BRAND} account. Enter this code in the app:</p><p style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:.08em;background:#f2ead9;padding:16px 20px;border-radius:12px;text-align:center">${safeCode}</p><p style="font-size:13px;color:#4a4438">This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p></div>`
  });
  return { sent: result.sent };
}
