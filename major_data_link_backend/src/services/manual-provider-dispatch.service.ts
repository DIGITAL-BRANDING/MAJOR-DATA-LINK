import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';
import { mergeSealedPII, openPII } from '../lib/pii.js';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { env } from '../config/env.js';
import { techhubService } from './techhub.service.js';
import { getVerificationPrice, type IpeClearanceType, type VerificationServiceKey } from './verification.service.js';
import { submitNinValidationFV } from './franceverified-nin-validation-adapter.service.js';
import { submitIpeClearanceFV } from './franceverified-ipe-adapter.service.js';

export type ManualDispatchProvider = 'techhub' | 'franceverified';
type Capabilities = Partial<Record<ManualDispatchProvider, true>>;

const SERVICE_PROVIDERS: Record<string, Capabilities> = {
  NIN_DELINKING: { techhub: true },
  NIN_VALIDATION_GENERAL: { techhub: true, franceverified: true },
  NIN_VALIDATION_NO_RECORD: { techhub: true, franceverified: true },
  NIN_VALIDATION_BANK: { techhub: true, franceverified: true },
  NIN_VALIDATION_MODIFICATION: { techhub: true, franceverified: true },
  NIN_VALIDATION_PHOTO_ERROR: { techhub: true, franceverified: true },
  NIN_VALIDATION_VNIN: { techhub: true, franceverified: true },
  NIN_VALIDATION_SIM: { techhub: true },
  NIN_VALIDATION_UPDATE_RECORDS: { techhub: true },
  NIN_PERSONALIZATION: { techhub: true },
  BVN_RETRIEVAL: { techhub: true },
  IPE_CLEARANCE: { techhub: true, franceverified: true }
};

export function manualDispatchProviders(service: string): ManualDispatchProvider[] {
  const supported = SERVICE_PROVIDERS[service];
  if (!supported) return [];
  return (['techhub', 'franceverified'] as const).filter((provider) => supported[provider]);
}

export function manualDispatchProviderConfigured(service: string, provider: ManualDispatchProvider): boolean {
  if (!manualDispatchProviders(service).includes(provider)) return false;
  if (provider === 'franceverified') return Boolean(env.FRANCEVERIFIED_API_KEY);
  const serviceNeedsBvn = service.startsWith('BVN_');
  return Boolean(serviceNeedsBvn
    ? env.TECHHUB_BVN_API_KEY || env.TECHHUB_API_KEY
    : env.TECHHUB_NIN_API_KEY || env.TECHHUB_API_KEY);
}

function serviceAndOperational(metadata: Record<string, unknown>) {
  const service = typeof metadata.service === 'string' ? metadata.service : '';
  if (!manualDispatchProviders(service).length) throw new ApiError(422, 'This manual service has no configured ticket-based provider endpoint.', 'MANUAL_PROVIDER_UNAVAILABLE');
  return { service, validationType: typeof metadata.validation_type === 'string' ? metadata.validation_type : 'nin_validation', ipeType: typeof metadata.ipe_type === 'string' ? metadata.ipe_type as IpeClearanceType : 'inprocessing_error' };
}

function requiredString(pii: Record<string, unknown>, key: string) {
  const value = pii[key];
  if (typeof value !== 'string' || !value.trim()) throw new ApiError(422, `The saved request is missing ${key.replace(/_/g, ' ')}.`, 'MANUAL_REQUEST_DATA_MISSING');
  return value.trim();
}

async function submitToProvider(service: string, provider: ManualDispatchProvider, metadata: Record<string, unknown>, pii: Record<string, unknown>) {
  const { validationType, ipeType } = serviceAndOperational(metadata);
  if (!manualDispatchProviderConfigured(service, provider)) throw new ApiError(422, `${provider === 'techhub' ? 'Techhub' : 'FranceVerified'} is not configured or does not support this service.`, 'MANUAL_PROVIDER_UNAVAILABLE');
  switch (service) {
    case 'NIN_DELINKING':
      return techhubService.submitDelinking(requiredString(pii, 'nin'), requiredString(pii, 'email'));
    case 'NIN_VALIDATION_GENERAL':
    case 'NIN_VALIDATION_NO_RECORD':
    case 'NIN_VALIDATION_SIM':
    case 'NIN_VALIDATION_BANK':
    case 'NIN_VALIDATION_UPDATE_RECORDS':
    case 'NIN_VALIDATION_MODIFICATION':
    case 'NIN_VALIDATION_PHOTO_ERROR':
    case 'NIN_VALIDATION_VNIN':
      return provider === 'franceverified'
        ? submitNinValidationFV(requiredString(pii, 'nin'), validationType)
        : techhubService.submitNinValidation(requiredString(pii, 'nin'), validationType);
    case 'NIN_PERSONALIZATION':
      return techhubService.submitPersonalization(requiredString(pii, 'tracking_id'));
    case 'BVN_RETRIEVAL':
      return techhubService.submitBvnRetrieval({
        first_name: requiredString(pii, 'first_name'),
        last_name: requiredString(pii, 'last_name'),
        phone_number: requiredString(pii, 'phone_number')
      });
    case 'IPE_CLEARANCE':
      return provider === 'franceverified'
        ? submitIpeClearanceFV(requiredString(pii, 'tracking_id'), ipeType)
        : techhubService.submitIpeClearance(requiredString(pii, 'tracking_id'), ipeType);
    default:
      throw new ApiError(422, 'This service has no supported ticket-based provider endpoint.', 'MANUAL_PROVIDER_UNAVAILABLE');
  }
}

