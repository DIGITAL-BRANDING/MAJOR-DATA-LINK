import { Router, type Request } from 'express';
import { z } from 'zod';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { GEO_POLITICAL_ZONES, submitBvnLicense } from '../services/bvn-license-onboarding.service.js';
import { pinField, requirePinConfirmation } from '../lib/require-pin.js';
import { prisma } from '../lib/prisma.js';
import {
  checkBvnRetrievalStatus,
  checkDelinkingStatus,
  checkIpeClearanceStatus,
  checkNinValidationStatus,
  checkPersonalizationStatus,
  decryptTransactionPII,
  listVerificationPrices,
  purchaseBvnSlip,
  purchaseNinByDemographic,
  purchaseNinByDemographicV1,
  purchaseNinByDemographicV2,
  purchaseNinByNin,
  purchaseNinByPhone,
  purchaseNinByPhoneV1,
  purchaseNinByPhoneV2,
  purchaseNinVerificationV1,
  purchaseNinVerificationV2,
  submitBvnRetrieval,
  submitDelinking,
  submitIpeClearance,
  submitNinValidation,
  submitPersonalization
} from '../services/verification.service.js';

export const verificationRoutes = Router();

verificationRoutes.use(requireAuth);

// Production timing signal for paid verification submissions. Intentionally
// excludes request bodies, user IDs, references, and provider details.
verificationRoutes.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const startedAt = Date.now();
  res.once('finish', () => {
    console.info('[verification] request timing', JSON.stringify({
      endpoint: req.path,
      duration_ms: Date.now() - startedAt,
      status: res.statusCode
    }));
  });
  next();
});

function idempotencyKeyFrom(req: Request) {
  const header = req.header('Idempotency-Key');
  return header && header.trim().length > 0 ? header.trim() : undefined;
}

const ninSlipTier = z.enum(['premium', 'standard', 'regular', 'vnin', 'personal']);
// V2 (FranceVerified) additionally offers the smart-card and portrait layouts.
const ninSlipTierV2 = z.enum([...ninSlipTier.options, 'smart', 'portrait']);
const ninPhoneSlipTier = z.enum(['premium', 'standard', 'regular', 'personal']);
const bvnSlipTier = z.enum(['premium', 'standard']);
const ninValidationType = z.enum([
  'nin_validation',
  'no_record',
  'sim',
  'modification',
  'photo_error',
  'bank_validation',
  'v.nin_validation',
  'update_records'
]);

function safeSlipPreview(userData: Record<string, unknown> | undefined) {
  if (!userData) return null;
  const normalized = new Map(Object.entries(userData).map(([key, value]) => [key.toLowerCase().replace(/[^a-z]/g, ''), value]));
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = normalized.get(key.toLowerCase().replace(/[^a-z]/g, ''));
      if (typeof value === 'string' && value.trim() && value !== '****' && value.length <= 500) return value.trim();
    }
    return undefined;
  };
  const preview: Record<string, string> = {};
  const firstName = pick('firstName', 'firstname', 'First Name');
  const middleName = pick('middleName', 'middlename', 'Middle Name');
  const lastName = pick('lastName', 'lastname', 'surname', 'Surname', 'Last Name');
  const gender = pick('gender');
  const phone = pick('phone', 'phoneNumber', 'phone_number', 'mobile', 'telephoneno', 'Phone Number');
  const idNumber = pick('nin', 'bvn', 'idNumber', 'id_number', 'NIN', 'BVN');
  const photoKey = ['photo', 'image', 'picture', 'passport', 'passport_photo', 'imageBase64'].map((key) => key.toLowerCase().replace(/[^a-z]/g, '')).find((key) => typeof normalized.get(key) === 'string' && (normalized.get(key) as string).length <= 4_000_000);
  const photo = photoKey ? normalized.get(photoKey) as string : undefined;
  if (firstName) preview.firstName = firstName;
  if (middleName) preview.middleName = middleName;
  if (lastName) preview.lastName = lastName;
  if (gender) preview.gender = gender;
  if (phone) preview.phone = phone;
  if (idNumber) preview.idNumber = idNumber;
  // Only inline image data can be used for the preview. Arbitrary provider
  // URLs, documents, raw responses and base64 payload fields are never echoed.
  if (photo && photo.length <= 4_000_000 && (/^data:image\/(png|jpe?g|webp);base64,/i.test(photo) || /^[a-z0-9+/]+={0,2}$/i.test(photo.replace(/\s/g, '')))) {
    preview.photo = photo;
  }
  return preview;
}

