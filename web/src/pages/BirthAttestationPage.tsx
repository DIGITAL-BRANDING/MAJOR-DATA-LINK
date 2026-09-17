import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

type FieldInput = 'text' | 'date' | 'nin' | 'select' | 'image';
type Field = { key: string; label: string; required: boolean; input: FieldInput; options: string[] | null; section: string | null };
type HistoryEntry = { reference: string; status: string; created_at: string; pdf_base64: string | null };

// Raw file size cap - keeps the base64'd body comfortably under the
// backend's express.json() limit (8mb, see app.ts).
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const money = (amount?: number) =>
  amount === undefined ? '…' : `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Ported from infoverify (DIGITAL-BRANDING/maria-digital-services)'s
 * BirthAttestationPage.tsx - same /api/birth-attestation endpoints,
 * restyled onto MAJOR-DATA-LINK's own ink/parchment/gold theme (matching
 * BvnCrmPage.tsx/NewspaperPublicationPage.tsx).
 */
export default function BirthAttestationPage() {
  const nav = useNavigate();
  const [fields, setFields] = useState<Field[]>([]);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [values, setValues] = useState<Record<string, string>>({});
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Field[] }>('/birth-attestation/fields'),
      api.get<{ data: { unit_price: number } }>('/birth-attestation/price')
    ])
      .then(([fieldsRes, priceRes]) => {
        setFields(fieldsRes.data);
        setPrice(priceRes.data.unit_price);
      })
      .catch(() => setMessage('Unable to load this form. Please refresh and try again.'));
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const result = await api.get<{ data: HistoryEntry[] }>('/birth-attestation/history');
      setHistory(result.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  const sections = useMemo(() => {
    const order: string[] = [];
    const byName: Record<string, Field[]> = {};
    for (const field of fields) {
      const name = field.section ?? '';
      if (!byName[name]) {
        byName[name] = [];
        order.push(name);
      }
      byName[name].push(field);
    }
    return order.map((name) => ({ name, fields: byName[name] }));
  }, [fields]);

  async function handleImageSelect(fieldKey: string, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setImageErrors((e) => ({ ...e, [fieldKey]: 'Please choose an image file (PNG, JPEG, or WEBP).' }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageErrors((e) => ({ ...e, [fieldKey]: 'That photo is too large - please use one under 4MB.' }));
      return;
    }
    try {
      const dataUrl = await readImageAsDataUrl(file);
      setValues((v) => ({ ...v, [fieldKey]: dataUrl }));
      setImageErrors((e) => ({ ...e, [fieldKey]: '' }));
    } catch {
      setImageErrors((e) => ({ ...e, [fieldKey]: 'Could not read that file - please try again.' }));
    }
  }

  function prepare(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setMessage('Please check the consent box before continuing.');
      return;
    }
    const missingImage = fields.find((f) => f.input === 'image' && f.required && !values[f.key]);
    if (missingImage) {
      setMessage(`Please attach a photo for "${missingImage.label}" before continuing.`);
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
      const result = await api.post<{ status: boolean; message: string; data: { reference: string } }>(
        '/birth-attestation/submit',
        { ...values, pin }
      );
      setReference(result.data.reference);
      setMessage(result.message);
      setValues({});
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
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">Birth Attestation</h1>
          <p className="mt-2 font-body text-sm text-ink-600">
            NPC Birth Attestation &amp; Instant approval. Fill in every section carefully - the details below are
            submitted to the National Population Commission on your behalf.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-parchment-line bg-parchment p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-ink">Birth Attestation Request</h2>
            <span className="rounded-full bg-gold-500/15 px-4 py-2 font-body text-sm font-bold text-gold-700">
              Service cost: {money(price)}
            </span>
          </div>

          {!reference ? (
            <form onSubmit={prepare} className="mt-5 space-y-5">
              {sections.map((section) => (
                <div key={section.name || 'general'}>
                  {section.name && <h3 className="font-body text-sm font-semibold text-ink-600">{section.name}</h3>}
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {section.fields.map((field) => (
                      <label
                        key={field.key}
                        className={`block font-body text-sm font-medium text-ink-600 ${field.input === 'image' ? 'sm:col-span-2' : ''}`}
                      >
                        {field.label}
                        {field.required && <span className="text-ember"> *</span>}
                        {field.input === 'select' ? (
                          <select
                            required={field.required}
                            className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                            value={values[field.key] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          >
                            <option value="">Select…</option>
                            {(field.options ?? []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : field.input === 'date' ? (
                          <input
                            required={field.required}
                            type="date"
                            className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                            value={values[field.key] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          />
                        ) : field.input === 'nin' ? (
                          <input
                            required={field.required}
                            type="tel"
                            inputMode="numeric"
                            maxLength={11}
                            className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                            value={values[field.key] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                          />
                        ) : field.input === 'image' ? (
                          <>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                              onChange={(e) => void handleImageSelect(field.key, e.target.files?.[0])}
                            />
                            {values[field.key] && (
                              <img src={values[field.key]} alt={field.label} className="mt-2 h-24 w-24 rounded-lg border border-parchment-line object-cover" />
                            )}
                            {imageErrors[field.key] && <p className="mt-1 font-body text-xs text-rose-600">{imageErrors[field.key]}</p>}
                          </>
                        ) : (
                          <input
                            required={field.required}
                            className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                            value={values[field.key] ?? ''}
                            onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <label className="flex items-start gap-2 font-body text-xs text-ink-600">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                I confirm the details above are accurate and I authorize MAJOR DATA-LINK to submit this Birth
                Attestation request to NPC on my behalf.
              </label>

              <div>
                <button
                  disabled={busy || fields.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink disabled:opacity-60"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : 'Continue to PIN confirmation'}
                </button>
                {message && <p className="mt-3 rounded-lg bg-cream p-3 font-body text-sm text-ink-600">{message}</p>}
              </div>
            </form>
          ) : (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
              <p className="font-body text-sm font-semibold text-emerald-800">{message}</p>
              <p className="mt-1 font-body text-xs text-emerald-700">Reference: {reference}</p>
              <button
                onClick={() => setReference('')}
                className="mt-4 rounded-xl bg-gold-500 px-5 py-2.5 font-display text-sm font-semibold text-ink"
              >
                Submit another request
              </button>
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
                  <li
                    key={entry.reference}
                    className="flex items-center justify-between rounded-xl border border-parchment-line bg-cream p-3 font-body text-xs text-ink-600"
                  >
                    <span>
                      {entry.reference} · {new Date(entry.created_at).toLocaleString()} ·{' '}
                      <span
                        className={
                          entry.status === 'success'
                            ? 'font-semibold text-emerald-700'
                            : entry.status === 'failed'
                              ? 'font-semibold text-rose-600'
                              : 'font-semibold text-amber-600'
                        }
                      >
                        {entry.status === 'pending' ? 'Under review' : entry.status}
                      </span>
                    </span>
                    {entry.pdf_base64 && (
                      <a
                        href={`data:application/pdf;base64,${entry.pdf_base64}`}
                        download={`${entry.reference}.pdf`}
                        className="flex items-center gap-1 font-semibold text-gold-700"
                      >
                        <Download size={12} /> PDF
                      </a>
                    )}
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
