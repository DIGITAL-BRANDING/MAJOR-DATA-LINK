import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import 'express-async-errors';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { prismaMock } = vi.hoisted(() => ({ prismaMock: { servicePricing: { findUnique: vi.fn(), create: vi.fn() } } }));

vi.mock('../../lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../../middleware/auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as unknown as { user: unknown }).user = { id: 'u1' };
    next();
  }
}));

import { verificationRoutes } from '../verification.routes.js';
import { errorHandler } from '../../middleware/error.js';

let server: Server;
let base = '';
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/verification', verificationRoutes);
  app.use(errorHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/verification`;
});
afterAll(() => {
  server.close();
});

const row = (service: string, overrides: Record<string, unknown> = {}) => ({
  service, label: service, provider: 'manual', providerCostKobo: 5_000_00n, sellingPriceKobo: null, partnerSellingPriceKobo: null, isActive: true, ...overrides
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.servicePricing.findUnique.mockImplementation(async ({ where }: { where: { service: string } }) =>
    where.service === 'BVN_LICENSE_ONBOARDING' ? row('BVN_LICENSE_ONBOARDING', { label: 'BVN License Onboarding', providerCostKobo: 10_000_00n }) : row(where.service)
  );
});

const prices = async () => ((await (await fetch(`${base}/prices`)).json()) as { data: { service: string; unitPrice: number; isActive: boolean }[] }).data;

describe('GET /verification/prices', () => {
  // Regression: the BVN Licence Creation page reads prices.BVN_LICENSE_ONBOARDING, which this
  // list never contained, so it showed "Price loading..." forever.
  it('includes the BVN Licence Onboarding price the licence page needs', async () => {
    const licence = (await prices()).find((p) => p.service === 'BVN_LICENSE_ONBOARDING');
    expect(licence).toMatchObject({ unitPrice: 10000, isActive: true });
  });

  it('uses the admin selling price when one is set', async () => {
    prismaMock.servicePricing.findUnique.mockImplementation(async ({ where }: { where: { service: string } }) =>
      where.service === 'BVN_LICENSE_ONBOARDING' ? row('BVN_LICENSE_ONBOARDING', { providerCostKobo: 10_000_00n, sellingPriceKobo: 15_000_00n }) : row(where.service)
    );
    expect((await prices()).find((p) => p.service === 'BVN_LICENSE_ONBOARDING')?.unitPrice).toBe(15000);
  });

  it('still lists the licence (flagged inactive) when it is switched off, instead of failing the whole list', async () => {
    prismaMock.servicePricing.findUnique.mockImplementation(async ({ where }: { where: { service: string } }) =>
      where.service === 'BVN_LICENSE_ONBOARDING' ? row('BVN_LICENSE_ONBOARDING', { isActive: false }) : row(where.service)
    );
    const list = await prices();
    expect(list.find((p) => p.service === 'BVN_LICENSE_ONBOARDING')?.isActive).toBe(false);
    expect(list.length).toBeGreaterThan(10); // the normal verification prices are still there
  });

  it('creates the default ₦10,000 row on first use', async () => {
    prismaMock.servicePricing.findUnique.mockImplementation(async ({ where }: { where: { service: string } }) => (where.service === 'BVN_LICENSE_ONBOARDING' ? null : row(where.service)));
    prismaMock.servicePricing.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => row(String(data.service), { ...data }));
    expect((await prices()).find((p) => p.service === 'BVN_LICENSE_ONBOARDING')?.unitPrice).toBe(10000);
  });
});
