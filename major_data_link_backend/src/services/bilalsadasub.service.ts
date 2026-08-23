import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';
import { dataPlanPricingService } from './data-plan-pricing.service.js';
import type { DataPlan } from './data-plans.data.js';
import type { NormalizedProviderResponse, NormalizedResultPinResponse } from './provider-types.js';

const PROVIDER = 'bilalsadasub';

// Confirmed from the BilalSadaSub API docs (Network reference table,
// /api/v1/plans/networks). T2 is BilalSadaSub's ID for 9mobile - not
// documented anywhere as such explicitly, only inferable from it being the
// 4th of exactly 4 "real" networks alongside MTN/AIRTEL/GLO, matching this
// app's own 4-network scope (see NetworkProvider in the Flutter app and
// Alrahuz's own NETWORK_IDS in provider.service.ts). VITEL (id 5) has no
// equivalent in this app's NetworkProvider enum and is deliberately left
// unmapped - a purchase for it would fail fast with "unsupported network"
// rather than silently guessing.
const NETWORK_IDS: Record<string, number> = { MTN: 1, AIRTEL: 2, GLO: 3, '9MOBILE': 4 };

// exam_id values from the docs' /api/v1/plans/exams reference (JAMB UTME/
// UTME MOCK/DIRECT ENTRY - ids 4-6 - are deliberately omitted: this app
// doesn't support JAMB anywhere else (no ExamPinType/TransactionType/UI for
// it), and JAMB pins need extra fields - profile_code, jamb_type - this
// service's buyResultPin() doesn't collect).
const EXAM_IDS: Record<'WAEC' | 'NECO' | 'NABTEB', number> = { WAEC: 1, NECO: 2, NABTEB: 3 };

// Cable provider reference table from the docs.
const CABLE_IDS: Record<'DSTV' | 'GOTV' | 'STARTIME', number> = { DSTV: 2, GOTV: 1, STARTIME: 3 };

// Distribution company reference table from the docs, keyed by the
// abbreviations app_config.dart's `electricityProviders` list actually
// sends (IKEDC, EKEDC, etc.) rather than BilalSadaSub's own full names -
// this is the ONE place that mapping needs to happen. EEDC (Enugu) and
// BEDC (Benin) are in that Flutter-side list for parity with other
// providers/coverage completeness, but BilalSadaSub doesn't offer either
// at all - selecting one fails fast with a clear "unsupported" error from
// discoId() below rather than silently mis-routing to a random disco.
const DISCO_IDS: Record<string, number> = {
  IKEDC: 1, // Ikeja Electric
  EKEDC: 2, // Eko Electric
  KEDCO: 3, // Kano Electric
  PHEDC: 4, // Port Harcourt Electric
  JED: 5, // Jos Electric
  IBEDC: 6, // Ibadan Electric
  KAEDCO: 7, // Kaduna Electric
  AEDC: 8 // Abuja Electric
};

type BilalResponse = {
  status?: string | boolean; // "success" | "fail" | "process" on documented endpoints; the two UNVERIFIED validate endpoints might return a plain boolean instead
  message?: string;
  'request-id'?: string;
  amount?: number | string;
  oldbal?: number | string;
  newbal?: number | string;
  token?: string; // electricity
  units?: string; // electricity
  pins?: { pin: string; serial?: string }[]; // result pins
  AccessToken?: string; // /api/user only
  balance?: string; // /api/user only
  [key: string]: unknown;
};

// ---- Auth: username+password -> cached AccessToken ----
// Unlike Alrahuz's ALRAHUZ_API_TOKEN (a static value pasted into env vars),
// BilalSadaSub's docs describe generating a token from credentials once and
// reusing it - it reads like a long-lived reseller API key rather than a
// short-lived JWT, so this caches it in memory indefinitely and only
// re-generates on an explicit 401 from a real API call, rather than on a
// timer. That cache is per-process (lost on every Railway restart/deploy) -
// acceptable since generating a fresh one is a single cheap call.
let cachedToken: string | null = null;
let pendingTokenRequest: Promise<string> | null = null;

