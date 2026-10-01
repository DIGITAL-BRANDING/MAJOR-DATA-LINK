import { Resend } from 'resend';
import { env } from '../config/env.js';
let client: Resend | null = null;
function getClient() { if (!env.RESEND_API_KEY) return null; if (!client) client = new Resend(env.RESEND_API_KEY); return client; }
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!); }
async function sendEmail(params: { to: string | string[]; subject: string; text: string; html: string }) {
  const resend = getClient();
  if (!resend) { console.error('[email] RESEND_API_KEY is not set - cannot send email'); return { sent: false, error: 'RESEND_API_KEY is not configured' }; }
  try {
    const recipients = Array.isArray(params.to) ? params.to : [params.to];
    for (let index = 0; index < recipients.length; index += 100) {
      const batch = recipients.slice(index, index + 100);
      const { error } = await resend.emails.send({ from: env.RESEND_FROM_EMAIL, ...params, to: batch });
      if (error) { console.error('[email] Resend rejected email', error); return { sent: false, error: error.message ?? 'Resend rejected the email' }; }
    }
    return { sent: true };
  } catch (error) { console.error('[email] Failed to send email', error); return { sent: false, error: 'Email delivery failed' }; }
}
const WELCOME_SERVICES = ['Mobile data and airtime', 'JAMB services and CBT practice software', 'NIN and BVN verification services', 'CAC business registration support', 'Utility bill payments', 'Secure wallet funding and transaction history'];
export async function sendWelcomeEmail(params: { email: string; fullName: string }) {
  const serviceItems = WELCOME_SERVICES.map((item) => `<li style="margin:8px 0">${escapeHtml(item)}</li>`).join('');
  const servicesText = WELCOME_SERVICES.map((item) => `- ${item}`).join('\n');
  return sendEmail({ to: params.email, subject: 'Welcome to MAJOR DATA-LINK', text: `Hello ${params.fullName},\n\nWelcome to MAJOR DATA-LINK! Your account is ready. We make essential digital services convenient, secure, and easy to access, with clear pricing and reliable request tracking.\n\nOur services include:\n${servicesText}\n\nSign in to explore services, fund your wallet, and track requests. Our support team is here if you need help.\n\nThank you for choosing us,\nMAJOR DATA-LINK Support`, html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#201708"><h1 style="color:#0b2f73">Welcome to MAJOR DATA-LINK</h1><p>Hello ${escapeHtml(params.fullName)},</p><p>Your account is ready. We make essential digital services convenient, secure, and easy to access, with clear pricing and reliable request tracking.</p><h2 style="font-size:18px">Services available to you</h2><ul style="padding-left:22px">${serviceItems}</ul><p>Sign in to your dashboard to explore services, fund your wallet, and track your requests. Our support team is here if you need help.</p><p>Thank you for choosing us,<br><strong>MAJOR DATA-LINK Support</strong></p></div>` });
}
export async function sendAdminEmail(params: { recipients: string[]; subject: string; message: string }) {
  const safeMessage = escapeHtml(params.message.trim()).replace(/\r?\n/g, '<br>');
  return sendEmail({ to: params.recipients, subject: params.subject.trim(), text: params.message.trim(), html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:28px;color:#201708;line-height:1.6"><h2 style="color:#0b2f73">MAJOR DATA-LINK</h2><div>${safeMessage}</div><p style="margin-top:28px;color:#666">MAJOR DATA-LINK Team</p></div>` });
}
export async function sendPasswordResetEmail(email: string, code: string) {
  const safeCode = escapeHtml(code);
  const resend = getClient();
  if (!resend) { console.error('[email] RESEND_API_KEY is not set - cannot send password reset email'); return { sent: false }; }
  try {
    const { error } = await resend.emails.send({ from: env.RESEND_FROM_EMAIL, to: email, subject: `${code} is your MAJOR DATA-LINK password reset code`, text: `Your password reset code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore this email - your password won't change.`, html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px"><p>Someone requested a password reset for your MAJOR DATA-LINK account. Enter this code in the app:</p><p style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:.08em;background:#f2ead9;padding:16px 20px;border-radius:12px;text-align:center">${safeCode}</p><p style="font-size:13px;color:#4a4438">This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p></div>` });
    if (error) { console.error('[email] Resend rejected the password reset email', error); return { sent: false }; }
    return { sent: true };
  } catch (error) { console.error('[email] Failed to send password reset email', error); return { sent: false }; }
}