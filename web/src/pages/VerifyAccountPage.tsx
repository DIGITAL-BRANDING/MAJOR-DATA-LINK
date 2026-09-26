import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Check, Copy } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';

type KycStatusResponse = {
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  kyc_failure_reason: string | null;
  virtual_account_number: string | null;
  virtual_account_bank: string | null;
  virtual_account_funding_paused?: boolean;
};

/**
 * Generates a customer's permanent dedicated account number. There was
 * previously no web page for this at all - kyc.routes.ts's /kyc/bvn
 * endpoint existed but nothing in web/ ever called it, so a web-only
 * customer had no way to get one (see dashboard's "Generate Permanent
 * Account Number" button, which now leads here).
 *
 * Only asks for BVN: bank_code/account_number are for the older
 * Paystack-specific validation step, which the currently-live ZenithPay
 * provider doesn't use (see kyc.routes.ts).
 */
export default function VerifyAccountPage() {
  const [status, setStatus] = useState<KycStatusResponse | null>(null);
  const [bvn, setBvn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<{ data: KycStatusResponse }>('/kyc/status')
      .then((res) => setStatus(res.data))
      .catch(() => setError('Unable to load your verification status.'));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{11}$/.test(bvn)) {
      setError('BVN must be exactly 11 digits.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await api.post<{ data: KycStatusResponse }>('/kyc/bvn', { bvn });
      setStatus((prev) => ({ ...prev, ...res.data }) as KycStatusResponse);
      setBvn('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Verification failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function copyAccount() {
    if (!status?.virtual_account_number) return;
    navigator.clipboard.writeText(status.virtual_account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hasAccount = Boolean(status?.virtual_account_number);

  return (
    <AppShell>
      <main className="mx-auto max-w-2xl">
        <section className="rounded-2xl border border-parchment-line bg-parchment p-6">
          <p className="font-body text-sm font-semibold text-gold-700">Wallet</p>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-bold text-ink">
            <ShieldCheck size={26} className="text-gold-600" /> Generate Permanent Account Number
          </h1>
          <p className="mt-2 font-body text-sm text-ink-600">
            Verify your BVN once to get a permanent dedicated account number in your name. Transfer any amount to it,
            any time, and your wallet is credited automatically — no need to generate a new account for every funding.
          </p>

          {!status ? (
            <p className="mt-6 font-body text-sm text-ink-600">Loading…</p>
          ) : hasAccount ? (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-body text-sm font-semibold text-emerald-800">
                Your permanent account is ready.
              </p>
              <div className="mt-3 flex items-center justify-between rounded-lg border border-parchment-line bg-cream px-4 py-3">
                <div>
                  <span className="block font-body text-base font-extrabold uppercase tracking-wide text-brand-700">
                    {status.virtual_account_bank}
                  </span>
                  <span className="font-mono text-lg font-bold text-ink">{status.virtual_account_number}</span>
                </div>
                <button
                  onClick={copyAccount}
                  className="flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 font-body text-xs font-semibold text-white transition hover:bg-brand-800"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <Link to="/dashboard" className="mt-4 inline-block font-body text-sm font-semibold text-brand-700 underline">
                Back to Dashboard
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              {status.kyc_status === 'rejected' && status.kyc_failure_reason && (
                <p className="rounded-xl bg-red-50 p-3 font-body text-sm text-red-700">
                  Your last attempt failed: {status.kyc_failure_reason}. Please try again.
                </p>
              )}
              <label className="block font-body text-sm text-ink-600">
                Bank Verification Number (BVN)
                <input
                  required
                  inputMode="numeric"
                  maxLength={11}
                  value={bvn}
                  onChange={(e) => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder="e.g. 12345678901"
                  className="mt-1 w-full rounded-xl border border-parchment-line bg-cream p-3 text-ink"
                />
              </label>
              <p className="font-body text-xs text-ink-500">
                Your BVN is used only to verify your identity and issue the account number — it is never stored on our
                servers.
              </p>
              <button
                disabled={busy}
                className="w-full rounded-xl bg-gold-500 py-3 font-display font-semibold text-ink disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Generate My Account Number'}
              </button>
            </form>
          )}

          {error && <p className="mt-4 rounded-xl bg-red-50 p-3 font-body text-sm text-red-700">{error}</p>}
        </section>
      </main>
    </AppShell>
  );
}
