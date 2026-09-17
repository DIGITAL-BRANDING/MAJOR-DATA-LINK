import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Download, Loader2, Upload } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

type CacType = 'sole' | 'partnership' | 'llc';
type CacPriceRow = { type: CacType; title: string; unitPrice: number; isActive: boolean };
type CacHistoryEntry = {
  reference: string;
  status: string;
  cac_type: string | null;
  proposed_name_1: string | null;
  proposed_name_2: string | null;
  amount: number;
  progress_notes: string | null;
  submission_pdf_base64: string | null;
  certificate_pdf_base64: string | null;
  created_at: string;
  updated_at: string;
};
type Details = {
  business_nature: string;
  business_address: string;
  proprietor_full_name: string;
  proprietor_phone: string;
  proprietor_email: string;
  proprietor_residential_address: string;
  proprietor_date_of_birth: string;
  proprietor_gender: 'Male' | 'Female' | '';
  proprietor_nin: string;
};
type DocumentLabel = 'Valid ID document(s)' | 'Passport photograph(s)' | 'Proof of address' | 'Signature specimen(s)';
type SupportingDocument = { label: DocumentLabel; name: string; mime_type: 'application/pdf' | 'image/jpeg' | 'image/png'; base64: string };

const EMPTY_DETAILS: Details = {
  business_nature: '',
  business_address: '',
  proprietor_full_name: '',
  proprietor_phone: '',
  proprietor_email: '',
  proprietor_residential_address: '',
  proprietor_date_of_birth: '',
  proprietor_gender: '',
  proprietor_nin: ''
};

const SERVICE_OPTIONS: { value: CacType; label: string }[] = [
  { value: 'sole', label: 'Business Name \u2014 Sole Proprietorship' },
  { value: 'partnership', label: 'Business Name \u2014 Partnership' }
];

const STATUS_LABEL: Record<string, string> = { pending: 'Processing', success: 'Completed', failed: 'Rejected', reversed: 'Refunded' };

