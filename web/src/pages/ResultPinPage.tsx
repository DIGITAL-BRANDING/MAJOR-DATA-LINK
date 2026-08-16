import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

export default function ResultPinPage({ exam }: { exam: 'WAEC' | 'NECO' | 'NABTEB' }) {
  const nav = useNavigate(); const [quantity, setQuantity] = useState(1); const [price, setPrice] = useState<number>(); const [showPin, setShowPin] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [pins, setPins] = useState<string[]>([]);
  useEffect(() => { api.get<{data:{unitPrice:number}}>(`/result/${exam.toLowerCase()}/price`).then(r => setPrice(Number(r.data.unitPrice))).catch(() => setMessage('Unable to load current price.')); }, [exam]);
  function prepare(e: FormEvent) { e.preventDefault(); if (price !== undefined) setShowPin(true); }
  async function purchase(pin: string) { setShowPin(false); setBusy(true); try { const r = await api.post<{status:boolean;message:string;data:{pin?:string;pins?:string[]}}>(`/result/${exam.toLowerCase()}/pin`, {quantity, pin}); if (!r.status) throw new Error(r.message); setMessage(r.message); setPins(r.data.pins?.length ? r.data.pins : r.data.pin ? [r.data.pin] : []); } catch (e) { setMessage(e instanceof Error ? e.message : 'Request failed.'); } finally { setBusy(false); } }
  const total = (price ?? 0) * quantity;
  return <AppShell><button onClick={() => nav('/result-checkers')}>← Result Checkers</button><main className="mx-auto mt-5 max-w-lg rounded-2xl border border-parchment-line bg-parchment p-6"><h1 className="font-display text-2xl font-bold text-ink">Buy {exam} PIN</h1><div className="mt-4 rounded-xl bg-cream p-4"><span className="font-body text-xs text-ink-600">Price per PIN</span><p className="font-mono text-xl font-bold text-gold-700">{price === undefined ? 'Loading…' : `₦${price.toLocaleString()}`}</p></div><form onSubmit={prepare} className="mt-4 space-y-4"><label>Quantity (1–10)<input type="number" min="1" max="10" value={quantity} onChange={e => setQuantity(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={busy || price === undefined} className="w-full rounded-xl bg-gold-500 py-3 font-semibold">{busy ? 'Processing…' : `Continue — ₦${total.toLocaleString()}`}</button></form>{message && <div className="mt-4 rounded-xl bg-success-500/10 p-4">{message}{pins.map((pin, i) => <code key={i} className="mt-3 block rounded bg-cream p-3 font-bold">{pin}</code>)}</div>}</main><PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={purchase} /></AppShell>;
}
