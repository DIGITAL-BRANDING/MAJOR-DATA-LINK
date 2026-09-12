import { useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Send } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

const services = [
  { name: 'JAMB CBT Practice Software', price: 5000 },
  { name: 'JAMB Original Result', price: 2500 },
  { name: 'JAMB Admission Letter', price: 2000 },
  { name: 'JAMB Exam Slip', price: 500 },
  { name: 'JAMB Result Slip', price: 800 },
] as const;

/**
 * JAMB fulfilment needs student-specific documents and cannot be safely treated
 * like an instant VTU purchase.  This page creates a traceable support request
 * which staff can process, update and close from the existing admin inbox.
 */
export default function JambServicesPage() {
  const [service, setService] = useState<string>(services[0].name);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (registrationNumber.trim().length < 4 || fullName.trim().length < 3 || !/^20\d{2}$/.test(examYear)) {
      setFeedback('Enter your JAMB registration number, full name and a valid exam year.');
      return;
    }
    setSending(true);
    setFeedback('');
    try {
      await api.post('/support/tickets', {
        subject: `JAMB Service: ${service}`,
        message: `JAMB service requested: ${service}\nPrice: ₦${services.find((item) => item.name === service)?.price.toLocaleString()}\n\nJAMB Registration Number: ${registrationNumber.trim()}\nCandidate Full Name: ${fullName.trim()}\nExam Year: ${examYear}`,
      });
      setRegistrationNumber(''); setFullName('');
      setFeedback('Your request has been sent. The K-Tech team will process it and deliver the document to your Deliveries section.');
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
          <p className="mt-2 max-w-xl text-sm leading-6 text-cream/80">Submit your details securely. We process the request and upload completed documents directly to your Deliveries section.</p>
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-2xl border border-parchment-line bg-parchment p-5">
            <h2 className="font-display text-lg font-bold text-ink">Available services</h2>
            <ul className="mt-4 space-y-3">
              {services.map((item) => <li key={item.name} className="flex items-start justify-between gap-2 text-sm text-ink-700"><span className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-gold-500" size={16} />{item.name}</span><b className="whitespace-nowrap text-ink">₦{item.price.toLocaleString()}</b></li>)}
            </ul>
          </section>

          <form onSubmit={submit} className="rounded-2xl border border-parchment-line bg-parchment p-5">
            <h2 className="font-display text-lg font-bold text-ink">Start a request</h2>
            <label className="mt-4 block text-sm font-semibold text-ink">Service
              <select value={service} onChange={(e) => setService(e.target.value)} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm">
                {services.map((item) => <option key={item.name} value={item.name}>{item.name} — ₦{item.price.toLocaleString()}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold text-ink">JAMB Registration Number
              <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required placeholder="e.g. 12345678AB" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-ink">Candidate Full Name
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Enter full name as on JAMB record" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" />
            </label>
            <label className="mt-4 block text-sm font-semibold text-ink">Exam Year
              <input value={examYear} onChange={(e) => setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4))} required inputMode="numeric" placeholder="e.g. 2026" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" />
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