function slipResponse(result: Awaited<ReturnType<typeof purchaseNinByNin>>) {
  return {
    status: result.status,
    message: result.message,
    data: {
      reference: result.reference,
      transaction_id: result.transactionId,
      user_data: safeSlipPreview(result.userData),
      document_available: Boolean(result.pdfBase64 || result.pdfUrl),
      balance_after: result.balanceAfter
    }
  };
}

// ── Prices ───────────────────────────────────────────────────────

verificationRoutes.get('/prices', async (_req, res) => {
  const prices = await listVerificationPrices();
  res.json({ status: true, data: prices });
});

verificationRoutes.post('/bvn/license-onboarding', async (req, res) => {
  const body = z.object({
    agent_location: z.string().trim().min(2), agent_bvn: z.string().trim().length(11),
    account_number: z.string().trim().min(10).max(12), bank_name: z.string().trim().min(2),
    first_name: z.string().trim().min(1), last_name: z.string().trim().min(1),
    email: z.string().trim().email(), phone_number: z.string().trim().length(11),
    date_of_birth: z.string().trim().min(8), address: z.string().trim().min(3),
    lga: z.string().trim().min(2), state_of_residence: z.string().trim().min(2),
    geo_political_zone: z.enum(GEO_POLITICAL_ZONES), consent: z.literal(true), ...pinField
  }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const { pin: _pin, ...values } = body;
  const result = await submitBvnLicense({ userId: req.user!.id, values, idempotencyKey: idempotencyKeyFrom(req) });
  res.json({ status: true, data: result });
});

verificationRoutes.get('/bvn/license-onboarding/history', async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.transaction.findMany({
    where: {
      userId: req.user!.id,
      type: TransactionType.BVN_LICENSE_ONBOARDING,
      status: TransactionStatus.SUCCESS,
      updatedAt: { gte: since }
    },
    orderBy: { updatedAt: 'desc' }, take: 20
  });
  res.json({ status: true, data: rows.map((tx) => {
    const metadata = tx.metadata as Record<string, unknown> | null;
    return { reference: tx.reference, tracking_id: metadata?.tracking_id ?? null,
      status: tx.status.toLowerCase(), amount: Number(tx.amountKobo) / 100,
      // A manual onboarding request may sit pending for days. Its seven-day
      // activity window starts only once an admin marks it successful.
      created_at: tx.updatedAt.toISOString() };
  }) });
});

