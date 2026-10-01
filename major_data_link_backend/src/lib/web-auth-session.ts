import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { publicUser } from './public-user.js';

const REFRESH_COOKIE = 'mdl_web_refresh';
const COOKIE_PATH = '/api/auth';

type User = Parameters<typeof publicUser>[0];
type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

export function isWebAuthRequest(req: Request) {
  return req.get('X-Client-Channel') === 'web';
}

function shouldRemember(req: Request) {
  if (typeof req.body?.remember_me === 'boolean') return req.body.remember_me;
  return req.get('X-Remember-Me') !== 'false';
}

export async function sendUserAuthResponse(
  req: Request,
  res: Response,
  user: User,
  tokens: Tokens,
  status = 200
) {
  const web = isWebAuthRequest(req);
  if (web) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: COOKIE_PATH,
      ...(shouldRemember(req) ? { maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000 } : {})
    });
  }

  const data = {
    access_token: tokens.accessToken,
    ...(!web ? { refresh_token: tokens.refreshToken } : {}),
    expires_in: tokens.expiresIn,
    requires_pin_setup: !user.pinHash,
    requires_login_pin_setup: !user.loginPinHash,
    requires_password_change: user.mustChangePassword,
    user: await publicUser(user)
  };
  return res.status(status).json({ status: true, data });
}

export function refreshTokenFromRequest(req: Request) {
  const bodyToken = typeof req.body?.refresh_token === 'string' ? req.body.refresh_token : '';
  if (bodyToken) return bodyToken;
  if (!isWebAuthRequest(req)) return '';
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== REFRESH_COOKIE) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}

export function clearWebRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH
  });
}
