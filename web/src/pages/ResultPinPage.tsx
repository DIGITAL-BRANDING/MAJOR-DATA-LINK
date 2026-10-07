import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

type ResultCard = { pin: string; serial: string };

export default function ResultPinPage({ exam }: { exam: 'WAEC' | 'NECO' | 'NABTEB' }) {
  const nav = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState<number>();
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [cards, setCards] = useState<ResultCard[]>([]);
  const [reference, setReference] = useState('');

  useEffect(() => {
    api.get<{ data: { unitPrice: number } }>(`/result/${exam.toLowerCase()}/price`)
      .then((r) => setPrice(Number(r.data.unitPrice)))
      .catch(() => setMessage('Unable to load current price.'));
  }, [exam]);

  function prepare(e: FormEvent) {
    e.preventDefault();
    if (price !== undefined) setShowPin(true);
  }

  async function purchase(pin: string) {
    setShowPin(false);
    setBusy(true);
    setMessage('');
    try {
      const r = await api.post<{
        status: boolean;
        message: string;
        data: { reference?: string; pin?: string; pins?: string[]; serial?: string; serials?: string[] };
      }>(`/result/${exam.toLowerCase()}/pin`, { quantity, pin });
      if (!r.status) throw new Error(r.message);
      setMessage(r.message);
      setReference(r.data.reference ?? '');
      const pins = r.data.pins?.length ? r.data.pins : r.data.pin ? [r.data.pin] : [];
      const serials = r.data.serials?.length ? r.data.serials : r.data.serial ? [r.data.serial] : [];
      setCards(pins.map((value, index) => ({ pin: value, serial: serials[index] ?? '' })));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Request failed.');
      setCards([]);
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); } catch { setMessage('Copy is not available in this browser.'); }
  }

  const total = (price ?? 0) * quantity;
  const neco = exam === 'NECO';

  return (
    <AppShell>
      <button onClick={() => nav('/result-checkers')} className="text-sm font-semibold text-ink-600">← Result Checkers</button>
      <main className="mx-auto mt-5 max-w-lg rounded-2xl border border-parchment-line bg-parchment p-6">
        <h1 className="font-display text-2xl font-bold text-ink">Buy {exam} {neco ? 'Token' : 'PIN'}</h1>
        <div className="mt-4 rounded-xl bg-cream p-4">
          <span className="font-body text-xs text-ink-600">Price per {neco ? 'token' : 'PIN'}</span>
          <p className="font-mono text-xl font-bold text-gold-700">{price === undefined ? 'Loading…' : `₦${price.toLocaleString()}`}</p>
        </div>
        <form onSubmit={prepare} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold">Quantity (1–10)
            <input type="number" min="1" max="10" value={quantity} onChange={(e) => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="mt-1 w-full rounded-xl border p-3" />
          </label>
          <button disabled={busy || price === undefined} className="w-full rounded-xl bg-gold-500 py-3 font-semibold">{busy ? 'Processing…' : `Continue — ₦${total.toLocaleString()}`}</button>
        </form>

        {message && <p role="status" className="mt-4 rounded-xl bg-success-500/10 p-4 text-sm">{message}</p>}

        {cards.length > 0 && (
          <section aria-label={`${exam} result ${neco ? 'token' : 'PIN'} cards`} className="mt-5 space-y-4">
            {cards.map((card, index) => (
              <article key={`${card.pin}-${index}`} className={neco ? 'result-pin-print-surface relative overflow-hidden rounded-2xl border border-amber-200 p-5 text-ink shadow-sm' : 'result-pin-print-surface rounded-2xl border border-parchment-line bg-white p-5 text-ink'} style={neco ? { background: 'linear-gradient(115deg,#f2b18b 0%,#f5d29a 52%,#b8df8c 100%)', printColorAdjust: 'exact' } : undefined}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-600">K-Tech Solutions</p>
                    <h2 className="mt-1 font-display text-lg font-bold">{exam} Result {neco ? 'Token' : 'Checker PIN'}</h2>
                  </div>
                  {neco && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-white/80 bg-emerald-700 text-center text-[9px] font-black leading-tight text-white shadow">NECO<br />TOKEN</div>}
                </div>
                <div className="mt-5 space-y-2.5 pr-2 font-mono text-sm">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-sans font-semibold">Token:</span><strong className="break-all text-base">{card.pin}</strong><button type="button" aria-label="Copy token" onClick={() => void copy(card.pin)} className="result-pin-actions rounded-full bg-white/80 p-1.5 text-emerald-700"><Copy size={14} /></button></p>
                  {card.serial && <p className="flex flex-wrap items-center gap-2"><span className="font-sans font-semibold">Serial No:</span><strong className="break-all text-base">{card.serial}</strong><button type="button" aria-label="Copy serial number" onClick={() => void copy(card.serial)} className="result-pin-actions rounded-full bg-white/80 p-1.5 text-emerald-700"><Copy size={14} /></button></p>}
                </div>
                {reference && <p className="mt-4 text-[10px] text-ink-600">Purchase ref: {reference}</p>}
              </article>
            ))}
            <button type="button" onClick={() => window.print()} className="result-pin-actions flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-semibold"><Printer size={17} /> Print {neco ? 'card' : 'PIN'}</button>
          </section>
        )}
      </main>
      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={purchase} />
    </AppShell>
  );
}
