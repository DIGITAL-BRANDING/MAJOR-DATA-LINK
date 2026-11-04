import { describe, expect, it, vi } from 'vitest';
import { TransactionType } from '@prisma/client';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../../lib/pii.js', () => ({ openPII: vi.fn(), mergeSealedPII: vi.fn() }));
vi.mock('../../middleware/error.js', () => ({ ApiError: class extends Error {} }));
vi.mock('../notification.service.js', () => ({ notifyPartnerSafely: vi.fn() }));
vi.mock('../partner-wallet.service.js', () => ({ completePartnerPurchase: vi.fn(), reversePartnerPurchase: vi.fn() }));
vi.mock('../partner-webhook.service.js', () => ({ enqueuePartnerRequestUpdateWebhook: vi.fn(), deliverDuePartnerWebhooks: vi.fn() }));

import { isAdminManageablePartnerRequest } from '../partner-manual-admin.service.js';

describe('partner manual request queue eligibility', () => {
  it('includes identity tickets explicitly dispatched to a provider', () => {
    expect(isAdminManageablePartnerRequest({
      type: TransactionType.IDENTITY_SERVICE_REQUEST,
      provider: 'abjiktech',
      metadata: { service: 'IPE_CLEARANCE', manual_dispatch: { status: 'submitted' } }
    })).toBe(true);
  });

  it('does not include automatically routed provider requests', () => {
    expect(isAdminManageablePartnerRequest({
      type: TransactionType.IDENTITY_SERVICE_REQUEST,
      provider: 'techhub',
      metadata: { service: 'NIN_PERSONALIZATION' }
    })).toBe(false);
  });

  it('keeps NIN and BVN slip lookups out of the manual ticket queue', () => {
    expect(isAdminManageablePartnerRequest({
      type: TransactionType.NIN_VERIFICATION,
      provider: 'abjiktech',
      metadata: { manual_dispatch: { status: 'submitted' } }
    })).toBe(false);
  });
});
