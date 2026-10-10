import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, Search, Upload } from 'lucide-react';
import AppShell from '../components/AppShell';
import { PinConfirmDialog } from '../components/PinConfirmDialog';
import { api, ApiError } from '../lib/api';

type TinType = 'company' | 'individual';
type TinPriceRow = { type: TinType; title: string; unitPrice: number; isActive: boolean };
type TinHistoryEntry = {
  reference: string;
  status: string;
  tin_type: TinType | null;
  amount: number;
  progress_notes: string | null;
  created_at: string;
  updated_at: string;
};
type CompanyDetails = { business_type: string; business_reg_no: string };
type IndividualDetails = { nin: string; first_name: string; last_name: string; middle_name: string; date_of_birth: string };
type StatusReport = { name: string; mime_type: 'application/pdf' | 'image/jpeg' | 'image/png'; base64: string };

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const money = (amount?: number) =>
  amount === undefined ? '…' : `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const STATUS_LABEL: Record<string, string> = {
  pending: 'Processing',
  success: 'Delivered',
  failed: 'Rejected',
  reversed: 'Refunded'
};
const TYPE_LABEL: Record<TinType, string> = { company: 'Company TIN', individual: 'Individual TIN' };

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * TIN Certificate. Customers pick Company or Individual, fill the fields for
 * that type, and pay from wallet. An admin files the TIN by hand and the
 * finished certificate is delivered to Deliveries. Nothing is sent to an
 * external provider.
 */
export default function TinServicesPage() {
  const [prices, setPrices] = useState<TinPriceRow[]>([]);
  const [tinType, setTinType] = useState<TinType>('company');
  const [company, setCompany] = useState<CompanyDetails>({ business_type: '', business_reg_no: '' });
  const [individual, setIndividual] = useState<IndividualDetails>({
    nin: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    date_of_birth: ''
  });
  const [statusReport, setStatusReport] = useState<StatusReport | null>(null);
  const [statusReportName, setStatusReportName] = useState('');
  const [consent, setConsent] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<TinHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [query, setQuery] = useState('');

  const selectedPrice = useMemo(() => prices.find((p) => p.type === tinType)?.unitPrice, [prices, tinType]);

  async function loadPrices() {
    try {
      const result = await api.get<{ data: TinPriceRow[] }>('/tin/prices');
      setPrices(result.data ?? []);
    } catch {
      setPrices([]);
    }
  }

  async function loadHistory(q = '') {
    setLoadingHistory(true);
    try {
      const path = q ? `/tin/history?q=${encodeURIComponent(q)}` : '/tin/history';
      const result = await api.get<{ data: TinHistoryEntry[] }>(path);
      setHistory(result.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    void loadPrices();
    void loadHistory();
  }, []);

  async function chooseStatusReport(file?: File) {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > MAX_FILE_BYTES) {
      setMessage('Use a PDF, JPG or PNG file under 4MB for the CAC status report.');
      return;
    }
    const base64 = await readAsBase64(file);
    setStatusReport({ name: file.name, mime_type: file.type as StatusReport['mime_type'], base64 });
    setStatusReportName(file.name);
  }

  function prepare(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!consent) {
      setMessage('Please tick the box to confirm your details are valid and correct.');
      return;
    }
    if (tinType === 'individual' && !/^\d{11}$/.test(individual.nin)) {
      setMessage('NIN must be 11 digits.');
      return;
    }
    setShowPin(true);
  }

  async function submit(pin: string) {
    setShowPin(false);
    setBusy(true);
    setMessage('');
    try {
      const body =
        tinType === 'company'
          ? {
              tin_type: 'company',
              business_type: company.business_type.trim(),
              business_reg_no: company.business_reg_no.trim(),
              cac_status_report: statusReport ?? undefined,
              consent: true,
              pin
            }
          : {
              tin_type: 'individual',
              nin: individual.nin.trim(),
              first_name: individual.first_name.trim(),
              last_name: individual.last_name.trim(),
              middle_name: individual.middle_name.trim() || undefined,
              date_of_birth: individual.date_of_birth,
              consent: true,
              pin
            };
      const result = await api.postSlip<{ message: string }>('/tin/submit', body, api.newIdempotencyKey());
      setMessage(result.message);
      setCompany({ business_type: '', business_reg_no: '' });
      setIndividual({ nin: '', first_name: '', last_name: '', middle_name: '', date_of_birth: '' });
      setStatusReport(null);
      setStatusReportName('');
      setConsent(false);
      void loadHistory(query);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-body text-sm text-ink outline-none focus:border-gold-500';
  const labelClass = 'block font-body text-sm font-semibold text-ink-700';

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-10">
        <h1 className="font-display text-3xl font-bold text-ink">TIN Services</h1>

        <form onSubmit={prepare} className="mt-6 space-y-5 rounded-2xl border border-parchment-line bg-parchment p-5 sm:p-6">
          <label className={labelClass}>
            Choose Service
            <select
              value={tinType}
              onChange={(e) => setTinType(e.target.value as TinType)}
              className={inputClass}
            >
              {(['company', 'individual'] as TinType[]).map((type) => {
                const row = prices.find((p) => p.type === type);
                return (
                  <option key={type} value={type} disabled={row ? !row.isActive : false}>
                    {row?.title ?? TYPE_LABEL[type]} ({money(row?.unitPrice)})
                  </option>
                );
              })}
            </select>
          </label>

          {tinType === 'company' ? (
            <>
              <label className={labelClass}>
                Business Type
                <input
                  required
                  maxLength={200}
                  value={company.business_type}
                  onChange={(e) => setCompany({ ...company, business_type: e.target.value })}
                  placeholder="Example Business Name or Company"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Business/Company Reg. No.
                <input
                  required
                  maxLength={40}
                  value={company.business_reg_no}
                  onChange={(e) => setCompany({ ...company, business_reg_no: e.target.value })}
                  placeholder="Registration number"
                  className={inputClass}
                />
              </label>
              <div className={labelClass}>
                CAC Status Report (Optional)
                <label className="mt-1 flex cursor-pointer items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-body text-sm font-normal text-ink-600">
                  <Upload size={16} />
                  <span className="truncate">{statusReportName || 'Choose a PDF, JPG or PNG (max 4MB)'}</span>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    onChange={(e) => void chooseStatusReport(e.target.files?.[0])}
                  />
                </label>
                <span className="mt-1 block text-xs text-ink-400">Clear image/document required.</span>
              </div>
            </>
          ) : (
            <>
              <label className={labelClass}>
                NIN Number
                <input
                  required
                  inputMode="numeric"
                  maxLength={11}
                  value={individual.nin}
                  onChange={(e) => setIndividual({ ...individual, nin: e.target.value.replace(/\D/g, '') })}
                  placeholder="11-digit NIN"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                First Name
                <input
                  required
                  maxLength={100}
                  value={individual.first_name}
                  onChange={(e) => setIndividual({ ...individual, first_name: e.target.value })}
                  placeholder="First name"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Last Name / Surname
                <input
                  required
                  maxLength={100}
                  value={individual.last_name}
                  onChange={(e) => setIndividual({ ...individual, last_name: e.target.value })}
                  placeholder="Last name"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Middle Name (Optional)
                <input
                  maxLength={100}
                  value={individual.middle_name}
                  onChange={(e) => setIndividual({ ...individual, middle_name: e.target.value })}
                  placeholder="Middle name"
                  className={inputClass}
                />
              </label>
              <label className={labelClass}>
                Date of Birth
                <input
                  required
                  type="date"
                  value={individual.date_of_birth}
                  onChange={(e) => setIndividual({ ...individual, date_of_birth: e.target.value })}
                  className={inputClass}
                />
              </label>
            </>
          )}

          <label className="flex items-start gap-2 font-body text-sm text-ink-600">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            By checking this box, you confirm that every information you submit is valid and correct.
          </label>

          {message && <p className="rounded-lg bg-cream p-3 font-body text-sm text-ink-700">{message}</p>}

          <button
            type="submit"
            disabled={busy || selectedPrice === undefined}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-display text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}
            {busy ? 'Submitting…' : `Submit · ${money(selectedPrice)}`}
          </button>
          <p className="text-center font-body text-xs text-ink-400">
            Your certificate is filed by our team and delivered to Deliveries.
          </p>
        </form>

        <section className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Reference ID..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 font-body text-sm text-ink outline-none focus:border-gold-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void loadHistory(query.trim())}
              className="rounded-xl bg-blue-600 px-5 py-2.5 font-body text-sm font-semibold text-white"
            >
              Search
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-parchment-line bg-white">
            <table className="w-full min-w-[560px] text-left font-body text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-ink-600">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-600">
                      <Loader2 className="mx-auto animate-spin" size={18} />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-ink-600">
                      No record found
                    </td>
                  </tr>
                ) : (
                  history.map((entry) => (
                    <tr key={entry.reference} className="border-t border-parchment-line">
                      <td className="px-4 py-3 font-mono text-xs text-ink">{entry.reference}</td>
                      <td className="px-4 py-3 text-ink-600">{new Date(entry.created_at).toLocaleString('en-NG')}</td>
                      <td className="px-4 py-3">{entry.tin_type ? TYPE_LABEL[entry.tin_type] : '—'}</td>
                      <td className="px-4 py-3">{money(entry.amount)}</td>
                      <td className="px-4 py-3 font-semibold">{STATUS_LABEL[entry.status] ?? entry.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={submit} />
    </AppShell>
  );
}
