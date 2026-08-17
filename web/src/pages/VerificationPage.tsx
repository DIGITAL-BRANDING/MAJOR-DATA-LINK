import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';
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

const nin: Item[] = [
  { id: 'by-nin', label: 'NIN Verification', path: '/verification/nin/by-nin', fields: ['nin'], icon: IdCard, tiers: ['premium', 'standard', 'regular', 'vnin'] },
  { id: 'by-phone', label: 'NIN by Phone', path: '/verification/nin/by-phone', fields: ['phone'], icon: Phone, tiers: ['premium', 'standard', 'regular'] },
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
};

function keyFor(item: Item, tier = 'premium') {
  const name = tier.toUpperCase();
  if (item.id === 'by-nin') return `NIN_SLIP_${name}`;
  if (item.id === 'by-phone') return `NIN_PHONE_SLIP_${name}`;
  if (item.id === 'slip') return `BVN_SLIP_${name}`;
  return (
    {
      demographic: 'NIN_DEMOGRAPHIC',
      validation: 'NIN_VALIDATION',
      modification: 'NIN_VALIDATION',
      personalization: 'NIN_PERSONALIZATION',
      delinking: 'NIN_DELINKING',
      ipe: 'IPE_CLEARANCE',
      retrieval: 'BVN_RETRIEVAL',
    } as Record<string, string>
  )[item.id];
}

