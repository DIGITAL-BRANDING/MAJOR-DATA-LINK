import { Resend } from 'resend';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

/**
 * Two-way sync between our User/Partner tables and Resend's Contacts
 * feature, so the "Customers"/"Partners" Audiences in the Resend dashboard
 * (used by admin/email-composer.ts's "Send an email" tool) mirror our own
 * accounts instead of being managed by hand:
 *
 *   - push (this file): called right after a user/partner registers (see
 *     routes/auth.routes.ts and routes/partner-portal.routes.ts) to
 *     create-or-update their Resend contact in the matching Audience.
 *   - pull (routes/webhook.routes.ts's POST /resend): Resend's
 *     contact.created/updated/deleted events report changes made on
 *     Resend's side - most importantly someone unsubscribing - back into
 *     our own emailSubscribed column.
 *
 * Everything here is best-effort, same spirit as sendWelcomeEmail in
 * email.ts: a Resend outage, a missing RESEND_API_KEY, or an unconfigured
 * RESEND_AUDIENCE_*_ID must never block registration or throw into the
 * caller. Callers use `void syncResendContact(...).catch(...)` the same way
 * they already do for the welcome email.
 */

let client: Resend | null = null;
function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export type ContactKind = 'user' | 'partner';

function audienceIdFor(kind: ContactKind): string | undefined {
  return kind === 'user' ? env.RESEND_AUDIENCE_CUSTOMERS_ID : env.RESEND_AUDIENCE_PARTNERS_ID;
}

/** "Jane Doe" -> {firstName:'Jane', lastName:'Doe'}; a single word (or a business name with no space) goes entirely into firstName. */
function splitName(name: string): { firstName: string; lastName?: string } {
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() || undefined };
}

/**
 * Creates the Resend contact for a newly registered user/partner (or
 * updates it, if one already exists for this row - safe to call again,
 * e.g. from the backfill script). Stores the returned contact id back on
 * the row so later calls update in place instead of creating duplicates.
 */
export async function syncResendContact(
  kind: ContactKind,
  record: { id: string; email: string; name: string; resendContactId: string | null }
): Promise<void> {
  const resend = getClient();
  const audienceId = audienceIdFor(kind);
  if (!resend || !audienceId) return; // Not configured - sync is entirely opt-in.

  const { firstName, lastName } = splitName(record.name);

  try {
    if (record.resendContactId) {
      // SelectingField is "id OR email", never both - we address the contact by its Resend id.
      const { error } = await resend.contacts.update({
        id: record.resendContactId,
        audienceId,
        firstName,
        lastName: lastName ?? null
      });
      if (error) console.error(`[resend-contacts] Failed to update ${kind} contact`, record.id, error);
      return;
    }

    const { data, error } = await resend.contacts.create({ audienceId, email: record.email, firstName, lastName });
    if (error) {
      console.error(`[resend-contacts] Failed to create ${kind} contact`, record.id, error);
      return;
    }
    if (!data?.id) return;

    if (kind === 'user') await prisma.user.update({ where: { id: record.id }, data: { resendContactId: data.id } });
    else await prisma.partner.update({ where: { id: record.id }, data: { resendContactId: data.id } });
  } catch (error) {
    console.error(`[resend-contacts] Failed to sync ${kind} contact`, record.id, error);
  }
}
