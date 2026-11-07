import { describe, expect, it, vi } from 'vitest';
import { TransactionType } from '@prisma/client';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
vi.mock('../../config/env.js', () => ({ env: { PUBLIC_WEB_URL: 'https://example.test' } }));
vi.mock('../../lib/email.js', () => ({ sendAdminEmail: vi.fn() }));
vi.mock('../../lib/pii.js', () => ({ openPII: vi.fn() }));

import { isManualWorkItem } from '../manual-requests.js';
import { isManualRequestSubmission } from '../../services/manual-request-admin-email.service.js';

describe('automatic NIN slips are not manual queue items', () => {
  it('does not classify an automatic Hubbu phone lookup ticket as manual work', () => {
    const row = {
      type: TransactionType.NIN_VERIFICATION,
      provider: 'hubbu',
      metadata: { mode: 'by_phone', version: 'v4', ticket_id: 'HUBBU-123' }
    };

    expect(isManualWorkItem(row)).toBe(false);
    expect(isManualRequestSubmission(row)).toBe(false);
  });

  it('keeps intentionally manual verification requests in the admin queue', () => {
    expect(isManualWorkItem({ type: TransactionType.NIN_VERIFICATION, provider: 'manual', metadata: { manual_processing: true } })).toBe(true);
    expect(isManualWorkItem({ type: TransactionType.IDENTITY_SERVICE_REQUEST, provider: 'techhub', metadata: { ticket_id: 'TK-123' } })).toBe(true);
  });
});