// Show recently submitted verification work, including requests which a
// provider is still processing. Customers need to see a pending request as
// soon as it is submitted; restricting this feed to SUCCESS made a valid
// Personalization, Validation, or IPE request look as though it vanished.
verificationRoutes.get('/history', async (req, res) => {
  const service = z.string().trim().min(1).max(60).parse(req.query.service);
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: req.user!.id,
      createdAt: { gte: since },
      type: {
        in: [
          TransactionType.NIN_VERIFICATION,
          TransactionType.BVN_VERIFICATION,
          TransactionType.IDENTITY_SERVICE_REQUEST
        ]
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  const data = transactions
    .filter((transaction) => {
      const metadata = transaction.metadata as Record<string, unknown> | null;
      const storedService = typeof metadata?.service === 'string'
        ? metadata.service.toUpperCase()
        : '';
      if (storedService === service.toUpperCase()) return true;

      // Records created before metadata.service was introduced still belong
      // in the customer's recent-request panel. They cannot be identified by
      // tier reliably, but showing the matching broad service is far better
      // than making an already-paid slip appear to have disappeared.
      if (storedService) return false;
      if (service.startsWith('NIN_')) {
        return transaction.type === TransactionType.NIN_VERIFICATION ||
          transaction.type === TransactionType.IDENTITY_SERVICE_REQUEST;
      }
      if (service.startsWith('BVN_')) {
        return transaction.type === TransactionType.BVN_VERIFICATION ||
          transaction.type === TransactionType.IDENTITY_SERVICE_REQUEST;
      }
      return false;
    })
    .slice(0, 10)
    .map((transaction) => {
      const metadata = transaction.metadata as Record<string, unknown> | null;
      const pii = decryptTransactionPII(metadata);
      // Older successful Techhub responses stored the provider payload under
      // `user_data`, including its own `pdf_base64`.  Read that nested shape
      // too, so an already-paid slip can be recovered without another call.
      const userData = pii?.user_data as Record<string, unknown> | undefined;
      const documentAvailable =
        (typeof pii?.pdf_base64 === 'string' && pii.pdf_base64.trim().length > 0) ||
        (typeof pii?.pdfBase64 === 'string' && pii.pdfBase64.trim().length > 0) ||
        (typeof userData?.pdf_base64 === 'string' && userData.pdf_base64.trim().length > 0) ||
        (typeof userData?.pdfBase64 === 'string' && userData.pdfBase64.trim().length > 0) ||
        (typeof pii?.pdf_url === 'string' && pii.pdf_url.trim().length > 0) ||
        (typeof pii?.pdfUrl === 'string' && pii.pdfUrl.trim().length > 0) ||
        (typeof userData?.pdf_url === 'string' && userData.pdf_url.trim().length > 0) ||
        (typeof userData?.pdfUrl === 'string' && userData.pdfUrl.trim().length > 0) ||
        (typeof userData?.slip_url === 'string' && userData.slip_url.trim().length > 0);
      return {
        transaction_id: transaction.id,
        reference: transaction.reference,
        status: transaction.status.toLowerCase(),
        created_at: transaction.createdAt.toISOString(),
        // Do not return identity details here. The PDF itself is the
        // retrievable document and the rest remains sealed in storage.
        document_available: documentAvailable,
        ticket_id: typeof metadata?.ticket_id === 'string' ? metadata.ticket_id : null,
        // Set when an admin completed a manual request (see
        // completeRequest() in admin/manual-verification.ts) and attached a
        // result file through the UserDelivery system - a completely
        // separate path from the auto-generated provider PDFs above, since
        // manual services (NIN Modification, and any other request routed
        // to a human because no provider covers it) have no provider
        // response to render a slip from in the first place. Exposed here
        // so "Recent requests" can offer a direct download instead of
        // sending the user to hunt for it on a separate Deliveries page.
        delivery_id: typeof pii?.delivery_id === 'string' ? pii.delivery_id : null
      };
    });

  res.set('Cache-Control', 'no-store');
  res.json({ status: true, data });
});

// ── Slip lookups (synchronous) ────────────────────────────────────

verificationRoutes.post('/nin/by-nin', async (req, res) => {
  const body = z.object({ nin: z.string().trim().length(11), tier: ninSlipTier, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByNin({
    userId: req.user!.id,
    nin: body.nin,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

// "NIN Verification V1"/"V2" - user-picked provider (Techhub vs
// FranceVerified) instead of an admin-configured one, so a customer can
// route around a provider outage themselves. See the SERVICE_KEYS comment
// on NIN_VERIFICATION_V1/V2 in verification.service.ts.
verificationRoutes.post('/nin/verification-v1', async (req, res) => {
  const body = z.object({ nin: z.string().trim().length(11), tier: ninSlipTier, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinVerificationV1({
    userId: req.user!.id,
    nin: body.nin,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/nin/verification-v2', async (req, res) => {
  const body = z.object({ nin: z.string().trim().length(11), tier: ninSlipTierV2, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinVerificationV2({
    userId: req.user!.id,
    nin: body.nin,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/nin/by-phone', async (req, res) => {
  const body = z.object({ phone: z.string().trim().length(11), tier: ninPhoneSlipTier, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByPhone({
    userId: req.user!.id,
    phone: body.phone,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/nin/by-demographic', async (req, res) => {
  const body = z
    .object({
      firstname: z.string().trim().min(1),
      lastname: z.string().trim().min(1),
      dob: z.string().trim().min(1),
      gender: z.enum(['MALE', 'FEMALE']).optional(),
      ...pinField
    })
    .parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByDemographic({
    userId: req.user!.id,
    firstname: body.firstname,
    lastname: body.lastname,
    dob: body.dob,
    gender: body.gender,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

// "NIN by Phone V1"/"V2" and "NIN by Demographic V1"/"V2" - same
// user-picked-provider pattern as /nin/verification-v1 and -v2 above,
// extended to the Phone and Demographic lookups. See the SERVICE_KEYS
// comment for NIN_PHONE_SLIP_V1/V2 and NIN_DEMOGRAPHIC_V1/V2 in
// verification.service.ts.
verificationRoutes.post('/nin/by-phone-v1', async (req, res) => {
  const body = z.object({ phone: z.string().trim().length(11), tier: ninPhoneSlipTier, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByPhoneV1({
    userId: req.user!.id,
    phone: body.phone,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/nin/by-phone-v2', async (req, res) => {
  const body = z.object({ phone: z.string().trim().length(11), tier: ninPhoneSlipTier, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByPhoneV2({
    userId: req.user!.id,
    phone: body.phone,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/nin/by-demographic-v1', async (req, res) => {
  const body = z
    .object({
      firstname: z.string().trim().min(1),
      lastname: z.string().trim().min(1),
      dob: z.string().trim().min(1),
      gender: z.enum(['MALE', 'FEMALE']).optional(),
      ...pinField
    })
    .parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByDemographicV1({
    userId: req.user!.id,
    firstname: body.firstname,
    lastname: body.lastname,
    dob: body.dob,
    gender: body.gender,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/nin/by-demographic-v2', async (req, res) => {
  const body = z
    .object({
      firstname: z.string().trim().min(1),
      lastname: z.string().trim().min(1),
      dob: z.string().trim().min(1),
      gender: z.enum(['MALE', 'FEMALE']).optional(),
      ...pinField
    })
    .parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseNinByDemographicV2({
    userId: req.user!.id,
    firstname: body.firstname,
    lastname: body.lastname,
    dob: body.dob,
    gender: body.gender,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

verificationRoutes.post('/bvn/slip', async (req, res) => {
  const body = z.object({ bvn: z.string().trim().length(11), tier: bvnSlipTier, ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await purchaseBvnSlip({
    userId: req.user!.id,
    bvn: body.bvn,
    tier: body.tier,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json(slipResponse(result));
});

// ── Async services (submit + poll) ────────────────────────────────

verificationRoutes.post('/delinking', async (req, res) => {
  const body = z.object({ nin: z.string().trim().length(11), email: z.string().trim().email(), ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await submitDelinking({
    userId: req.user!.id,
    nin: body.nin,
    email: body.email,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({ status: true, data: { reference: result.reference, ticket_id: result.ticketId, balance_after: result.balanceAfter } });
});

verificationRoutes.get('/delinking/:ticketId', async (req, res) => {
  const result = await checkDelinkingStatus({ userId: req.user!.id, ticketId: req.params.ticketId });
  res.json({ status: true, data: { ticket_id: result.ticketId, status: result.status, response: result.response } });
});

verificationRoutes.post('/nin-validation', async (req, res) => {
  const body = z
    .object({ nin: z.string().trim().length(11), validation_type: ninValidationType.optional(), ...pinField })
    .parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await submitNinValidation({
    userId: req.user!.id,
    nin: body.nin,
    validationType: body.validation_type,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({ status: true, data: { reference: result.reference, ticket_id: result.ticketId, balance_after: result.balanceAfter } });
});

verificationRoutes.get('/nin-validation/:ticketId', async (req, res) => {
  const result = await checkNinValidationStatus({ userId: req.user!.id, ticketId: req.params.ticketId });
  res.json({ status: true, data: { ticket_id: result.ticketId, status: result.status, response: result.response } });
});

verificationRoutes.post('/personalization', async (req, res) => {
  const body = z.object({ tracking_id: z.string().trim().min(1).max(50), ...pinField }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await submitPersonalization({
    userId: req.user!.id,
    trackingId: body.tracking_id,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({ status: true, data: { reference: result.reference, ticket_id: result.ticketId, balance_after: result.balanceAfter } });
});

verificationRoutes.get('/personalization/:ticketId', async (req, res) => {
  const result = await checkPersonalizationStatus({ userId: req.user!.id, ticketId: req.params.ticketId });
  res.json({ status: true, data: { ticket_id: result.ticketId, status: result.status, response: result.response } });
});

verificationRoutes.post('/bvn-retrieval', async (req, res) => {
  const body = z
    .object({
      first_name: z.string().trim().min(1),
      last_name: z.string().trim().min(1),
      phone_number: z.string().trim().length(11),
      ...pinField
    })
    .parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await submitBvnRetrieval({
    userId: req.user!.id,
    firstName: body.first_name,
    lastName: body.last_name,
    phoneNumber: body.phone_number,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({ status: true, data: { reference: result.reference, ticket_id: result.ticketId, balance_after: result.balanceAfter } });
});

verificationRoutes.get('/bvn-retrieval/:ticketId', async (req, res) => {
  const result = await checkBvnRetrievalStatus({ userId: req.user!.id, ticketId: req.params.ticketId });
  res.json({ status: true, data: { ticket_id: result.ticketId, status: result.status, response: result.response } });
});

verificationRoutes.post('/ipe-clearance', async (req, res) => {
  const body = z.object({
    tracking_id: z.string().trim().min(1).max(20),
    ipe_type: z.enum([
      'get_old_tracking_id',
      'inprocessing_error',
      'tracking_is_being_processed',
      'modification_ipe',
      'hit_blocked'
    ]),
    ...pinField
  }).parse(req.body);
  await requirePinConfirmation(req.user!.id, body.pin);
  const result = await submitIpeClearance({
    userId: req.user!.id,
    trackingId: body.tracking_id,
    ipeType: body.ipe_type,
    idempotencyKey: idempotencyKeyFrom(req)
  });
  res.json({ status: true, data: { reference: result.reference, ticket_id: result.ticketId, balance_after: result.balanceAfter } });
});

verificationRoutes.get('/ipe-clearance/:ticketId', async (req, res) => {
  const result = await checkIpeClearanceStatus({ userId: req.user!.id, ticketId: req.params.ticketId });
  res.json({ status: true, data: { ticket_id: result.ticketId, status: result.status, response: result.response } });
});
