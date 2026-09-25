import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';

type ZenithPayAssignmentResponse = {
  status?: boolean | string;
  response_code?: string;
  message?: string;
  accountReference?: string;
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
};

function baseUrl() {
  return env.ZENITHPAY_BASE_URL.replace(/\/+$/, '');
}

function headers() {
  if (!env.ZENITHPAY_API_KEY) {
    throw new ApiError(500, 'ZenithPay is not configured on this server', 'ZENITHPAY_NOT_CONFIGURED');
  }
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${env.ZENITHPAY_API_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
}

/**
 * ZenithPay's documented dedicated-account endpoint. The gateway requires an
 * x-www-form-urlencoded body (not JSON) and calls the bearer token an API key
 * in its dashboard. This service is server-only: the token is never returned
 * to Flutter or the web client.
 */
export const zenithpayService = {
  async assignDedicatedAccount(params: {
    bvn: string;
    accountName: string;
    firstName: string;
    lastName: string;
    email: string;
  }) {
    const body = new URLSearchParams({
      bvn: params.bvn,
      account_name: params.accountName,
      first_name: params.firstName,
      last_name: params.lastName,
      email: params.email
    });
    const response = await fetch(`${baseUrl()}/api/dedicated_account/assign`, {
      method: 'POST',
      headers: headers(),
      body: body.toString()
    });

    const data = (await response.json().catch(() => ({}))) as ZenithPayAssignmentResponse;
    const successful = data.status === true || data.status === 'success' || data.response_code === '00';
    if (!response.ok || !successful || !data.accountNumber || !data.accountName) {
      throw new ApiError(
        502,
        data.message ?? 'ZenithPay could not assign a dedicated account',
        'ZENITHPAY_DEDICATED_ACCOUNT_FAILED'
      );
    }

    return {
      accountNumber: String(data.accountNumber).trim(),
      accountName: String(data.accountName).trim(),
      bankName: data.bankName?.trim() || 'ZenithPay',
      accountReference: data.accountReference?.trim() || null
    };
  }
};
