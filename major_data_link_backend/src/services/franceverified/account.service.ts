import { franceVerifiedGet } from './client.js';

/**
 * Docs: https://www.franceverified.com/api-docs/account
 *       https://www.franceverified.com/api-docs/transactions
 */
export function getBalance() {
  return franceVerifiedGet('/user/balance');
}

export type FvTransactionService = 'airtime' | 'data' | 'cable' | 'electricity' | 'nin' | 'bvn';

export function getTransactions(params?: { service?: FvTransactionService; limit?: number }) {
  return franceVerifiedGet('/user/transactions', {
    service: params?.service,
    limit: params?.limit !== undefined ? String(params.limit) : undefined
  });
}