const money = (amount?: number) =>
  amount === undefined ? '…' : `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/**
 * Ported from infoverify (DIGITAL-BRANDING/maria-digital-services)'s
 * pages/verification/CacServicesPage.tsx - same /api/cac endpoints and
 * document-upload flow (4 named slots matching what CAC actually asks for:
 * ID, passport photo, proof of address, signature), restyled onto
 * MAJOR-DATA-LINK's own ink/parchment/gold theme. Replaces the old
 * /cac page, which was just a generic manual support-ticket form with no
 * real form fields or document upload at all.
 */
export default function CacServicesPage() {
  const nav = useNavigate();
  const [prices, setPrices] = useState<CacPriceRow[]>([]);
  const [registrationTab, setRegistrationTab] = useState<'business' | 'company'>('business');
  const [service, setService] = useState<CacType>('sole');
  const [name1, setName1] = useState('');
  const [name2, setName2] = useState('');
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [documents, setDocuments] = useState<SupportingDocument[]>([]);
  const [uploadingLabel, setUploadingLabel] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [history, setHistory] = useState<CacHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const selectedPrice = useMemo(() => prices.find((p) => p.type === service)?.unitPrice, [prices, service]);

  function detailField<K extends keyof Details>(key: K, value: Details[K]) {
    setDetails((prev) => ({ ...prev, [key]: value }));
  }

  async function addDocument(label: DocumentLabel, file?: File) {
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setMessage('Use a PDF, JPG or PNG document under 4MB.');
      return;
    }
    setUploadingLabel(label);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setDocuments((current) => [
        ...current.filter((document) => document.label !== label),
        { label, name: file.name, mime_type: file.type as SupportingDocument['mime_type'], base64 }
      ]);
    } finally {
      setUploadingLabel(null);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const result = await api.get<{ data: CacHistoryEntry[] }>('/cac/history');
      setHistory(result.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => {
    api
      .get<{ data: CacPriceRow[] }>('/cac/prices')
      .then((result) => setPrices(result.data ?? []))
      .catch(() => setPrices([]));
    void loadHistory();
  }, []);

  function prepare(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setMessage('Please check the consent box before continuing.');
      return;
    }
    setMessage('');
    setShowPin(true);
  }

  async function submit(pin: string) {
    setShowPin(false);
    setBusy(true);
    setMessage('');
    try {
      const result = await api.post<{ status: boolean; message: string; data: { reference: string } }>('/cac/submit', {
        cac_type: service,
        proposed_name_1: name1,
        proposed_name_2: name2 || undefined,
        ...details,
        supporting_documents: documents.length ? documents : undefined,
        pin
      });
      setReference(result.data.reference);
      setMessage(result.message);
      setService('sole');
      setRegistrationTab('business');
      setName1('');
      setName2('');
      setDetails(EMPTY_DETAILS);
      setDocuments([]);
      setConsent(false);
      void loadHistory();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <button onClick={() => nav('/dashboard')} className="font-body text-sm font-semibold text-gold-700">
          ← Dashboard
        </button>

        <header className="mt-5 rounded-2xl border border-parchment-line bg-parchment p-6">
          <p className="font-body text-sm font-semibold text-gold-700">Identity services</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">CAC Registration</h1>
          <p className="mt-2 font-body text-sm text-ink-600">
            Register your business or company with the Corporate Affairs Commission. Complete the details below and
            our team will process the request. NGOs, incorporated trustees, and companies above ₦1m share capital
            are quoted individually via Support.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-parchment-line bg-parchment p-6">
          <div className="flex items-center gap-2 border-b border-parchment-line pb-3">
            <Building2 size={20} className="text-gold-700" />
            <h2 className="font-display text-lg font-bold text-ink">Registration Type</h2>
          </div>
          <div className="mt-4 flex gap-5 border-b border-parchment-line">
            <button
              type="button"
              onClick={() => {
                setRegistrationTab('business');
                setService('sole');
              }}
              className={`border-b-2 px-1 pb-3 font-body text-sm font-semibold ${registrationTab === 'business' ? 'border-gold-500 text-ink' : 'border-transparent text-ink-400'}`}
            >
              Business Name Registration
            </button>
            <button
              type="button"
              onClick={() => {
                setRegistrationTab('company');
                setService('llc');
              }}
              className={`border-b-2 px-1 pb-3 font-body text-sm font-semibold ${registrationTab === 'company' ? 'border-gold-500 text-ink' : 'border-transparent text-ink-400'}`}
            >
              Company Registration
            </button>
          </div>

          {registrationTab === 'business' && (
            <div className="mt-4 flex gap-4 font-body text-sm text-ink-600">
              {SERVICE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input type="radio" checked={service === option.value} onChange={() => setService(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          )}

          <p className="mt-4 rounded-xl bg-gold-500/15 px-4 py-3 font-body text-sm text-ink">
            Service cost: <strong>{money(selectedPrice)}</strong>
          </p>

          <form onSubmit={prepare} className="mt-5 space-y-5">
            <div>
              <h3 className="font-body text-sm font-semibold text-ink-600">
                Proposed {registrationTab === 'business' ? 'Business' : 'Company'} Name(s)
              </h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="block font-body text-sm font-medium text-ink-600">
                  Option 1 <span className="text-ember">*</span>
                  <input
                    required
                    maxLength={200}
                    placeholder="e.g. Amana Traders"
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={name1}
                    onChange={(e) => setName1(e.target.value)}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  Option 2
                  <input
                    maxLength={200}
                    placeholder="e.g. Amana Global Ventures"
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={name2}
                    onChange={(e) => setName2(e.target.value)}
                  />
                </label>
              </div>
            </div>

            {registrationTab === 'company' && (
              <div className="rounded-xl bg-cream p-4 font-body text-sm text-ink-600">
                <p className="font-semibold text-ink">Type of Company</p>
                <label className="mt-2 flex items-center gap-2">
                  <input type="radio" checked readOnly /> Private Limited Company (Ltd) — 1M Share
                </label>
                <label className="mt-1 flex items-center gap-2 opacity-50">
                  <input type="radio" disabled /> Public Limited Company (Plc) — quoted individually via Support
                </label>
                <label className="mt-1 flex items-center gap-2 opacity-50">
                  <input type="radio" disabled /> Incorporated Trustee / NGO — quoted individually via Support
                </label>
              </div>
            )}

            <div>
              <h3 className="font-body text-sm font-semibold text-ink-600">Business Details</h3>
              <div className="mt-2 grid gap-3">
                <label className="block font-body text-sm font-medium text-ink-600">
                  Nature of Business <span className="text-ember">*</span>
                  <input
                    required
                    placeholder="e.g. Retail of electronics and accessories"
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.business_nature}
                    onChange={(e) => detailField('business_nature', e.target.value)}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  Business Address <span className="text-ember">*</span>
                  <input
                    required
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.business_address}
                    onChange={(e) => detailField('business_address', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-body text-sm font-semibold text-ink-600">Proprietor / Applicant Details</h3>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="block font-body text-sm font-medium text-ink-600 sm:col-span-2">
                  Full Name <span className="text-ember">*</span>
                  <input
                    required
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_full_name}
                    onChange={(e) => detailField('proprietor_full_name', e.target.value)}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  Phone <span className="text-ember">*</span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_phone}
                    onChange={(e) => detailField('proprietor_phone', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  Email <span className="text-ember">*</span>
                  <input
                    required
                    type="email"
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_email}
                    onChange={(e) => detailField('proprietor_email', e.target.value)}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  Date of Birth <span className="text-ember">*</span>
                  <input
                    required
                    type="date"
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_date_of_birth}
                    onChange={(e) => detailField('proprietor_date_of_birth', e.target.value)}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  Gender <span className="text-ember">*</span>
                  <select
                    required
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_gender}
                    onChange={(e) => detailField('proprietor_gender', e.target.value as Details['proprietor_gender'])}
                  >
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </label>
                <label className="block font-body text-sm font-medium text-ink-600">
                  NIN <span className="text-ember">*</span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={11}
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_nin}
                    onChange={(e) => detailField('proprietor_nin', e.target.value.replace(/\D/g, '').slice(0, 11))}
                  />
                </label>
                <label className="block font-body text-sm font-medium text-ink-600 sm:col-span-2">
                  Residential Address <span className="text-ember">*</span>
                  <input
                    required
                    className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                    value={details.proprietor_residential_address}
                    onChange={(e) => detailField('proprietor_residential_address', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="border-t border-parchment-line pt-5">
              <h3 className="font-display font-bold text-ink">Supporting Documents</h3>
              <p className="mt-1 font-body text-xs text-ink-400">
                Upload PDF, JPG or PNG files (maximum 4MB each). Your files are stored securely and made available to
                the CAC admin only.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {(['Valid ID document(s)', 'Passport photograph(s)', 'Proof of address', 'Signature specimen(s)'] as DocumentLabel[]).map(
                  (label) => {
                    const uploaded = documents.find((document) => document.label === label);
                    const uploading = uploadingLabel === label;
                    return (
                      <label key={label} className="block rounded-xl border border-dashed border-parchment-line bg-cream p-3 font-body text-sm font-medium text-ink-600">
                        {label}
                        <span className="mt-2 flex items-center gap-2 font-body text-xs text-ink-400">
                          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{' '}
                          {uploading ? 'Preparing secure upload…' : uploaded ? `Ready: ${uploaded.name}` : 'Choose file'}
                        </span>
                        <input
                          disabled={uploading || Boolean(uploadingLabel)}
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          className="mt-2 block w-full text-xs disabled:opacity-50"
                          onChange={(e) => void addDocument(label, e.target.files?.[0])}
                        />
                      </label>
                    );
                  }
                )}
              </div>
            </div>

            <label className="flex items-start gap-2 font-body text-xs text-ink-600">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              I confirm the details above are accurate and I authorize MAJOR DATA-LINK to file this registration with
              the Corporate Affairs Commission on my behalf.
            </label>

            <div>
              <button
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : 'Continue to PIN confirmation'}
              </button>
              {message && <p className="mt-3 rounded-lg bg-cream p-3 font-body text-sm text-ink-600">{message}</p>}
            </div>
          </form>

          {reference && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <p className="font-body text-sm font-semibold text-emerald-800">Reference: {reference}</p>
            </div>
          )}

          <div className="mt-8">
            <h3 className="font-body text-sm font-semibold text-ink-600">Recent requests</h3>
            {loadingHistory ? (
              <p className="mt-2 font-body text-xs text-ink-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="mt-2 font-body text-xs text-ink-400">No requests yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {history.map((entry) => (
                  <li key={entry.reference} className="rounded-xl border border-parchment-line bg-cream p-3 font-body text-xs text-ink-600">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {entry.proposed_name_1 ?? entry.reference} · {new Date(entry.created_at).toLocaleString()} ·{' '}
                        <span
                          className={
                            entry.status === 'success'
                              ? 'font-semibold text-emerald-700'
                              : entry.status === 'failed'
                                ? 'font-semibold text-rose-600'
                                : 'font-semibold text-amber-600'
                          }
                        >
                          {STATUS_LABEL[entry.status] ?? entry.status}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-2">
                        {entry.submission_pdf_base64 && (
                          <a
                            href={`data:application/pdf;base64,${entry.submission_pdf_base64}`}
                            download={`${entry.reference}-submission.pdf`}
                            className="flex items-center gap-1 font-semibold text-gold-700"
                          >
                            <Download size={12} /> Form
                          </a>
                        )}
                        {entry.certificate_pdf_base64 && (
                          <a
                            href={`data:application/pdf;base64,${entry.certificate_pdf_base64}`}
                            download={`${entry.reference}-certificate.pdf`}
                            className="flex items-center gap-1 font-semibold text-emerald-700"
                          >
                            <Download size={12} /> Certificate
                          </a>
                        )}
                      </span>
                    </div>
                    {entry.progress_notes && <p className="mt-1 text-ink-400">{entry.progress_notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={submit} />
    </AppShell>
  );
}
