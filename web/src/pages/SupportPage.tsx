import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, MessageCircle, Plus, Send } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

type Ticket = { id: string; subject: string; status: 'OPEN' | 'PENDING' | 'CLOSED'; created_at: string; last_message: string | null };
const badge: Record<Ticket['status'], string> = { OPEN: 'bg-gold-100 text-gold-700', PENDING: 'bg-brand-100 text-brand-700', CLOSED: 'bg-slate-100 text-slate-600' };

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try { const response = await api.get<{ data: Ticket[] }>('/support/tickets/mine'); setTickets(response.data); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load support requests.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (subject.trim().length < 3 || message.trim().length < 3) { setError('Please enter a subject and message of at least 3 characters.'); return; }
    setSending(true); setError('');
    try {
      await api.post('/support/tickets', { subject: subject.trim(), message: message.trim() });
      setSubject(''); setMessage(''); setShowForm(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send your request.'); }
    finally { setSending(false); }
  }

  return <AppShell><div className="mx-auto max-w-3xl">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-2xl font-bold text-ink">Support & requests</h1><p className="mt-1 text-sm text-ink-600">Track JAMB and other service requests in one place.</p></div><button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2 text-sm font-bold text-ink"><Plus size={16}/>{showForm ? 'Close form' : 'New request'}</button></header>
    {showForm && <form onSubmit={submit} className="mt-5 rounded-2xl border border-parchment-line bg-parchment p-5"><label className="block text-sm font-semibold text-ink">Subject<input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2" placeholder="e.g. JAMB Result Slip" /></label><label className="mt-4 block text-sm font-semibold text-ink">Message<textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2" placeholder="Describe the service you need. Never include passwords or OTPs." /></label><button disabled={sending} className="mt-4 flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-bold text-cream disabled:opacity-60">{sending ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}Send request</button></form>}
    {error && <p className="mt-4 rounded-xl bg-ember-500/10 p-4 text-sm text-ember-600">{error}</p>}
    <section className="mt-5 space-y-3">{loading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-gold-500"/></div> : tickets.length ? tickets.map(ticket => <article key={ticket.id} className="rounded-2xl border border-parchment-line bg-parchment p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">{ticket.subject}</h2><p className="mt-1 text-sm text-ink-600">{ticket.last_message ?? 'No message yet'}</p><time className="mt-2 block text-xs text-ink-500">{new Date(ticket.created_at).toLocaleString()}</time></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${badge[ticket.status] ?? badge.OPEN}`}>{ticket.status}</span></div></article>) : <div className="rounded-2xl border border-dashed border-parchment-line bg-parchment p-10 text-center text-ink-600"><MessageCircle className="mx-auto mb-3 text-gold-500"/><p>No requests yet. Start one when you need help.</p></div>}</section>
  </div></AppShell>;
}