async function claimManualDispatch(params: { source: 'customer' | 'partner'; id: string; provider: ManualDispatchProvider }) {
  const isPartner = params.source === 'partner';
  const current = isPartner
    ? await prisma.partnerTransaction.findUnique({ where: { id: params.id } })
    : await prisma.transaction.findUnique({ where: { id: params.id } });
  if (!current || current.type !== TransactionType.IDENTITY_SERVICE_REQUEST || current.status !== TransactionStatus.PENDING || current.provider !== 'manual') {
    throw new ApiError(409, 'This request is no longer waiting for manual provider dispatch.', 'MANUAL_REQUEST_NOT_PENDING');
  }
  const metadata = (current.metadata as Record<string, unknown> | null) ?? {};
  const { service } = serviceAndOperational(metadata);
  if (!manualDispatchProviderConfigured(service, params.provider)) {
    throw new ApiError(422, 'The selected provider is not configured or has no endpoint for this service.', 'MANUAL_PROVIDER_UNAVAILABLE');
  }
  const pii = openPII<Record<string, unknown>>(metadata.pii);
  if (!pii) throw new ApiError(422, 'The saved request details could not be decrypted.', 'MANUAL_REQUEST_DATA_MISSING');

  const startedAt = new Date().toISOString();
  // Validate current pricing before contacting a paid provider, so a missing
  // pricing row cannot turn a successful upstream submission into an orphan.
  const price = await getVerificationPrice(service as VerificationServiceKey, { forPartner: isPartner, ...(service === 'IPE_CLEARANCE' ? { ipeType: typeof metadata.ipe_type === 'string' ? metadata.ipe_type as IpeClearanceType : 'inprocessing_error' } : {}) });
  const claimMetadata = { ...metadata, manual_dispatch: { provider: params.provider, status: 'sending', started_at: startedAt } } as Prisma.InputJsonValue;
  const claimed = isPartner
    ? await prisma.partnerTransaction.updateMany({ where: { id: params.id, status: TransactionStatus.PENDING, provider: 'manual' }, data: { provider: 'manual_dispatching', metadata: claimMetadata } })
    : await prisma.transaction.updateMany({ where: { id: params.id, status: TransactionStatus.PENDING, provider: 'manual' }, data: { provider: 'manual_dispatching', metadata: claimMetadata } });
  if (claimed.count !== 1) throw new ApiError(409, 'Another admin is already dispatching this request.', 'MANUAL_REQUEST_DISPATCHING');

  let accepted = false;
  try {
    const result = await submitToProvider(service, params.provider, metadata, pii);
    if (!result.ok || !result.ticketId) throw new ApiError(502, result.message || 'The provider did not accept this request.', 'MANUAL_PROVIDER_SUBMIT_FAILED');
    accepted = true;
    const updatedMetadata = {
      ...metadata,
      ticket_id: result.ticketId,
      manual_processing: false,
      manual_dispatch: { provider: params.provider, status: 'submitted', started_at: startedAt, submitted_at: new Date().toISOString() },
      pii: mergeSealedPII(metadata.pii, { submit_raw: result.raw })
    } as Prisma.InputJsonValue;
    if (isPartner) {
      await prisma.partnerTransaction.update({ where: { id: params.id }, data: { provider: params.provider, providerRef: result.ticketId, costKobo: price.providerCostKobo, metadata: updatedMetadata } });
    } else {
      await prisma.transaction.update({ where: { id: params.id }, data: { provider: params.provider, providerRef: result.ticketId, costKobo: price.providerCostKobo, metadata: updatedMetadata } });
    }
    return { service, provider: params.provider, ticketId: result.ticketId };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not dispatch this request.';
    if (accepted) {
      // Keep the dispatch lock if the provider accepted but the local ticket
      // could not be recorded. This prevents a second paid submission.
      const recoveryMetadata = { ...metadata, manual_dispatch: { provider: params.provider, status: 'accepted_unrecorded', started_at: startedAt, error: message } } as Prisma.InputJsonValue;
      if (isPartner) await prisma.partnerTransaction.update({ where: { id: params.id }, data: { provider: 'manual_dispatching', metadata: recoveryMetadata } });
      else await prisma.transaction.update({ where: { id: params.id }, data: { provider: 'manual_dispatching', metadata: recoveryMetadata } });
    } else {
      const failedMetadata = { ...metadata, manual_dispatch: { provider: params.provider, status: 'failed', started_at: startedAt, error: message } } as Prisma.InputJsonValue;
      if (isPartner) await prisma.partnerTransaction.update({ where: { id: params.id }, data: { provider: 'manual', metadata: failedMetadata } });
      else await prisma.transaction.update({ where: { id: params.id }, data: { provider: 'manual', metadata: failedMetadata } });
    }
    throw error;
  }
}

export function dispatchManualCustomerRequest(id: string, provider: ManualDispatchProvider) {
  return claimManualDispatch({ source: 'customer', id, provider });
}

export function dispatchManualPartnerRequest(id: string, provider: ManualDispatchProvider) {
  return claimManualDispatch({ source: 'partner', id, provider });
}

export function listManualTicketServices() {
  return Object.keys(SERVICE_PROVIDERS);
}
