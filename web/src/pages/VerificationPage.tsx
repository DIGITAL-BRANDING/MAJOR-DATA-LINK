import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fingerprint,
  IdCard,
  PenLine,
  Phone,
  SearchCheck,
  ShieldCheck,
  UserRoundCheck,
  Download,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';
import { extractIdentityFields, identityFieldRows } from '../lib/identity-fields';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

type Mode = 'nin' | 'bvn';
type Item = {
  id: string;
  label: string;
  path: string;
  fields: string[];
  icon: typeof IdCard;
  tiers?: string[];
  /** Sync = one POST returns the finished slip/PDF immediately.
   *  Async = POST returns a ticket_id; an admin at Techhub processes it,
   *  and GET {path}/{ticket_id} is polled for the outcome. */
  async?: boolean;
};
type PriceRow = { service: string; unitPrice: number; isActive: boolean };

// Shown on the form for services where an admin (not an automated provider)
// does the actual work, so there's no instant pass/fail and no refund path
// once submitted - the person needs to know that *before* they pay, not
// after a support ticket. Keyed by Item['id']; only services that are
// genuinely non-refundable and admin-processed are listed here.
const NON_REFUNDABLE_NOTICE: Record<string, { serviceName: string; etaLabel: string }> = {
  validation: { serviceName: 'VALIDATION', etaLabel: '24hrs to 5 working days' },
  personalization: { serviceName: 'PERSONALIZATION', etaLabel: 'within 24hrs' },
  ipe: { serviceName: 'IPE', etaLabel: 'within 24hrs' },
};

const nin: Item[] = [
  { id: 'by-nin', label: 'NIN Verification', path: '/verification/nin/by-nin', fields: ['nin'], icon: IdCard, tiers: ['premium', 'standard', 'regular', 'vnin', 'personal'] },
  // Same underlying NIN-by-NIN lookup as 'by-nin' above, but each tile is
  // permanently pinned to one provider (see NIN_VERIFICATION_V1/V2 in
  // verification.service.ts) instead of following whatever ServicePricing.provider
  // an admin last configured. When Techhub or FranceVerified is having network
  // trouble, the user can just tap the other tile - no admin has to notice
  // and flip a setting mid-outage.
  { id: 'verification-v1', label: 'NIN Verification V1', path: '/verification/nin/verification-v1', fields: ['nin'], icon: IdCard },
  { id: 'verification-v2', label: 'NIN Verification V2', path: '/verification/nin/verification-v2', fields: ['nin'], icon: SearchCheck },
  { id: 'by-phone', label: 'NIN by Phone', path: '/verification/nin/by-phone', fields: ['phone'], icon: Phone, tiers: ['premium', 'standard', 'regular', 'personal'] },
  { id: 'demographic', label: 'NIN Demographic', path: '/verification/nin/by-demographic', fields: ['firstname', 'lastname', 'dob', 'gender'], icon: UserRoundCheck },
  { id: 'validation', label: 'NIN Validation', path: '/verification/nin-validation', fields: ['nin', 'validation_type'], icon: SearchCheck, async: true },
  { id: 'modification', label: 'NIN Modification', path: '/verification/nin-validation', fields: ['nin'], icon: PenLine, async: true },
  { id: 'personalization', label: 'NIN Personalization', path: '/verification/personalization', fields: ['tracking_id'], icon: UserRoundCheck, async: true },
  { id: 'delinking', label: 'Self Service Delinking', path: '/verification/delinking', fields: ['nin', 'email'], icon: ShieldCheck, async: true },
  { id: 'ipe', label: 'IPE Clearance', path: '/verification/ipe-clearance', fields: ['tracking_id'], icon: ShieldCheck, async: true },
];
const bvn: Item[] = [
  { id: 'slip', label: 'BVN Verification', path: '/verification/bvn/slip', fields: ['bvn'], icon: Fingerprint, tiers: ['premium', 'standard'] },
  { id: 'retrieval', label: 'BVN Retrieval', path: '/verification/bvn-retrieval', fields: ['first_name', 'last_name', 'phone_number'], icon: Phone, async: true },
  { id: 'license-onboarding', label: 'BVN License Onboarding', path: '/verification/bvn/license-onboarding', fields: ['agent_location', 'agent_bvn', 'account_number', 'bank_name', 'first_name', 'last_name', 'email', 'phone_number', 'date_of_birth', 'address', 'lga', 'state_of_residence', 'geo_political_zone'], icon: UserRoundCheck },
];

