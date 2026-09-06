import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyAuthToken } from '../lib/auth-token.js';

export type AuthPartner = { id: string; businessName: string; email: string };

declare global {
  namespace Express {
    interface Request {
      partner?: AuthPartner;
    }
  }
}

export function hashPartnerApiKey(key: string) {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export async function requirePartnerApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const key = req.header('X-API-Key')?.trim() ?? '';
    if (!key.startsWith('mdl_live_') || key.length < 32) {
      return res.status(401).json({ status: false, message: 'Missing or invalid API key', code: 'INVALID_API_KEY' });
    }

    const keyPrefix = key.slice(0, 16);
    const suppliedHash = hashPartnerApiKey(key);
    const candidates = await prisma.partnerApiKey.findMany({
      where: { keyPrefix, revokedAt: null },
      include: { partner: true }
    });
    const matched = candidates.find((candidate) => {
      const stored = Buffer.from(candidate.secretHash, 'hex');
      const supplied = Buffer.from(suppliedHash, 'hex');
      return stored.length === supplied.length && timingSafeEqual(stored, supplied);
    });

    if (!matched || matched.partner.status !== 'ACTIVE') {
      return res.status(401).json({ status: false, message: 'API key is not active', code: 'INVALID_API_KEY' });
    }

    // Best effort: usage telemetry must never stop a valid purchase.
    void prisma.partnerApiKey.update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } });
    req.partner = { id: matched.partner.id, businessName: matched.partner.businessName, email: matched.partner.email };
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Session-based auth for the partner PORTAL (dashboard login, API key
 * self-service) - completely separate mechanism from requirePartnerApiKey
 * above, which is for the partner's own backend calling the commercial API.
 * Sets the SAME req.partner shape so downstream handlers don't need to care
 * which one authenticated the request; unlike requirePartnerApiKey, this
 * does NOT reject a non-ACTIVE partner - a PENDING_REVIEW or SUSPENDED
 * partner still needs to log in to see their own status. Individual
 * portal routes that need ACTIVE (e.g. generating a live API key) check
 * that explicitly themselves.
 */
export async function requirePartnerSession(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ status: false, message: 'Missing auth token' });

    const payload = verifyAuthToken(token, 'access');
    const partner = await prisma.partner.findUnique({ where: { id: payload.sub } });
    if (!partner) {
      return res.status(401).json({ status: false, message: 'Partner account no longer exists' });
    }

    req.partner = { id: partner.id, businessName: partner.businessName, email: partner.email };
    next();
  } catch (error) {
    next(error);
  }
}
