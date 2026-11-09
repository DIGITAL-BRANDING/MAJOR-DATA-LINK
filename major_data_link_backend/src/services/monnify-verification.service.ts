import { nanoid } from 'nanoid';
import { env } from '../config/env.js';
import { renderIdentitySlipPdf, renderPersonalInformationSlipPdf, type IdentitySlipField, type IdentitySlipTier } from '../lib/render-identity-slip-pdf.js';
import type { TechhubSlipResult, TechhubSlipTier } from './techhub.service.js';

type MonnifyEnvelope = {
  requestSuccessful?: boolean;
  responseCode?: string;
  responseMessage?: string;
  responseBody?: {
    nin?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    gender?: string;
    phoneNumber?: string;
    ninInformationMatch?: boolean;
  };
};

let token: string | undefined;
let tokenExpiresAt = 0;
let tokenRequest: Promise<string> | undefined;

function apiRoot() {
  return env.MONNIFY_BASE_URL.replace(/\/$/, '');
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error('Monnify returned an unexpectedly large response.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Monnify returned an invalid response.');
  }
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!env.MONNIFY_API_KEY || !env.MONNIFY_SECRET_KEY) throw new Error('Monnify verification is not configured.');
  if (!forceRefresh && token && Date.now() < tokenExpiresAt) return token;
  if (!tokenRequest) {
    tokenRequest = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const credentials = Buffer.from(`${env.MONNIFY_API_KEY}:${env.MONNIFY_SECRET_KEY}`).toString('base64');
        const response = await fetch(`${apiRoot()}/api/v1/auth/login`, {
          method: 'POST', headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' }, signal: controller.signal
        });
        const result = await readJson<{ requestSuccessful?: boolean; responseBody?: { accessToken?: string; expiresIn?: number } }>(response);
        const accessToken = result.responseBody?.accessToken;
        if (!response.ok || result.requestSuccessful !== true || !accessToken) throw new Error('Monnify authentication failed. Check API credentials and environment.');
        token = accessToken;
        tokenExpiresAt = Date.now() + Math.max(60, (result.responseBody?.expiresIn ?? 3600) - 60) * 1000;
        return accessToken;
      } finally {
        clearTimeout(timeout);
        tokenRequest = undefined;
      }
    })();
  }
  return tokenRequest;
}

function fields(data: NonNullable<MonnifyEnvelope['responseBody']>): IdentitySlipField[] {
  return [
    { label: 'National Identification Number', value: data.nin },
    { label: 'First name', value: data.firstName },
    { label: 'Last name', value: data.lastName },
    { label: 'Date of birth', value: data.dateOfBirth },
    { label: 'Gender', value: data.gender },
    { label: 'Phone number', value: data.phoneNumber },
    { label: 'NIN verification match', value: data.ninInformationMatch === true ? 'Verified' : 'Not verified' }
  ];
}

async function renderReport(data: NonNullable<MonnifyEnvelope['responseBody']>, tier: TechhubSlipTier | 'personal') {
  const issuedAt = new Date();
  const reportFields = fields(data);
  const subtitle = 'K-Tech generated verification report • Monnify data';
  if (tier === 'personal') {
    return renderPersonalInformationSlipPdf({ title: 'NIN Slip', subtitle, fields: reportFields, issuedAt });
  }
  return renderIdentitySlipPdf({
    title: 'NIN Slip', subtitle, reference: `MNV-${nanoid(10).toUpperCase()}`,
    fields: reportFields, issuedAt, tier: tier as IdentitySlipTier
  });
}

async function verifyNin(nin: string, tier: TechhubSlipTier | 'personal'): Promise<TechhubSlipResult> {
  if (!/^\d{11}$/.test(nin)) return { ok: false, message: 'NIN must be exactly 11 digits.', raw: { validation: 'invalid_nin' } };
  const send = async (accessToken: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${apiRoot()}/api/v1/vas/nin-verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nin }), signal: controller.signal
      });
      return { response, body: await readJson<MonnifyEnvelope>(response) };
    } finally {
      clearTimeout(timeout);
    }
  };

  let accessToken = await getAccessToken();
  let { response, body } = await send(accessToken);
  if (response.status === 401) {
    accessToken = await getAccessToken(true);
    ({ response, body } = await send(accessToken));
  }
  const data = body.responseBody;
  if (!response.ok || body.requestSuccessful !== true || body.responseCode !== '0' || data?.ninInformationMatch !== true) {
    const message = typeof body.responseMessage === 'string' && body.responseMessage.trim()
      ? body.responseMessage.trim().slice(0, 240)
      : 'Monnify could not verify this NIN.';
    return { ok: false, message, raw: { requestSuccessful: body.requestSuccessful, responseCode: body.responseCode, responseMessage: message } };
  }
  if (!data?.nin) return { ok: false, message: 'Monnify did not return the verified NIN record.', raw: { responseCode: body.responseCode } };

  const pdfBase64 = await renderReport(data, tier);
  return {
    ok: true,
    message: 'NIN verification completed. Your K-Tech verification report is ready.',
    userData: {
      nin: data.nin, firstname: data.firstName, lastname: data.lastName, dob: data.dateOfBirth,
      gender: data.gender, phoneNumber: data.phoneNumber, ninInformationMatch: data.ninInformationMatch
    },
    pdfBase64,
    raw: { requestSuccessful: body.requestSuccessful, responseCode: body.responseCode, responseMessage: body.responseMessage, responseBody: data }
  };
}

export const monnifyVerificationService = {
  ninByNin(nin: string, tier: TechhubSlipTier) { return verifyNin(nin, tier); },
  ninPersonalInfoByNin(nin: string) { return verifyNin(nin, 'personal'); },
  clearTokenCache() { token = undefined; tokenExpiresAt = 0; }
};