// Every validation_type Techhub's nin_validation.php accepts (see the zod
// enum `ninValidationType` in verification.routes.ts), each priced under its
// own service key now (NIN_VALIDATION_* in verification.service.ts) instead
// of the one flat rate this used to charge regardless of type.
const VALIDATION_TYPES: { value: string; label: string; serviceKey: string }[] = [
  { value: 'nin_validation', label: 'General validation', serviceKey: 'NIN_VALIDATION_GENERAL' },
  { value: 'no_record', label: 'No record found', serviceKey: 'NIN_VALIDATION_NO_RECORD' },
  { value: 'sim', label: 'SIM validation', serviceKey: 'NIN_VALIDATION_SIM' },
  { value: 'bank_validation', label: 'Bank validation', serviceKey: 'NIN_VALIDATION_BANK' },
  { value: 'update_records', label: 'Update records', serviceKey: 'NIN_VALIDATION_UPDATE_RECORDS' },
  { value: 'modification', label: 'Modification validation', serviceKey: 'NIN_VALIDATION_MODIFICATION' },
  { value: 'photo_error', label: 'Photographic error', serviceKey: 'NIN_VALIDATION_PHOTO_ERROR' },
  { value: 'v.nin_validation', label: 'v.NIN validation', serviceKey: 'NIN_VALIDATION_VNIN' },
];

const labels: Record<string, string> = {
  nin: 'NIN number',
  bvn: 'BVN number',
  phone: 'Registered phone',
  firstname: 'First name',
  lastname: 'Last name',
  first_name: 'First name',
  last_name: 'Last name',
  phone_number: 'Registered phone',
  email: 'Email address',
  dob: 'Date of birth',
  gender: 'Gender',
  validation_type: 'Validation type',
  tracking_id: 'Tracking ID',
  agent_location: 'Agent location',
  agent_bvn: 'Agent BVN',
  account_number: 'Account number',
  bank_name: 'Bank name',
  date_of_birth: 'Date of birth',
  address: 'Residential address',
  lga: 'Local Government Area (LGA)',
  state_of_residence: 'State of residence',
  geo_political_zone: 'Geo-political zone',
};

const GEO_POLITICAL_ZONES = ['North Central', 'North East', 'North West', 'South East', 'South South', 'South West'] as const;

function keyFor(item: Item, tier = 'premium') {
  const name = tier.toUpperCase();
  if (item.id === 'by-nin') return tier === 'personal' ? 'NIN_PERSONAL_INFO_SLIP' : `NIN_SLIP_${name}`;
  if (item.id === 'by-phone') return tier === 'personal' ? 'NIN_PHONE_PERSONAL_INFO_SLIP' : `NIN_PHONE_SLIP_${name}`;
  if (item.id === 'slip') return `BVN_SLIP_${name}`;
  return (
    {
      demographic: 'NIN_DEMOGRAPHIC',
      'verification-v1': 'NIN_VERIFICATION_V1',
      'verification-v2': 'NIN_VERIFICATION_V2',
      // 'validation' has no single key any more - each of the 8
      // validation_type choices is its own priced service (see
      // VALIDATION_TYPES above). Resolved separately in selectedPrice below.
      personalization: 'NIN_PERSONALIZATION',
      delinking: 'NIN_DELINKING',
      ipe: 'IPE_CLEARANCE',
      retrieval: 'BVN_RETRIEVAL',
      'license-onboarding': 'BVN_LICENSE_ONBOARDING',
    } as Record<string, string>
  )[item.id];
}

function validationServiceKey(validationType?: string) {
  return VALIDATION_TYPES.find((t) => t.value === (validationType ?? 'nin_validation'))?.serviceKey ?? 'NIN_VALIDATION_GENERAL';
}

