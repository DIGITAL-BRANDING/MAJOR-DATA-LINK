import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Loader2 } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

type FieldDef = { key: string; label: string; required: boolean };
type HistoryEntry = { reference: string; status: string; created_at: string; pdf_base64: string | null };

const money = (amount?: number) =>
  amount === undefined ? '…' : `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

/**
 * Ported from infoverify (DIGITAL-BRANDING/maria-digital-services)'s
 * NewspaperPublicationPage.tsx - same /api/newspaper-publication endpoints,
 * restyled onto MAJOR-DATA-LINK's own ink/parchment/gold theme (matching
 * BvnCrmPage.tsx) instead of infoverify's navy/gold palette.
 */
export default function NewspaperPublicationPage() {
  const nav = useNavigate();
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    api
      .get<{ data: FieldDef[] }>('/newspaper-publication/fields')
      .then((res) => setFields(res.data))
      .catch(() => setMessage('Unable to load this form. Please refresh and try again.'));
    api
      .get<{ data: { unit_price: number } }>('/newspaper-publication/price')
      .then((res) => setPrice(res.data.unit_price))
      .catch(() => {});
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const result = await api.get<{ data: HistoryEntry[] }>('/newspaper-publication/history');
      setHistory(result.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function prepare(event: FormEvent) {
    event.preventDefault();
    for (const field of fields) {
      if (field.required && !values[field.key]?.trim()) {
        setMessage(`Please fill in "${field.label}".`);
        return;
      }
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
        '/newspaper-publication/submit',
        { ...values, pin }
      );
      setReference(result.data.reference);
      setMessage(result.message);
      setValues({});
      void loadHistory();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const oldFields = fields.filter((f) => f.key.startsWith('old_'));
  const newFields = fields.filter((f) => f.key.startsWith('new_'));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <button onClick={() => nav('/dashboard')} className="font-body text-sm font-semibold text-gold-700">
          ← Dashboard
        </button>

        <header className="mt-5 rounded-2xl border border-parchment-line bg-parchment p-6">
          <p className="font-body text-sm font-semibold text-gold-700">Identity services</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">Newspaper Publication</h1>
          <p className="mt-2 font-body text-sm text-ink-600">
            Name only or Name &amp; DoB Publication (BluePrint or DailyTrust only). Submit before 5:30pm, Monday to
            Friday. Processing takes about 20 hours.
          </p>
        </header>

        <section className="mt-6 rounded-2xl border border-parchment-line bg-parchment p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-ink">Name Change Publication</h2>
            <span className="rounded-full bg-gold-500/15 px-4 py-2 font-body text-sm font-bold text-gold-700">
              Service cost: {money(price)}
            </span>
          </div>

          {!reference ? (
            <form onSubmit={prepare} className="mt-5 space-y-5">
              <div>
                <h3 className="font-body text-sm font-semibold text-ink-600">Old Details</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {oldFields.map((field) => (
                    <label key={field.key} className="block font-body text-sm font-medium text-ink-600">
                      {field.label}
                      {field.required && <span className="text-ember"> *</span>}
                      <input
                        required={field.required}
                        className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-body text-sm font-semibold text-ink-600">New Details</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {newFields.map((field) => (
                    <label key={field.key} className="block font-body text-sm font-medium text-ink-600">
                      {field.label}
                      {field.required && <span className="text-ember"> *</span>}
                      <input
                        required={field.required}
                        className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink outline-none focus:border-gold-500"
                        value={values[field.key] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                      />
                    </label>
                  ))}
                </div>
              </div>

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