function credentialsConfigured() {
  return Boolean(env.BILALSADASUB_USERNAME && env.BILALSADASUB_PASSWORD);
}

async function generateToken(): Promise<string> {
  if (!credentialsConfigured()) {
    throw new ApiError(500, 'BilalSadaSub is not configured', 'BILALSADASUB_NOT_CONFIGURED');
  }

  const basic = Buffer.from(`${env.BILALSADASUB_USERNAME}:${env.BILALSADASUB_PASSWORD}`).toString('base64');
  const response = await fetch(`${env.BILALSADASUB_BASE_URL}/api/user`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' }
  });
  const body = (await response.json().catch(() => ({}))) as BilalResponse;

  if (!response.ok || body.status !== 'success' || !body.AccessToken) {
    console.error('[bilalsadasub] token generation failed', { httpStatus: response.status, body });
    throw new ApiError(502, 'Could not authenticate with BilalSadaSub', 'BILALSADASUB_AUTH_FAILED');
  }

  cachedToken = body.AccessToken;
  return cachedToken;
}

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  // Several purchase requests can land while the very first token
  // generation is still in flight (e.g. a burst of requests right after a
  // cold start) - share one in-flight request instead of firing one
  // /api/user call per concurrent caller.
  if (!pendingTokenRequest) {
    pendingTokenRequest = generateToken().finally(() => {
      pendingTokenRequest = null;
    });
  }
  return pendingTokenRequest;
}

/**
 * POSTs to any BilalSadaSub endpoint with the cached token, transparently
 * regenerating the token and retrying ONCE if the first attempt comes back
 * 401 (token expired/rotated on their end - "Rotate it from Pricing → API
 * token if it leaks" in the docs implies tokens CAN change server-side).
 */
