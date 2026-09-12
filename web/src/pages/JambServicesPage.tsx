import { useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Send } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

const services = [
  'CBT Practice Software',
  'JAMB Original Result',
  'JAMB Result Slip',
  'JAMB Admission Letter Print',
  'JAMB Check of Admission Status',
  'JAMB O-Level Upload',
];

/**
 * JAMB fulfilment needs student-specific documents and cannot be safely treated
 * like an instant VTU purchase.  This page creates a traceable support request
 * which staff can process, update and close from the existing admin inbox.
 */
export default function JambServicesPage() {
  const [service, setService] = useState(services[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (details.trim().length < 3) {
      setFeedback('Please add the details needed for this JAMB request.');
      return;
    }
    setSending(true);
    setFeedback('');
    try {
      await api.post('/support/tickets', {
        subject: `JAMB Service: ${service}`,
        message: `JAMB service requested: ${service}\n\nCustomer details:\n${details.trim()}`,
      });
      setDetails('');
      setFeedback('Your JAMB request has been sent. Support will update you in the Support section.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to send your JAMB request.');
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <header className="rounded-3xl bg-ink px-6 py-8 text-cream shadow-lg sm:px-9">
          <div className="flex items-center gap-3 text-gold-400"><GraduationCap size={28} /><span className="text-sm font-bold uppercase tracking-[0.16em]">K-Tech Solutions</span></div>
          <h1 className="mt-4 font-display text-3xl font-bold">JAMB Services</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/80">Request JAMB documents and admission services securely. Our support team will confirm the required information and price before processing.</p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-2xl border border-parchment-line bg-parchment p-5">
            <h2 className="font-display text-lg font-bold text-ink">Available services</h2>
            <ul className="mt-4 space-y-3">
              {services.map((item) => <li key={item} className="flex gap-2 text-sm text-ink-700"><CheckCircle2 className="mt-0.5 shrink-0 text-gold-500" size={16} />{item}</li>)}
            </ul>
          </section>

          <form onSubmit={submit} className="rounded-2xl border border-parchment-line bg-parchment p-5">
            <h2 className="font-display text-lg font-bold text-ink">Start a request</h2>
            <label className="mt-4 block text-sm font-semibold text-ink">Service
              <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm">
                {services.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-ink">Request details
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={7} placeholder="Enter your name, JAMB registration number and any relevant details. Do not share your password or OTP." className="mt-1.5 w-full resize-y rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" />
            </label>
            {feedback && <p className={`mt-3 rounded-lg p-3 text-sm ${feedback.startsWith('Your') ? 'bg-success-500/10 text-success-700' : 'bg-ember-500/10 text-ember-600'}`}>{feedback}</p>}
            <button disabled={sending} className="mt-4 flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-60">
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Send request
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
