/**
 * The common shape every provider integration (provider.service.ts /
 * Alrahuz, bilalsadasub.service.ts) normalizes its raw HTTP response into.
 * processProviderPurchase() in vtu.routes.ts, and the purchase flows in
 * result.routes.ts/cable.routes.ts/electricity.routes.ts, are written
 * against this shape only - never against a specific provider's raw
 * response fields - so switching PricingSettings.dataAirtimeProvider (or
 * resultPinProvider) between 'alrahuz' and 'bilalsadasub' needs no route
 * changes at all.
 */
export type NormalizedProviderResponse = {
  status: boolean;
  providerRef?: string;
  message?: string;
  /** Actual cost in kobo, when the provider's response reveals it (e.g. a
   *  balance_before/balance_after delta). Undefined means "unknown", not
   *  "free" - see the identical note on Transaction.costKobo. */
  costKobo?: bigint;
};

export type NormalizedResultPinResponse = NormalizedProviderResponse & {
  pin?: string;
  pins?: string[];
  serial?: string;
  raw?: unknown;
};