const money = (amount?: number) =>
  amount === undefined ? 'Price loading…' : `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

type SlipResult = { user_data?: Record<string, unknown>; pdf_base64?: string; pdf_url?: string; reference: string };
type AsyncResult = { ticket_id: string; reference: string };
type TicketStatus = { ticket_id: string; status: 'pending' | 'success' | 'failed'; response: Record<string, unknown> | null };
type VerificationHistory = {
  reference: string;
  status: string;
  created_at: string;
  pdf_base64: string | null;
  pdf_url: string | null;
  ticket_id: string | null;
};

export default function VerificationPage({ mode }: { mode: Mode }) {
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

  useEffect(() => {
    api
      .get<{ data?: PriceRow[] } | PriceRow[]>('/verification/prices')
      .then((result) => {
        const rows = Array.isArray(result) ? result : (result.data ?? []);
        setPrices(Object.fromEntries(rows.map((row) => [row.service, Number(row.unitPrice)])));
      })
      .catch(() => setMessage('Unable to load current prices. Please refresh and try again.'));
  }, []);

  const selectedPrice = useMemo(() => (selected ? prices[keyFor(selected, tier)] : undefined), [selected, tier, prices]);
  const selectedServiceKey = selected ? keyFor(selected, tier) : '';

  useEffect(() => {
    if (!selectedServiceKey) {
      setHistory([]);
      return;
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

  function choose(item: Item) {
    if (item.id === 'modification') {
      nav('/nin-modification');
      return;
    }
    resetResult();
    setSelected(item);
    setTier('premium');
    setValues({});
    setMessage('');
  }

  function resetResult() {
    setSlipResult(null);
    setAsyncResult(null);
    setTicketStatus(null);
    setMessage('');
  }

  async function submit(pin: string) {
    if (!selected) return;
    setShowPin(false);
    setBusy(true);
    setMessage('');
    try {
      const data = { ...values, ...(selected.tiers ? { tier } : {}), pin };
      const result = await api.post<{
        status: boolean;
        message: string;
        data?: { reference: string; user_data?: Record<string, unknown>; pdf_base64?: string; pdf_url?: string; ticket_id?: string };
      }>(selected.path, data);
      if (!result.status) throw new Error(result.message);

      if (selected.async) {
        if (!result.data?.ticket_id) throw new Error('No ticket was returned - please contact support.');
        setAsyncResult({ ticket_id: result.data.ticket_id, reference: result.data.reference });
        setMessage('Request submitted. We\u2019ll check its status below - this is usually reviewed within a few minutes.');
      } else {
        setSlipResult({
          user_data: result.data?.user_data,
          pdf_base64: result.data?.pdf_base64,
          pdf_url: result.data?.pdf_url,
          reference: result.data?.reference ?? '',
        });
        setMessage(result.message || 'Done - your document is ready below.');
      }
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function checkTicket(silent = false) {
    if (!selected || !asyncResult) return;
    if (!silent) setPolling(true);
    try {
      const result = await api.get<{ status: boolean; data: TicketStatus }>(`${selected.path}/${asyncResult.ticket_id}`);
      setTicketStatus(result.data);
    } catch {
      // transient failures just mean "still can't tell yet" - the poll loop will retry
    } finally {
      if (!silent) setPolling(false);
    }
  }

  useEffect(() => {
    if (!asyncResult || ticketStatus?.status === 'success' || ticketStatus?.status === 'failed') return;
    void checkTicket(true);
    const id = setInterval(() => void checkTicket(true), 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asyncResult, ticketStatus?.status]);

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
              const from = prices[keyFor(item, item.tiers?.[0] ?? 'premium')];
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
                    {item.id === 'modification' ? 'From ₦5,000' : money(from)}
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
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[['modification', 'Modification'], ['nin_validation', 'General validation'], ['no_record', 'No record'], ['sim', 'SIM validation']].map(([value, label]) => <button key={value} type="button" onClick={() => setValues((v) => ({ ...v, [field]: value }))} className={`rounded-xl border px-4 py-3 text-left text-xs font-semibold transition ${values[field] === value ? 'border-[#8b6914] bg-[#6b4f0b] text-white' : 'border-parchment-line bg-cream text-ink hover:border-gold-500'}`}>{label}</button>)}
                      </div>
                    ) : (
                      <input
                        required
                        type={field === 'dob' ? 'date' : field === 'email' ? 'email' : 'text'}
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
                      {selected.tiers.map((option) => <button key={option} type="button" onClick={() => setTier(option)} className={`rounded-xl border p-4 text-center transition hover:-translate-y-0.5 ${tier === option ? 'border-[#8b6914] bg-[#6b4f0b] text-white shadow-md' : 'border-parchment-line bg-cream text-ink hover:border-gold-500'}`}><span className="block font-semibold">{option[0].toUpperCase() + option.slice(1)} Slip</span><span className={`mt-1 block text-xs font-bold ${tier === option ? 'text-[#ffe9a3]' : 'text-gold-700'}`}>{money(prices[keyFor(selected, option)])}</span></button>)}
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <button
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : 'Continue to PIN confirmation'}
                  </button>
                  {message && <p className="mt-3 rounded-lg bg-cream p-3 font-body text-sm text-ink-600">{message}</p>}
                </div>
              </form>
            )}

            {slipResult && (
              <SlipResultView
                result={slipResult}
                message={message}
                onDone={() => {
                  setSelected(null);
                  resetResult();
                }}
              />
            )}

            {asyncResult && (
              <AsyncResultView
                ticket={asyncResult}
                status={ticketStatus}
                polling={polling}
                message={message}
                onRefresh={() => checkTicket(false)}
                onDone={() => {
                  setSelected(null);
                  resetResult();
                }}
              />
            )}

            <VerificationHistoryView history={history} loading={loadingHistory} />
          </section>
        )}
      </div>

      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={submit} />
    </AppShell>
  );
}

function VerificationHistoryView({ history, loading }: { history: VerificationHistory[]; loading: boolean }) {
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
            const base64 = entry.pdf_base64?.replace(/^data:application\/pdf;base64,/i, '');
            const href = base64
              ? `data:application/pdf;base64,${base64}`
              : entry.pdf_url?.startsWith('https://')
                ? entry.pdf_url
                : null;
            return (
              <div key={entry.reference} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-xs font-semibold text-ink">{entry.reference}</p>
                  <p className="mt-1 font-body text-xs text-ink-600">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
                {href ? (
                  <a
                    href={href}
                    download={`${entry.reference}.pdf`}
                    target={base64 ? undefined : '_blank'}
                    rel={base64 ? undefined : 'noreferrer'}
                    className="flex items-center gap-2 rounded-lg bg-gold-500 px-3 py-2 font-body text-xs font-bold text-ink"
                  >
                    <Download size={14} /> Retrieve PDF
                  </a>
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

function SlipResultView({ result, message, onDone }: { result: SlipResult; message: string; onDone: () => void }) {
  const pdfBase64 = result.pdf_base64?.replace(/^data:application\/pdf;base64,/i, '');
  const pdfHref = pdfBase64
    ? `data:application/pdf;base64,${pdfBase64}`
    : result.pdf_url?.startsWith('https://')
      ? result.pdf_url
      : null;
  const dataEntries = result.user_data
    ? Object.entries(result.user_data).filter(([, v]) => v !== null && v !== undefined)
    : [];

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-500/5 px-4 py-3">
        <CheckCircle2 size={18} className="shrink-0 text-success-500" />
        <p className="font-body text-sm text-ink">{message}</p>
      </div>

      {dataEntries.length > 0 && (
        <div className="mt-4 grid gap-x-6 gap-y-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
          {dataEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between border-b border-parchment-line py-1.5 text-sm">
              <span className="font-body capitalize text-ink-600">{key.replace(/_/g, ' ')}</span>
              <span className="font-body font-semibold text-ink">{String(value)}</span>
            </div>
          ))}
        </div>
      )}

      {pdfHref && (
        <a
          href={pdfHref}
          download={`${result.reference || 'slip'}.pdf`}
          target={pdfBase64 ? undefined : '_blank'}
          rel={pdfBase64 ? undefined : 'noreferrer'}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink"
        >
          <Download size={16} /> Download PDF slip
        </a>
      )}

      {!pdfHref && (
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

function AsyncResultView({
  ticket,
  status,
  polling,
  message,
  onRefresh,
  onDone,
}: {
  ticket: AsyncResult;
  status: TicketStatus | null;
  polling: boolean;
  message: string;
  onRefresh: () => void;
  onDone: () => void;
}) {
  const state = status?.status ?? 'pending';
  const responseEntries = status?.response
    ? Object.entries(status.response).filter(([, v]) => v !== null && v !== undefined)
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

      {responseEntries.length > 0 && (
        <div className="mt-4 grid gap-x-6 gap-y-2 rounded-xl bg-cream p-4 sm:grid-cols-2">
          {responseEntries.map(([key, value]) => (
            <div key={key} className="flex justify-between border-b border-parchment-line py-1.5 text-sm">
              <span className="font-body capitalize text-ink-600">{key.replace(/_/g, ' ')}</span>
              <span className="font-body font-semibold text-ink">{String(value)}</span>
            </div>
          ))}
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
