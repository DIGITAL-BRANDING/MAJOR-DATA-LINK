import type { Request } from 'express';
import { CustomerLoginChannel } from '@prisma/client';

/**
 * This is an operational-reporting label only; it must never alter access
 * control because callers can forge an HTTP header. We intentionally retain
 * no IP, user-agent or persistent device identifier for this feature.
 */
export function customerLoginChannel(req: Request): CustomerLoginChannel {
  const declared = req.header('x-client-channel')?.trim().toLowerCase();
  if (declared === 'mobile_app') return CustomerLoginChannel.MOBILE_APP;
  if (declared === 'web') return CustomerLoginChannel.WEB;

  // Same-origin browser requests do not always have an Origin header (for
  // example a privacy-restricted browser), so only use it as a safe fallback.
  return req.header('origin') ? CustomerLoginChannel.WEB : CustomerLoginChannel.UNKNOWN;
}