const money = (amount?: number) =>
  amount === undefined ? 'Price loading…' : `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

const NIN_SLIP_IMAGES: Record<string, string> = {
  premium: '/branding/premium slip.jpg',
  standard: '/branding/standard slip.jpg',
  regular: '/branding/regular slip.jpg',
  vnin: '/branding/Vnin slip.jpg',
  personal: '/branding/information slip.jpg',
};

type SlipResult = { user_data?: Record<string, unknown>; reference: string; transaction_id: string; document_available: boolean };
type AsyncResult = { ticket_id: string; reference: string };
type TicketStatus = { ticket_id: string; status: 'pending' | 'success' | 'failed'; response: Record<string, unknown> | null };
type VerificationHistory = {
  transaction_id: string;
  reference: string;
  status: string;
  created_at: string;
  document_available: boolean;
  ticket_id: string | null;
  delivery_id: string | null;
};

export default function VerificationPage({ mode, initialService }: { mode: Mode; initialService?: string }) {
  const nav = useNavigate();
  const items = mode === 'nin' ? nin : bvn;

  const [selected, setSelected] = useState<Item | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [tier, setTier] = useState('premium');
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [slipResult, setSlipResult] = useState<SlipResult | null>(null);
  const [asyncResult, setAsyncResult] = useState<AsyncResult | null>(null);
  const [ticketStatus, setTicketStatus] = useState<TicketStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [history, setHistory] = useState<VerificationHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [licenseConsent, setLicenseConsent] = useState(false);
  const [initialApplied, setInitialApplied] = useState(false);
  const [showValidationNotice, setShowValidationNotice] = useState(false);
  const ticketRequestInFlight = useRef(false);

  useEffect(() => {
    if (!initialService || initialApplied) return;
    const item = items.find((candidate) => candidate.id === initialService);
    if (item?.id === 'modification') nav('/nin-modification');
    else if (item) { setSelected(item); setTier('premium'); setValues(item.id === 'validation' ? { validation_type: 'nin_validation' } : {}); }
    setInitialApplied(true);
  }, [initialApplied, initialService, items, nav]);

  useEffect(() => {
    api
      .get<{ data?: PriceRow[] } | PriceRow[]>('/verification/prices')
      .then((result) => {
        const rows = Array.isArray(result) ? result : (result.data ?? []);
        setPrices(Object.fromEntries(rows.map((row) => [row.service, Number(row.unitPrice)])));
      })
      .catch(() => setMessage('Unable to load current prices. Please refresh and try again.'));
  }, []);

  const selectedPrice = useMemo(() => {
    if (!selected) return undefined;
    if (selected.id === 'license-onboarding') return 10000;
    if (selected.id === 'validation') return prices[validationServiceKey(values.validation_type)];
    return prices[keyFor(selected, tier)];
  }, [selected, tier, prices, values.validation_type]);
  const selectedServiceKey = selected ? (selected.id === 'validation' ? validationServiceKey(values.validation_type) : keyFor(selected, tier)) : '';

  // Stable across renders (selectedServiceKey only changes when the user
  // picks a different service) so it's safe to call directly from submit()
  // and the ticket-status poll below, not just the effect that watches for
  // a service change. Previously this was inline in that one effect only,
  // which meant a just-submitted request (or one that just finished
  // processing) never appeared in "Recent requests" until something else
  // happened to re-trigger it - in practice, only a full page reload
  // reliably did, which read as "I have to refresh 3+ times."
  const refreshHistory = useCallback(() => {
    if (!selectedServiceKey) {
      setHistory([]);
      return () => {};
    }
    let active = true;
    setLoadingHistory(true);
    api
      .get<{ status: boolean; data: VerificationHistory[] }>(`/verification/history?service=${encodeURIComponent(selectedServiceKey)}`)
      .then((result) => {
        if (active) setHistory(result.data ?? []);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => {
      active = false;
    };
  }, [selectedServiceKey]);

  useEffect(() => refreshHistory(), [refreshHistory]);

  // NIN Validation is handled by NIMC and is not an instant verification.
  // Show this before a user enters a NIN or confirms their PIN each time the
  // service is opened, including a direct /verification/nin-validation link.
  useEffect(() => {
    setShowValidationNotice(selected?.id === 'validation');
  }, [selected?.id]);

  // Set of ticket_ids currently being checked, so only that row's button
  // shows a spinner (not every row in the list).
  const [checkingTicket, setCheckingTicket] = useState<Set<string>>(new Set());

  // Async services (NIN Validation, Personalization, Delinking, IPE
  // Clearance, BVN Retrieval) only ever get their status updated when
  // something actively polls the provider - the automatic poll in
  // checkTicket() below only runs while the user is looking at the
  // just-submitted result. Once they navigate away, or come back later to
  // "Recent requests", a still-pending entry had no way to move forward
  // except a background reconciliation job. This calls the same
  // GET `${path}/:ticketId` status endpoint the fresh-submission view uses,
  // which (per checkAsyncServiceStatus on the backend) also persists a
  // success/failed result to the transaction - so refreshHistory() below
  // picks up the real status immediately instead of waiting on a worker.
  const checkHistoryStatus = useCallback(
    async (entry: VerificationHistory) => {
      if (!selected || !entry.ticket_id) return;
      setCheckingTicket((prev) => new Set(prev).add(entry.ticket_id!));
      try {
        await api.get(`${selected.path}/${entry.ticket_id}`);
      } catch {
        // Swallow - a transient failure here just means the row keeps
        // showing its last known status; the user can press the button again.
      } finally {
        setCheckingTicket((prev) => {
          const next = new Set(prev);
          next.delete(entry.ticket_id!);
          return next;
        });
        refreshHistory();
      }
    },
    [selected, refreshHistory]
  );

  function choose(item: Item) {
    if (item.id === 'modification') {
      nav('/nin-modification');
      return;
    }
    resetResult();
    setSelected(item);
    setTier('premium');
    setLicenseConsent(false);
    // Pre-select the general (cheapest, no-op) validation type so a real
    // price shows immediately instead of "Price loading…" the moment the
    // form opens - same reasoning as tier defaulting to 'premium' above.
    setValues(item.id === 'validation' ? { validation_type: 'nin_validation' } : {});
    setMessage('');
  }

  function resetResult() {
    setSlipResult(null);
    setAsyncResult(null);
    setTicketStatus(null);
    setMessage('');
    // A fresh purchase attempt - not a retry of the last one - so it must
    // get its own Idempotency-Key. See idempotencyKeyRef below.
    idempotencyKeyRef.current = null;
  }

  // Kept stable across repeated submit() calls for the *same* attempt (e.g.
  // the user re-entering their PIN after a timeout/error) so a retry lands
  // on purchaseSlip's debit.reused replay path server-side instead of
  // debiting the wallet twice for one slip. Cleared in resetResult()/choose()
  // whenever the user starts an actually new purchase.
  const idempotencyKeyRef = useRef<string | null>(null);

  async function submit(pin: string) {
    if (!selected) return;
    setShowPin(false);
    setBusy(true);
    setMessage('');
    try {
      const data = {
        ...values,
        ...(selected.tiers ? { tier } : {}),
        ...(selected.id === 'license-onboarding' ? { consent: licenseConsent } : {}),
        pin,
      };
      const isSlipPurchase = !selected.async && selected.id !== 'license-onboarding';
      const result = isSlipPurchase
        ? await api.postSlip<{
            status: boolean;
            message: string;
            data?: { reference: string; tracking_id?: string; transaction_id?: string; document_available?: boolean; user_data?: Record<string, unknown>; ticket_id?: string };
          }>(selected.path, data, (idempotencyKeyRef.current ??= api.newIdempotencyKey()))
        : await api.post<{
            status: boolean;
            message: string;
      data?: { reference: string; tracking_id?: string; transaction_id?: string; document_available?: boolean; user_data?: Record<string, unknown>; ticket_id?: string };
      }>(selected.path, data);
      if (!result.status) throw new Error(result.message);

      if (selected.id === 'license-onboarding') {
        setMessage(`Request submitted successfully. Tracking ID: ${result.data?.tracking_id ?? result.data?.reference ?? 'pending'}`);
        setAsyncResult({ ticket_id: result.data?.tracking_id ?? result.data?.reference ?? '', reference: result.data?.reference ?? '' });
      } else if (selected.async) {
        if (!result.data?.ticket_id) throw new Error('No ticket was returned - please contact support.');
        setAsyncResult({ ticket_id: result.data.ticket_id, reference: result.data.reference });
        setMessage('Request submitted. We\u2019ll check its status below - this is usually reviewed within a few minutes.');
      } else {
        setSlipResult({
          user_data: result.data?.user_data,
          reference: result.data?.reference ?? '',
          transaction_id: result.data?.transaction_id ?? '',
          document_available: Boolean(result.data?.document_available),
        });
        setMessage(result.message || 'Done - your document is ready below.');
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
      refreshHistory();
    }
  }

  async function checkTicket(silent = false) {
    if (!selected || !asyncResult) return;
    // The automatic six-second poll must not start another provider request
    // while the last one is still pending.
    if (ticketRequestInFlight.current) return;
    ticketRequestInFlight.current = true;
    if (!silent) setPolling(true);
    try {
      const result = await api.get<{ status: boolean; data: TicketStatus }>(`${selected.path}/${asyncResult.ticket_id}`);
      setTicketStatus(result.data);
      if (result.data.status === 'success' || result.data.status === 'failed') refreshHistory();
    } catch {
      // transient failures just mean "still can't tell yet" - the poll loop will retry
    } finally {
      if (!silent) setPolling(false);
      ticketRequestInFlight.current = false;
    }
  }

  useEffect(() => {
    if (!asyncResult || selected?.id === 'license-onboarding' || ticketStatus?.status === 'success' || ticketStatus?.status === 'failed') return;
    void checkTicket(true);
    const id = setInterval(() => void checkTicket(true), 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncResult, ticketStatus?.status, selected?.id]);

  function prepare(event: FormEvent) {
    event.preventDefault();
    setShowPin(true);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => {
            if (selected) {
              setSelected(null);
              resetResult();
            } else {
              nav('/dashboard');
            }
          }}
          className="font-body text-sm font-semibold text-gold-700"
        >
          ← {selected ? 'All services' : 'Dashboard'}
        </button>

        <header className="mt-5 rounded-2xl border border-parchment-line bg-parchment p-6">
          <p className="font-body text-sm font-semibold text-gold-700">Identity services</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">{mode === 'nin' ? 'NIN Services' : 'BVN Services'}</h1>
          <p className="mt-2 font-body text-sm text-ink-600">
            Select a service, see its current price, then continue securely with your transaction PIN.
          </p>
        </header>

        {!selected ? (
          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const Icon = item.icon;
              const from =
                item.id === 'license-onboarding'
                  ? 10000
                  : item.id === 'validation'
                  ? Math.min(...VALIDATION_TYPES.map((t) => prices[t.serviceKey] ?? Infinity))
                  : prices[keyFor(item, item.tiers?.[0] ?? 'premium')];
              return (
                <button
                  key={item.id}
                  onClick={() => choose(item)}
                  className="group flex min-h-40 flex-col items-center justify-center rounded-2xl border border-[#8b6914] bg-[#6b4f0b] p-4 text-center shadow-md shadow-[#6b4f0b]/20 transition hover:-translate-y-1 hover:bg-[#8a6712] hover:shadow-lg"
                >
                  <span className="rounded-xl bg-[#f7d774] p-3 text-[#4a3505] shadow-sm">
                    <Icon size={26} />
                  </span>
                  <span className="mt-3 font-body text-sm font-semibold text-white">{item.label}</span>
                  <span className="mt-1 font-body text-sm font-bold text-[#ffe9a3]">
                    {item.id === 'license-onboarding'
                      ? money(10000)
                      : item.id === 'modification'
                      ? 'From ₦5,000'
                      : item.id === 'validation'
                        ? `From ${money(Number.isFinite(from) ? from : undefined)}`
                        : money(from)}
                  </span>
                </button>
              );
            })}
          </section>
        ) : (
          <section className="mt-6 rounded-2xl border border-parchment-line bg-parchment p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-bold text-ink">{selected.label}</h2>
              <span className="rounded-full bg-gold-500/15 px-4 py-2 font-body text-sm font-bold text-gold-700">
                Service cost: {money(selectedPrice)}
              </span>
            </div>

            {NON_REFUNDABLE_NOTICE[selected.id] && !slipResult && !asyncResult && (
              <div className="mt-4 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <div className="font-body text-sm text-ink">
                    <p className="font-bold">
                      NOTE: {NON_REFUNDABLE_NOTICE[selected.id].serviceName} IS NOT REFUNDABLE. Ensure all details are correct before submission.
                    </p>
                    <p className="mt-1.5">
                      After submitting, proceed to check history below. (Status usually updates within 10-30mins)
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-ink-600">
                      <Clock size={13} /> Typical completion time: {NON_REFUNDABLE_NOTICE[selected.id].etaLabel}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!slipResult && !asyncResult && (
              <form onSubmit={prepare} className="mt-5 grid gap-4 sm:grid-cols-2">
                {selected.fields.map((field) => (
                  <label key={field} className="font-body text-sm font-medium text-ink-600">
                    {labels[field]}
                    {field === 'gender' ? (
                      <select
                        required
                        className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                        value={values[field] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                      >
                        <option value="">Select gender</option>
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                      </select>
                    ) : field === 'validation_type' ? (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {VALIDATION_TYPES.map((t) => (
                          <button
                            key={t.value}
                            type="button"
                            onClick={() => setValues((v) => ({ ...v, [field]: t.value }))}
                            className={`rounded-xl border p-3 text-left text-xs font-semibold transition ${values[field] === t.value || (!values[field] && t.value === 'nin_validation') ? 'border-[#8b6914] bg-[#6b4f0b] text-white' : 'border-parchment-line bg-cream text-ink hover:border-gold-500'}`}
                          >
                            <span className="block">{t.label}</span>
                            <span className={`mt-1 block text-[11px] font-bold ${values[field] === t.value || (!values[field] && t.value === 'nin_validation') ? 'text-[#ffe9a3]' : 'text-gold-700'}`}>
                              {money(prices[t.serviceKey])}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : field === 'geo_political_zone' ? (
                      <select
                        required
                        className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                        value={values[field] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                      >
                        <option value="">Select your zone</option>
                        {GEO_POLITICAL_ZONES.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                      </select>
                    ) : (
                      <input
                        required
                        type={field === 'dob' || field === 'date_of_birth' ? 'date' : field === 'email' ? 'email' : 'text'}
                        inputMode={field === 'agent_bvn' || field === 'account_number' || field === 'phone_number' ? 'numeric' : undefined}
                        maxLength={field === 'agent_bvn' || field === 'phone_number' ? 11 : field === 'account_number' ? 12 : undefined}
                        placeholder={field === 'agent_bvn' ? '11-digit BVN' : field === 'account_number' ? 'Account number' : undefined}
                        className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                        value={values[field] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
                {selected.tiers && (
                  <div className="sm:col-span-2 font-body text-sm font-medium text-ink-600">
                    <span>Slip type</span>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {selected.tiers.map((option) => <button key={option} type="button" onClick={() => setTier(option)} className={`rounded-xl border p-3 text-center transition hover:-translate-y-0.5 ${tier === option ? 'border-[#8b6914] bg-[#6b4f0b] text-white shadow-md' : 'border-parchment-line bg-cream text-ink hover:border-gold-500'}`}><img src={NIN_SLIP_IMAGES[option]} alt={`${option} slip preview`} className="mx-auto h-14 w-full rounded-lg bg-white object-contain p-1"/><span className="mt-2 block font-semibold">{option === 'vnin' ? 'V-NIN Slip' : option === 'personal' ? 'Personal Info Slip' : `${option[0].toUpperCase() + option.slice(1)} Slip`}</span><span className={`mt-1 block text-xs font-bold ${tier === option ? 'text-[#ffe9a3]' : 'text-gold-700'}`}>{money(prices[keyFor(selected, option)])}</span></button>)}
                    </div>
                  </div>
                )}
                {selected.id === 'license-onboarding' && (
                  <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-parchment-line bg-cream p-4 font-body text-sm text-ink-600">
                    <input
                      required
                      type="checkbox"
                      checked={licenseConsent}
                      onChange={(e) => setLicenseConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[#b8941f]"
                    />
                    <span>I confirm that the information is accurate and I authorize K-Tech Solutions to submit this BVN Licence onboarding request on my behalf.</span>
                  </label>
                )}
                <div className="sm:col-span-2">
                  <button
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink disabled:opacity-60"
                  >
                    {busy ? <><Loader2 size={16} className="animate-spin" /> Verifying your request…</> : 'Continue to PIN confirmation'}
                  </button>
                  {busy && <p role="status" className="mt-3 text-center font-body text-sm text-ink-600">Wannan na iya ɗaukar ƴan dakiku. Kada ku rufe wannan shafin.</p>}
                  {message && <p className="mt-3 rounded-lg bg-cream p-3 font-body text-sm text-ink-600">{message}</p>}
                </div>
              </form>
            )}

            {slipResult && (
              <SlipResultView
                result={slipResult}
                message={message}
                mode={mode}
                onDone={() => {
                  setSelected(null);
                  resetResult();
                }}
              />
            )}

            {asyncResult && selected.id !== 'license-onboarding' && (
              <AsyncResultView
                ticket={asyncResult}
                status={ticketStatus}
                polling={polling}
                message={message}
                mode={mode}
                onRefresh={() => checkTicket(false)}
                onDone={() => {
                  setSelected(null);
                  resetResult();
                }}
              />
            )}

            {asyncResult && selected.id === 'license-onboarding' && (
              <div className="mt-6 rounded-xl border border-gold-300 bg-gold-50 p-5 font-body text-sm text-ink">
                <p className="font-bold">BVN License request submitted</p>
                <p className="mt-2">Tracking ID: <span className="font-bold">{asyncResult.ticket_id}</span></p>
                <p className="mt-1 text-ink-600">₦10,000 has been deducted from your wallet. Admin will update the request status.</p>
              </div>
            )}

            <VerificationHistoryView
              history={history}
              loading={loadingHistory}
              checkingRef={checkingTicket}
              onCheckStatus={(entry) => void checkHistoryStatus(entry)}
            />
          </section>
        )}
      </div>

      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={submit} />
      <NinValidationNotice open={showValidationNotice} onClose={() => setShowValidationNotice(false)} />
    </AppShell>
  );
}

function NinValidationNotice({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nin-validation-notice-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 text-center shadow-2xl sm:p-8"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border-2 border-sky-400 text-3xl font-semibold text-sky-500">i</div>
        <h2 id="nin-validation-notice-title" className="mt-5 font-display text-2xl font-bold text-ink">Important Service Notice</h2>
        <div className="mt-5 space-y-4 font-body text-sm leading-6 text-ink-600">
          <p>NIN Validation is a NIMC service for a NIN that is inactive, not working, or showing “Record Not Found”.</p>
          <p>Most requests are completed within 48 working hours.</p>
          <p><strong className="text-ink">Modification Validation</strong> is for a name, date of birth, or phone number that NIMC has updated but is still showing old details. These requests can take up to two weeks, depending on NIMC.</p>
        </div>
        <button type="button" onClick={onClose} className="mt-7 rounded-lg bg-gold-500 px-5 py-2.5 font-body text-sm font-bold text-ink shadow-sm hover:bg-gold-600">
          I Understand
        </button>
      </section>
    </div>
  );
}

function VerificationHistoryView({
  history,
  loading,
  checkingRef,
  onCheckStatus,
}: {
  history: VerificationHistory[];
  loading: boolean;
  checkingRef: Set<string>;
  onCheckStatus: (entry: VerificationHistory) => void;
}) {
  return (
    <section className="mt-8 border-t border-parchment-line pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-bold text-ink">Recent requests</h3>
        <span className="font-body text-xs text-ink-600">Available for 24 hours</span>
      </div>
      {loading ? (
        <p className="mt-3 font-body text-sm text-ink-600">Loading recent requests…</p>
      ) : history.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-parchment-line px-4 py-4 font-body text-sm text-ink-600">
          No request for this service in the last 24 hours.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-parchment-line overflow-hidden rounded-xl border border-parchment-line bg-cream">
          {history.map((entry) => {
            // Only ticket-based async services (NIN Validation, Personalization,
            // Delinking, IPE Clearance, BVN Retrieval) get a "Check status"
            // button - synchronous slip purchases (NIN/BVN by NIN/Phone/
            // Demographic) resolve immediately and have no ticket_id to poll.
            // A terminal status (success/failed) is also excluded: it's
            // already final, nothing left to check.
            const canCheckStatus = Boolean(entry.ticket_id) && entry.status !== 'success' && entry.status !== 'failed';
            const isChecking = entry.ticket_id ? checkingRef.has(entry.ticket_id) : false;
            return (
              <div key={entry.reference} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-ink">{entry.reference}</p>
                  <p className="mt-1 font-body text-xs text-ink-600">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
                {entry.delivery_id ? (
                  <button
                    type="button"
                    onClick={() => void downloadAdminDelivery(entry.delivery_id!, entry.reference)}
                    className="flex items-center gap-2 rounded-lg bg-gold-500 px-3 py-2 font-body text-xs font-bold text-ink"
                  >
                    <Download size={14} /> Download file
                  </button>
                ) : entry.document_available ? (
                  <button
                    type="button"
                    onClick={() => void downloadServiceDocument(entry.transaction_id, entry.reference)}
                    className="flex items-center gap-2 rounded-lg bg-gold-500 px-3 py-2 font-body text-xs font-bold text-ink"
                  >
                    <Download size={14} /> Retrieve PDF
                  </button>
                ) : canCheckStatus ? (
                  <div className="flex items-center gap-3">
                    <span className="font-body text-xs font-semibold capitalize text-ink-600">{entry.status}</span>
                    <button
                      type="button"
                      disabled={isChecking}
                      onClick={() => onCheckStatus(entry)}
                      className="flex items-center gap-2 rounded-lg border border-gold-500 px-3 py-2 font-body text-xs font-bold text-ink disabled:opacity-60"
                    >
                      <RefreshCw size={14} className={isChecking ? 'animate-spin' : undefined} />
                      {isChecking ? 'Checking…' : 'Check status'}
                    </button>
                  </div>
                ) : (
                  <span className="font-body text-xs font-semibold capitalize text-ink-600">{entry.status}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SlipResultView({ result, message, mode, onDone }: { result: SlipResult; message: string; mode: Mode; onDone: () => void }) {
  const fields = extractIdentityFields(result.user_data, mode === 'nin' ? 'NIN' : 'BVN');
  const rows = identityFieldRows(fields);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-500/5 px-4 py-3">
        <CheckCircle2 size={18} className="shrink-0 text-success-500" />
        <p className="font-body text-sm text-ink">{message}</p>
      </div>

      {(rows.length > 0 || fields.photo) && (
        <div className="mt-4 grid gap-4 rounded-xl bg-cream p-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex min-w-0 justify-between gap-3 border-b border-parchment-line py-1.5 text-sm">
              <span className="font-body text-ink-600">{row.label}</span>
              <span className="break-all text-right font-body font-semibold text-ink">{row.value}</span>
            </div>
          ))}
          </div>
          {fields.photo && <img src={fields.photo} alt="Verified identity photograph" className="h-44 w-40 rounded-lg border border-parchment-line bg-white object-cover p-1" />}
        </div>
      )}

      {result.document_available && result.transaction_id && (
        <button
          type="button"
          onClick={() => void downloadServiceDocument(result.transaction_id, result.reference || 'slip')}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink"
        >
          <Download size={16} /> Download PDF slip
        </button>
      )}

      {!result.document_available && (
        <p className="mt-4 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 font-body text-sm text-ink-600">
          The provider confirmed this request, but did not return a downloadable PDF. Keep the reference above and contact support; do not submit or pay for the request again.
        </p>
      )}

      <button onClick={onDone} className="mt-3 w-full rounded-xl border border-parchment-line py-2.5 font-body text-sm text-ink-600">
        Done
      </button>
    </div>
  );
}

async function downloadServiceDocument(transactionId: string, reference: string) {
  try {
    const pdf = await api.getFile(`/transactions/${encodeURIComponent(transactionId)}/service-document`);
    const url = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reference}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    window.alert('Could not download this slip. Please try again from Service History.');
  }
}

// For requests an admin completed by hand and attached a result file to
// (see completeRequest() in admin/manual-verification.ts - NIN Modification
// and any other request that has no provider to auto-generate a PDF from).
// Same download mechanism as DeliveriesPage.tsx: a short-lived signed URL,
// not an inline blob, since the file can be up to 10MB and isn't held in
// this page's own transaction-document endpoint.
async function downloadAdminDelivery(deliveryId: string, reference: string) {
  try {
    const result = await api.get<{ data: { url: string; file_name: string } }>(`/deliveries/${deliveryId}/download`);
    const link = document.createElement('a');
    link.href = result.data.url;
    link.download = result.data.file_name || reference;
    link.target = '_blank';
    link.click();
  } catch {
    window.alert('Could not download this file. Please try again, or open it from Deliveries in the menu.');
  }
}

function AsyncResultView({
  ticket,
  status,
  polling,
  message,
  mode,
  onRefresh,
  onDone,
}: {
  ticket: AsyncResult;
  status: TicketStatus | null;
  polling: boolean;
  message: string;
  mode: Mode;
  onRefresh: () => void;
  onDone: () => void;
}) {
  const state = status?.status ?? 'pending';
  const identityFields = status?.response ? extractIdentityFields(status.response, mode === 'bvn' ? 'BVN' : 'NIN') : {};
  const rows = identityFieldRows(identityFields);
  // Anything left over that isn't one of the curated identity fields above
  // and isn't a nested object/array (which would otherwise render as the
  // useless literal text "[object Object]") - e.g. a provider-specific
  // status note worth keeping visible even though it has no dedicated row.
  const extraEntries = status?.response
    ? Object.entries(status.response).filter(
        ([, v]) => typeof v === 'string' && v.trim() && !Object.values(identityFields).includes(v)
      )
    : [];

  return (
    <div className="mt-6">
      {message && <p className="mb-4 rounded-lg bg-cream p-3 font-body text-sm text-ink-600">{message}</p>}

      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-4 ${
          state === 'success'
            ? 'border-success-500/30 bg-success-500/5'
            : state === 'failed'
              ? 'border-ember-500/30 bg-ember-500/5'
              : 'border-parchment-line bg-cream'
        }`}
      >
        {state === 'success' ? (
          <CheckCircle2 size={22} className="text-success-500" />
        ) : state === 'failed' ? (
          <XCircle size={22} className="text-ember-500" />
        ) : (
          <Clock size={22} className="text-gold-600" />
        )}
        <div>
          <p className="font-display font-semibold text-ink">
            {state === 'success' ? 'Approved' : state === 'failed' ? 'Rejected — refunded to your wallet' : 'Pending review'}
          </p>
          <p className="font-mono text-xs text-ink-600">Ticket: {ticket.ticket_id}</p>
        </div>
      </div>

      {(rows.length > 0 || identityFields.photo || extraEntries.length > 0) && (
        <div className="mt-4 grid gap-4 rounded-xl bg-cream p-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="flex min-w-0 justify-between gap-3 border-b border-parchment-line py-1.5 text-sm">
                <span className="font-body text-ink-600">{row.label}</span>
                <span className="break-all text-right font-body font-semibold text-ink">{row.value}</span>
              </div>
            ))}
            {extraEntries.map(([key, value]) => (
              <div key={key} className="flex min-w-0 justify-between gap-3 border-b border-parchment-line py-1.5 text-sm">
                <span className="font-body capitalize text-ink-600">{key.replace(/_/g, ' ')}</span>
                <span className="break-all text-right font-body font-semibold text-ink">{String(value)}</span>
              </div>
            ))}
          </div>
          {identityFields.photo && <img src={identityFields.photo} alt="Verified identity photograph" className="h-44 w-40 rounded-lg border border-parchment-line bg-white object-cover p-1" />}
        </div>
      )}

      {state === 'pending' && (
        <button
          onClick={onRefresh}
          disabled={polling}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-parchment-line py-2.5 font-body text-sm text-ink-600 disabled:opacity-60"
        >
          {polling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Check again now
        </button>
      )}
      <p className="mt-2 text-center font-body text-[11px] text-ink-400">
        We're also checking automatically every few seconds.
      </p>

      <button onClick={onDone} className="mt-3 w-full rounded-xl border border-parchment-line py-2.5 font-body text-sm text-ink-600">
        Done
      </button>
    </div>
  );
}
