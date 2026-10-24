import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    partnerServiceAccess: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    partnerServicePrice: { findUnique: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn(), upsert: vi.fn() }
  }
}));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));

import { resolvePartnerServicePrice, setPartnerServiceAccess } from '../partner-service-pricing.service.js';

describe('partner service access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.partnerServiceAccess.findUnique.mockResolvedValue(null);
    prismaMock.partnerServicePrice.findUnique.mockResolvedValue(null);
  });

  it('keeps services enabled by default and uses shared pricing', async () => {
    await expect(resolvePartnerServicePrice('partner-1', 'NIN_VERIFICATION', 150)).resolves.toBe(150);
  });

  it('applies a partner-specific price while enabled', async () => {
    prismaMock.partnerServiceAccess.findUnique.mockResolvedValue({ isEnabled: true });
    prismaMock.partnerServicePrice.findUnique.mockResolvedValue({ priceKobo: 12345n });
    await expect(resolvePartnerServicePrice('partner-1', 'NIN_VERIFICATION', 150)).resolves.toBe(123.45);
  });

  it('rejects billing when the service is disabled', async () => {
    prismaMock.partnerServiceAccess.findUnique.mockResolvedValue({ isEnabled: false });
    await expect(resolvePartnerServicePrice('partner-1', 'NIN_VERIFICATION', 150)).rejects.toMatchObject({
      statusCode: 403,
      code: 'PARTNER_SERVICE_DISABLED'
    });
  });

  it('saves partner service access independently of price overrides', async () => {
    prismaMock.partnerServiceAccess.upsert.mockResolvedValue({ isEnabled: false });
    await setPartnerServiceAccess('partner-1', 'NIN_VERIFICATION', false);
    expect(prismaMock.partnerServiceAccess.upsert).toHaveBeenCalledWith({
      where: { partnerId_service: { partnerId: 'partner-1', service: 'NIN_VERIFICATION' } },
      create: { partnerId: 'partner-1', service: 'NIN_VERIFICATION', isEnabled: false },
      update: { isEnabled: false }
    });
  });
});
