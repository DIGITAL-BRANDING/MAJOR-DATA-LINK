import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { getKycStatus, listSupportedBanks, verifyBvnAndActivateWallet } from '../services/kyc.service.js';

export const kycRoutes = Router();

kycRoutes.use(requireAuth);

kycRoutes.get('/status', async (req, res) => {
  const status = await getKycStatus(req.user!.id);
  res.json({
    status: true,
    data: {
      kyc_status: status.kycStatus.toLowerCase(),
      kyc_failure_reason: status.kycFailureReason,
      bvn_last4: status.bvnLast4,
      bvn_verified_at: status.bvnVerifiedAt,
      virtual_account_number: status.virtualAccountNumber,
      virtual_account_bank: status.virtualAccountBank
    }
  });
});

kycRoutes.get('/banks', async (_req, res) => {
  const banks = await listSupportedBanks();
  res.json({ status: true, data: banks });
});

kycRoutes.post('/bvn', async (req, res) => {
  const body = z
    .object({
      bvn: z.string().trim().length(11, 'BVN must be exactly 11 digits'),
      bank_code: z.string().trim().min(1, 'bank_code is required'),
      account_number: z.string().trim().length(10, 'Account number must be exactly 10 digits')
    })
    .parse(req.body);

  const result = await verifyBvnAndActivateWallet({
    userId: req.user!.id,
    bvn: body.bvn,
    bankCode: body.bank_code,
    accountNumber: body.account_number
  });

  res.json({
    status: true,
    message: 'Wallet activated successfully',
    data: {
      kyc_status: result.kycStatus.toLowerCase(),
      virtual_account_number: result.virtualAccountNumber,
      virtual_account_bank: result.virtualAccountBank
    }
  });
});
