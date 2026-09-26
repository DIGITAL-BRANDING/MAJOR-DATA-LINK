import { TransactionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ApiError } from '../middleware/error.js';
import { enqueuePartnerRequestUpdateWebhook, deliverDuePartnerWebhooks } from './partner-webhook.service.js';

export async function createPartnerRequestUpdate(params: {
  transactionId: string;
  message: string;
}) {
  const message = params.message.trim();
  if (message.length < 2 || message.length > 1_000) {
    throw new ApiError(422, 'Partner update must be between 2 and 1000 characters.', 'INVALID_PARTNER_UPDATE');
  }
  const transaction = await prisma.partnerTransaction.findUnique({
    where: { id: params.transactionId },
    select: { id: true, partnerId: true, reference: true, status: true }
  });
  if (!transaction) throw new ApiError(404, 'Partner request not found.', 'PARTNER_REQUEST_NOT_FOUND');

  const update = await prisma.partnerRequestUpdate.create({
    data: { partnerId: transaction.partnerId, partnerTransactionId: transaction.id, message }
  });
  await enqueuePartnerRequestUpdateWebhook({
    partnerId: transaction.partnerId,
    reference: transaction.reference,
    updateId: update.id,
    message: update.message,
    status: transaction.status as TransactionStatus
  });
  void deliverDuePartnerWebhooks(1).catch((error) =>
    console.error('[partner-webhooks] could not deliver request update', error)
  );
  return update;
}