async function authedPost(path: string, body: Record<string, unknown>, retried = false): Promise<BilalResponse> {
  const token = await getToken();
  const response = await fetch(`${env.BILALSADASUB_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (response.status === 401 && !retried) {
    cachedToken = null;
    return authedPost(path, body, true);
  }

  return (await response.json().catch(() => ({}))) as BilalResponse;
}

/** Discovery endpoints (`/api/v1/plans/*`) are explicitly documented as
 * public - no Authorization header needed or sent. */
async function publicGet(path: string): Promise<BilalResponse> {
  const response = await fetch(`${env.BILALSADASUB_BASE_URL}${path}`);
  return (await response.json().catch(() => ({}))) as BilalResponse;
}

function networkId(network: string): number {
  const id = NETWORK_IDS[network.toUpperCase()];
  if (!id) throw new ApiError(422, `Unsupported network for BilalSadaSub: ${network}`, 'UNSUPPORTED_NETWORK');
  return id;
}

/**
 * Every purchase-style BilalSadaSub response shares one shape (see the
 * docs' "Common patterns" section): status "success"/"fail"/"process",
 * message, oldbal/newbal. amount/oldbal/newbal are all sent as strings OR
 * numbers inconsistently across the doc's own examples, hence Number(...)
 * rather than assuming either.
 *
 * "process" is NOT a confirmed success (`status` stays `false`), but it is
 * also NOT a confirmed failure - BilalSadaSub is telling us the request is
 * still being worked on their end, and this app has no requery endpoint
 * confirmed/available to poll it later (see provider-reconciliation.service.ts's
 * doc-comment). Treating it the same as an outright "fail" - i.e. refunding
 * the customer immediately - risks the provider ALSO fulfilling the
 * purchase afterward: the customer gets both a refund and the data/token/
 * cable renewal, and the company eats the cost with no transaction to
 * charge it against. So `pending: true` is set here instead, and every
 * caller (cable.routes.ts, electricity.routes.ts, vtu.routes.ts's
 * processProviderPurchase, result-pin.service.ts) must check it and route
 * to manual admin reconciliation instead of auto-refunding.
 */
function normalize(body: BilalResponse): NormalizedProviderResponse {
  const success = body.status === 'success';
  const pending = !success && body.status === 'process';
  const oldbal = body.oldbal !== undefined ? Number(body.oldbal) : undefined;
  const newbal = body.newbal !== undefined ? Number(body.newbal) : undefined;
  const costKobo =
    success && oldbal !== undefined && newbal !== undefined && Number.isFinite(oldbal) && Number.isFinite(newbal)
      ? BigInt(Math.round((oldbal - newbal) * 100))
      : undefined;

  return {
    status: success,
    pending,
    providerRef: body['request-id'],
    message: body.message ?? (success ? 'Transaction processed' : pending ? 'Transaction is still processing' : 'Transaction failed'),
    costKobo
  };
}

// ---- Data ----

// BilalSadaSub's own docs only ever show `plan_type` paired WITH `network`
// in every example (`?network=MTN&plan_type=GIFTING`) - never network
// alone. In production, fetching with just `network` and no `plan_type`
// silently returned an incomplete catalog (missing plans users could
// confirm existed) rather than every type merged together, contradicting
// the docs' "and/or" framing of the filter. Fetching each known type
// explicitly and merging is the reliable way to get the full catalog.
//
// The docs' own filter EXAMPLE mentioned "SME, GIFTING, COOPERATE GIFTING"
// - but that turned out to just be illustrative wording, not the real
// category list: BilalSadaSub's own reseller dashboard (Buy Data ->
// Category step) shows the actual tabs as PROMO, SME, DAILY, WEEKLY,
// MONTHLY, 2-MONTHLY. This list is confirmed against that UI. It's still
// not guaranteed to be the exact literal `plan_type` string their API
// stores for every one of these (display label vs. stored value can
// differ, e.g. "2-MONTHLY" vs "2MONTHLY"), so an unfiltered network-only
// call is ALSO fetched and merged in below as a safety net for any type
// whose exact string doesn't match one of these.
const KNOWN_DATA_PLAN_TYPES = ['PROMO', 'SME', 'DAILY', 'WEEKLY', 'MONTHLY', '2-MONTHLY'];

async function fetchLiveDataPlans(network: string): Promise<DataPlan[]> {
  const [unfiltered, ...byType] = await Promise.all([
    fetchLiveDataPlansForType(network),
    ...KNOWN_DATA_PLAN_TYPES.map((planType) => fetchLiveDataPlansForType(network, planType))
  ]);

  const byPlanId = new Map<string, DataPlan>();
  for (const plans of [unfiltered, ...byType]) {
    for (const plan of plans) byPlanId.set(plan.id, plan);
  }
  return Array.from(byPlanId.values());
}

async function fetchLiveDataPlansForType(network: string, planType?: string): Promise<DataPlan[]> {
  const query = new URLSearchParams({ network: network.toUpperCase() });
  if (planType) query.set('plan_type', planType);
  const body = await publicGet(`/api/v1/plans/data?${query.toString()}`);

  if (body.status !== 'success' || !Array.isArray(body.data)) {
    console.error('[bilalsadasub] unexpected data-plans response shape', { network, planType, body });
    return [];
  }

  // Diagnostic: lets us see, per requested plan_type, exactly how many
  // rows BilalSadaSub actually returned - a guessed plan_type string that
  // doesn't match what their API expects shows up here as 0 (or the same
  // count as the unfiltered call, if they're silently ignoring an unknown
  // plan_type rather than filtering by it), instead of silently vanishing
  // into the merged/deduped final list with no trace of why.
  console.log(`[bilalsadasub] ${network} plan_type=${planType ?? '(none)'}: ${body.data.length} raw row(s)`);
  if (!planType) {
    // The unfiltered call's own rows reveal the REAL plan_type vocabulary
    // BilalSadaSub's API actually stores, as ground truth - independent of
    // whatever labels their dashboard UI's filter tabs show.
    const rawTypes = new Set((body.data as Record<string, unknown>[]).map((row) => String(row.plan_type ?? '(missing)')));
    console.log(`[bilalsadasub] ${network} unfiltered call's actual plan_type values seen: ${[...rawTypes].join(', ')}`);
  }

  return (body.data as Record<string, unknown>[]).map((row) => ({
    id: String(row.plan_id),
    networkId: networkId(network),
    // plan_type isn't folded into the name here the way Alrahuz's raw
    // names sometimes are - applyPricing()'s planTypeFrom() only reads a
    // "TYPE - rest" prefix, so it's added explicitly to make plan_type
    // (SME/GIFTING/COOPERATE GIFTING) actually show up as a category.
    // Falls back to the requested planType (if any) when the row itself
    // doesn't echo one back, and finally to 'OTHER' for the fully
    // unfiltered call so an uncategorized plan still gets SOME grouping
    // rather than silently losing its "TYPE - " prefix (which would make
    // planTypeFrom() treat it as having no category at all).
    name: `${row.plan_type ?? planType ?? 'OTHER'} - ${row.plan_name}`,
    amount: Number(row.amount),
    validity: typeof row.plan_day === 'string' ? row.plan_day : '30 days'
  }));
}

const planCache = new Map<
  string,
  { expiresAt: number; plans: Awaited<ReturnType<typeof dataPlanPricingService.applyPricing>> }
>();
const CACHE_MS = 15 * 60 * 1000;

async function getAllDataPlans(network: string) {
  const key = network.toUpperCase();
  const cached = planCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.plans;

  const rawPlans = await fetchLiveDataPlans(network);
  console.log(`[bilalsadasub] ${key}: ${rawPlans.length} plan(s) after merging unfiltered + per-type fetches`);
  const priced = await dataPlanPricingService.applyPricing(rawPlans, key, PROVIDER);
  planCache.set(key, { expiresAt: Date.now() + CACHE_MS, plans: priced });
  return priced;
}

export async function getDataPlans(network: string, category?: string) {
  const plans = await getAllDataPlans(network);
  if (!category) return plans;
  const normalized = category.trim().toUpperCase();
  return plans.filter((plan) => (plan.planType ?? '').toUpperCase() === normalized);
}

export async function getDataPlanCategories(network: string) {
  const plans = await getAllDataPlans(network);
  const counts = new Map<string, number>();
  for (const plan of plans) {
    const type = plan.planType?.trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([category, count]) => ({ category, count }));
}

export async function getDataPlan(network: string, planId: string) {
  const plans = await getAllDataPlans(network);
  const plan = plans.find((p) => p.id === planId);
  if (!plan) throw new ApiError(404, 'Data plan not found', 'PLAN_NOT_FOUND');
  return plan;
}

export async function buyData(input: { network: string; phone: string; planId: string; reference: string }) {
  const body = await authedPost('/api/data', {
    network: networkId(input.network),
    phone: input.phone,
    data_plan: Number(input.planId),
    'request-id': input.reference
  });
  return normalize(body);
}

// ---- Airtime ----

export async function buyAirtime(input: { network: string; phone: string; amount: number; reference: string }) {
  const body = await authedPost('/api/topup', {
    network: networkId(input.network),
    phone: input.phone,
    amount: input.amount,
    plan_type: 'VTU',
    'request-id': input.reference
  });
  return normalize(body);
}

// ---- Result pins (WAEC/NECO/NABTEB only - see EXAM_IDS comment) ----

export async function buyResultPin(input: {
  examType: 'WAEC' | 'NECO' | 'NABTEB';
  quantity: number;
  reference: string;
}): Promise<NormalizedResultPinResponse> {
  const examId = EXAM_IDS[input.examType];
  const body = await authedPost('/api/exam', {
    exam_id: examId,
    quantity: input.quantity,
    'request-id': input.reference
  });

  const pins = Array.isArray(body.pins) ? body.pins.map((p) => p.pin) : undefined;
  return {
    ...normalize(body),
    pin: pins?.[0],
    pins,
    serial: Array.isArray(body.pins) ? body.pins[0]?.serial : undefined,
    raw: body
  };
}

// ---- Cable TV ----

export async function listCableProviders() {
  return Object.entries(CABLE_IDS).map(([name, id]) => ({ id, name }));
}

export async function getCablePlans(cable: string) {
  const body = await publicGet(`/api/v1/plans/cable?cable=${encodeURIComponent(cable.toUpperCase())}`);
  if (body.status !== 'success' || !Array.isArray(body.data)) {
    console.error('[bilalsadasub] unexpected cable-plans response shape', { cable, body });
    return [];
  }
  return (body.data as Record<string, unknown>[]).map((row) => ({
    planId: String(row.plan_id),
    cableName: String(row.cable_name),
    planName: String(row.plan_name),
    amount: Number(row.plan_price)
  }));
}

function cableId(cable: string): number {
  const id = CABLE_IDS[cable.toUpperCase() as keyof typeof CABLE_IDS];
  if (!id) throw new ApiError(422, `Unsupported cable provider: ${cable}`, 'UNSUPPORTED_CABLE');
  return id;
}

/**
 * UNVERIFIED - the docs' cable page mentions "Validate IUC first to avoid
 * charging the wrong customer" with a link, but that link's actual
 * endpoint/request/response shape wasn't captured in the screenshots this
 * integration was built from. This guesses the most consistent shape given
 * every OTHER documented endpoint's pattern (POST, JSON body, `status`),
 * and normalizes whatever comes back so a shape mismatch fails safely -
 * "could not validate" - rather than throwing past the caller. CONFIRM
 * against BilalSadaSub's real docs/support before relying on this for
 * fraud prevention; until then, treat a "valid" result as a nice-to-have
 * customer-name confirmation, not a guarantee.
 */
export async function validateSmartcard(input: { cable: string; iuc: string }) {
  try {
    const body = await authedPost('/api/cable/validate', { cable: cableId(input.cable), iuc: input.iuc });
    const success = body.status === 'success' || body.status === true;
    const name = (body.name ?? body.customer_name ?? (body.data as Record<string, unknown> | undefined)?.customer_name) as
      | string
      | undefined;
    return { isValid: success && Boolean(name), customerName: name ?? '' };
  } catch (error) {
    console.error('[bilalsadasub] IUC validation request failed', error);
    return { isValid: false, customerName: '' };
  }
}

export async function buyCable(input: {
  cable: string;
  iuc: string;
  planId: string;
  phone?: string;
  reference: string;
}) {
  const body = await authedPost('/api/cable', {
    cable: cableId(input.cable),
    iuc: input.iuc,
    plan_id: Number(input.planId),
    ...(input.phone ? { phone: input.phone } : {}),
    'request-id': input.reference
  });
  return normalize(body);
}

// ---- Electricity ----

export async function listDiscos() {
  return Object.entries(DISCO_IDS).map(([name, id]) => ({ id, name }));
}

function discoId(disco: string): number {
  const id = DISCO_IDS[disco.toUpperCase()];
  if (!id) throw new ApiError(422, `Unsupported electricity distribution company: ${disco}`, 'UNSUPPORTED_DISCO');
  return id;
}

/**
 * UNVERIFIED - same caveat as validateSmartcard above: the docs mention
 * "Validate meter first" but the endpoint itself wasn't captured. Confirm
 * before relying on it for fraud prevention.
 */
export async function validateMeter(input: { disco: string; meter: string; meterType: 'prepaid' | 'postpaid' }) {
  try {
    const body = await authedPost('/api/bill/validate', {
      disco: discoId(input.disco),
      meter: input.meter,
      meter_type: input.meterType
    });
    const success = body.status === 'success' || body.status === true;
    const data = body.data as Record<string, unknown> | undefined;
    const name = (body.name ?? body.customer_name ?? data?.customer_name) as string | undefined;
    const address = (body.address ?? data?.address) as string | undefined;
    return { isValid: success && Boolean(name), customerName: name ?? '', address: address ?? '' };
  } catch (error) {
    console.error('[bilalsadasub] meter validation request failed', error);
    return { isValid: false, customerName: '', address: '' };
  }
}

export async function buyElectricity(input: {
  disco: string;
  meterType: 'prepaid' | 'postpaid';
  meter: string;
  amount: number;
  phone?: string;
  reference: string;
}): Promise<NormalizedProviderResponse & { token?: string; units?: string }> {
  const body = await authedPost('/api/bill', {
    disco: discoId(input.disco),
    meter_type: input.meterType,
    meter: input.meter,
    amount: input.amount,
    ...(input.phone ? { phone: input.phone } : {}),
    'request-id': input.reference
  });
  return { ...normalize(body), token: body.token, units: body.units };
}
