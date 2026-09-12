import { useState, type FormEvent } from 'react';
import { BriefcaseBusiness, CheckCircle2, Loader2, Send } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

const services = ['CAC Business Name Registration', 'CAC Company Registration', 'CAC Verification'] as const;

/** Manual CAC work is tracked as a ticket; staff complete it and attach the final document using User Deliveries. */
export default function CacServicesPage() {
  const [service, setService] = useState<(typeof services)[number]>(services[0]);
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (fullName.trim().length < 3 || businessName.trim().length < 2 || phone.trim().length < 7) {
      setFeedback('Enter your full name, business name and phone number.'); return;
    }
    setSending(true); setFeedback('');
    try {
      await api.post('/support/tickets', { subject: `CAC Service: ${service}`, message: `CAC service requested: ${service}\n\nCustomer name: ${fullName.trim()}\nBusiness name: ${businessName.trim()}\nPhone: ${phone.trim()}\nAdditional details: ${notes.trim() || 'None'}` });
      setFullName(''); setBusinessName(''); setPhone(''); setNotes('');
      setFeedback('Your CAC request is now with K-Tech Solutions. We will process it and upload your completed file to Deliveries.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Unable to send your CAC request.'); }
    finally { setSending(false); }
  }

  return <AppShell><div className="mx-auto max-w-3xl"><header className="rounded-3xl bg-ink px-6 py-8 text-cream shadow-lg sm:px-9"><div className="flex items-center gap-3 text-gold-400"><BriefcaseBusiness size={28}/><span className="text-sm font-bold uppercase tracking-[0.16em]">K-Tech Solutions</span></div><h1 className="mt-4 font-display text-3xl font-bold">CAC Services</h1><p className="mt-2 max-w-xl text-sm leading-6 text-cream/80">Send your CAC request here. Our admin team processes it and securely uploads the completed document to your dashboard.</p></header><div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]"><section className="rounded-2xl border border-parchment-line bg-parchment p-5"><h2 className="font-display text-lg font-bold text-ink">How delivery works</h2><ol className="mt-4 space-y-3">{['Submit the required request details.', 'K-Tech Solutions reviews and processes it.', 'Your completed document is uploaded to Deliveries.'].map((item) => <li key={item} className="flex gap-2 text-sm text-ink-700"><CheckCircle2 className="mt-0.5 shrink-0 text-gold-500" size={16}/>{item}</li>)}</ol></section><form onSubmit={submit} className="rounded-2xl border border-parchment-line bg-parchment p-5"><h2 className="font-display text-lg font-bold text-ink">Start a CAC request</h2><label className="mt-4 block text-sm font-semibold text-ink">Service<select value={service} onChange={(e) => setService(e.target.value as typeof service)} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm">{services.map((item) => <option key={item}>{item}</option>)}</select></label><label className="mt-4 block text-sm font-semibold text-ink">Your full name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm"/></label><label className="mt-4 block text-sm font-semibold text-ink">Business / company name<input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm"/></label><label className="mt-4 block text-sm font-semibold text-ink">Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm"/></label><label className="mt-4 block text-sm font-semibold text-ink">Other details (optional)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add any required information. Do not share passwords or OTPs." className="mt-1.5 w-full resize-y rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm"/></label>{feedback && <p className={`mt-3 rounded-lg p-3 text-sm ${feedback.startsWith('Your') ? 'bg-success-500/10 text-success-700' : 'bg-ember-500/10 text-ember-600'}`}>{feedback}</p>}<button disabled={sending} className="mt-4 flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-60">{sending ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>} Send request</button></form></div></div></AppShell>;
}
