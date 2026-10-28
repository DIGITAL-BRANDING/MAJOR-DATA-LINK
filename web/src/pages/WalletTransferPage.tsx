import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowLeftRight, CheckCircle2, Loader2, Search, ShieldCheck, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { PinConfirmDialog } from '../components/PinConfirmDialog';
import { ApiError, api } from '../lib/api';

type Recipient = { full_name: string; phone_last4: string };
type Balance = { balance: number };
type TransferResult = {
  reference: string;
  transfer_reference: string;
  recipient_name: string;
  amount: number;
  balance_after: number;
  reused: boolean;
};

function naira(amount: number) {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function WalletTransferPage() {
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [transferKey, setTransferKey] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);

  useEffect(() => {
    api.get<Balance>('/wallet/balance').then((data) => setWalletBalance(data.balance)).catch(() => {});
  }, []);

  async function findRecipient(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setRecipient(null);
    setResult(null);
    setTransferKey(null);
    setLookingUp(true);
    try {
      const response = await api.post<{ status: boolean; data: Recipient }>('/wallet/transfer/recipient', { phone: phone.trim() });
      setRecipient(response.data);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not find this user. Please try again.');
    } finally {
      setLookingUp(false);
    }
  }

  function prepareTransfer(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setTransferKey((current) => current ?? api.newIdempotencyKey());
    setShowPin(true);
  }

  async function sendTransfer(pin: string) {
    if (!recipient) return;
    const key = transferKey ?? api.newIdempotencyKey();
    setTransferKey(key);
    setShowPin(false);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await api.postIdempotent<{ status: boolean; message: string; data: TransferResult }>(
        '/wallet/transfer',
        { phone: phone.trim(), amount: Number(amount), pin },
        key,
      );
      setResult(response.data);
      setWalletBalance(response.data.balance_after);
      setMessage(`${naira(response.data.amount)} sent successfully to ${response.data.recipient_name}.`);
      setPhone('');
      setAmount('');
      setRecipient(null);
      setTransferKey(null);
    } catch (cause) {
      // Keep the same key: if the connection dropped after the server completed,
      // retrying must return that transfer instead of sending the money twice.
      setError(cause instanceof ApiError ? cause.message : 'Transfer failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const parsedAmount = Number(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 && Math.abs(parsedAmount * 100 - Math.round(parsedAmount * 100)) < 0.000001;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"><ArrowLeft size={16} /> Back to dashboard</Link>
        <section className="mt-4 overflow-hidden rounded-3xl border border-parchment-line bg-white shadow-sm">
          <header className="bg-gradient-to-r from-[#09295f] to-[#0a397e] px-5 py-6 text-white sm:px-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-100">Wallet service</p>
                <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">Transfer to a user</h1>
                <p className="mt-2 max-w-lg text-sm leading-6 text-blue-100">Send funds instantly to another active K-Tech wallet using their registered phone number.</p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15"><ArrowLeftRight size={24} /></span>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm"><Wallet size={16} /><span>Available balance:</span><strong>{walletBalance === null ? '—' : naira(walletBalance)}</strong></div>
          </header>

          <div className="space-y-5 p-5 sm:p-7">
            {message && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0" />{message}{result && <span className="block font-mono text-xs">Reference: {result.transfer_reference}</span>}</div>}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">{error}</p>}

            <form onSubmit={findRecipient} className="space-y-3">
              <label className="block text-sm font-semibold text-ink">Recipient’s registered phone number
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => { setPhone(event.target.value); setRecipient(null); setTransferKey(null); setResult(null); setMessage(''); setError(''); }}
                  placeholder="e.g. 08012345678"
                  className="mt-1.5 w-full rounded-xl border border-parchment-line bg-cream px-4 py-3 text-base text-ink outline-none focus:border-gold-500"
                />
              </label>
              <button type="submit" disabled={lookingUp || phone.trim().length < 7} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-700 px-4 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-blue-50 disabled:opacity-50">
                {lookingUp ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{lookingUp ? 'Checking account…' : 'Find recipient'}
              </button>
            </form>

            {recipient && (
              <form onSubmit={prepareTransfer} className="space-y-5 border-t border-parchment-line pt-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Recipient verified</p>
                  <p className="mt-1 text-lg font-bold text-ink">{recipient.full_name}</p>
                  <p className="text-sm text-ink-600">Phone ending in {recipient.phone_last4}</p>
                </div>
                <label className="block text-sm font-semibold text-ink">Amount to send
                  <input
                    required
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => { setAmount(event.target.value); setTransferKey(null); setResult(null); }}
                    placeholder="₦0.00"
                    className="mt-1.5 w-full rounded-xl border border-parchment-line bg-cream px-4 py-3 text-lg font-semibold text-ink outline-none focus:border-gold-500"
                  />
                </label>
                <p className="text-xs leading-5 text-ink-600">Transfers are immediate and cannot be reversed once sent. Check the recipient’s name and amount before confirming.</p>
                <button type="submit" disabled={!validAmount || busy || (walletBalance !== null && parsedAmount > walletBalance)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3.5 font-display text-sm font-bold text-ink transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}{busy ? 'Sending transfer…' : `Continue to send ${validAmount ? naira(parsedAmount) : ''}`}
                </button>
                {error && <button type="button" onClick={() => setShowPin(true)} disabled={busy} className="w-full rounded-xl border border-brand-700 py-3 text-sm font-bold text-brand-800 hover:bg-blue-50 disabled:opacity-50">Retry this transfer</button>}
              </form>
            )}
          </div>
        </section>
      </div>
      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={sendTransfer} />
    </AppShell>
  );
}
