import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, GraduationCap, Loader2, Send } from 'lucide-react';
import AppShell from '../components/AppShell';
import { PinConfirmDialog } from '../components/PinConfirmDialog';
import { api } from '../lib/api';

// Fallback shown only if the catalogue request fails. The live list from
// /jamb/services is authoritative, so new services appear without a web release.
const defaultServices = [
  { id: 'cbt_practice_software', label: 'JAMB CBT Practice Software', price: 5000 },
  { id: 'original_result', label: 'JAMB Original Result', price: 2500 },
  { id: 'admission_letter', label: 'JAMB Admission Letter', price: 2000 },
  { id: 'exam_slip', label: 'JAMB Exam Slip', price: 500 },
  { id: 'result_slip', label: 'JAMB Result Slip', price: 800 },
];

/**
 * JAMB fulfilment needs student-specific documents and cannot be safely treated
 * like an instant VTU purchase.  This page creates a traceable support request
 * which staff can process, update and close from the existing admin inbox.
 */
export default function JambServicesPage() {
  const [services, setServices] = useState(defaultServices);
  const [serviceId, setServiceId] = useState<string>(defaultServices[0].id);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [examYear, setExamYear] = useState(String(new Date().getFullYear()));
  const [sending, setSending] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; status: 'success' | 'error' } | null>(null);
  const [cbt, setCbt] = useState({ email: '', phone: '', organization_name: '', staff_count: '', trainees_count: '', whatsapp_number: '' });

  useEffect(() => {
    let active = true;
    api.get<{ status: boolean; data: Array<{ id: string; label: string; price: number }> }>('/jamb/services')
      .then(({ data }) => {
        // Use the live catalogue as-is. The old code kept only the five
        // hardcoded ids and silently dropped any service added on the backend.
        if (!active || data.length === 0) return;
        setServices(data);
        setServiceId((current) => (data.some((row) => row.id === current) ? current : data[0].id));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function prepare(e: React.FormEvent) {
    e.preventDefault();
    if (serviceId === 'cbt_practice_software') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cbt.email) || cbt.phone.trim().length < 6 || cbt.organization_name.trim().length < 2 || !cbt.staff_count || !cbt.trainees_count || cbt.whatsapp_number.trim().length < 6) { setFeedback({ message: 'Complete all CBT application fields with valid contact details.', status: 'error' }); return; }
    } else if (registrationNumber.trim().length < 4 || fullName.trim().length < 3 || !/^20\d{2}$/.test(examYear)) {
      setFeedback({ message: 'Enter your JAMB registration number, full name and a valid exam year.', status: 'error' });
      return;
    }
    setFeedback(null);
    setShowPin(true);
  }

  async function submit(pin: string) {
    setShowPin(false);
    setSending(true);
    setFeedback(null);
    try {
      const service = services.find((item) => item.id === serviceId)!;
      const payload = serviceId === 'cbt_practice_software' ? { service: service.id, ...cbt, pin } : { service: service.id, registration_number: registrationNumber.trim(), candidate_full_name: fullName.trim(), exam_year: Number(examYear), pin };
      await api.post('/jamb/requests', payload);
      setRegistrationNumber(''); setFullName(''); setCbt({ email: '', phone: '', organization_name: '', staff_count: '', trainees_count: '', whatsapp_number: '' });
      setFeedback({
        message: `₦${service.price.toLocaleString()} has been deducted. Your request will be processed within 2–3 hours during 8:00 AM–6:00 PM, then delivered to My Deliveries.`,
        status: 'success'
      });
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : 'Unable to send your JAMB request.', status: 'error' });
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
              {services.map((item) => <li key={item.id} className="flex items-start justify-between gap-2 text-sm text-ink-700"><span className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-gold-500" size={16} />{item.label}</span><b className="whitespace-nowrap text-ink">₦{item.price.toLocaleString()}</b></li>)}
            </ul>
          </section>

          <form onSubmit={prepare} className="rounded-2xl border border-parchment-line bg-parchment p-5">
            <h2 className="font-display text-lg font-bold text-ink">Start a request</h2>
            <div className="mt-3 flex gap-3 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-sm leading-5 text-ink-700">
              <Clock3 className="mt-0.5 shrink-0 text-gold-700" size={18} />
              <p><strong>Processing time:</strong> Your JAMB service will be processed within 2–3 hours, from 8:00 AM to 6:00 PM. Requests submitted outside these hours will be handled during the next working period.</p>
            </div>
            <label className="mt-4 block text-sm font-semibold text-ink">Service
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value as typeof serviceId)} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm">
                {services.map((item) => <option key={item.id} value={item.id}>{item.label} — ₦{item.price.toLocaleString()}</option>)}
              </select>
            </label>
            {serviceId === 'cbt_practice_software' ? <div className="mt-4 space-y-4">
              <label className="block text-sm font-semibold text-ink">Email Address<input type="email" required value={cbt.email} onChange={(e) => setCbt({ ...cbt, email: e.target.value })} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
              <label className="block text-sm font-semibold text-ink">Phone Number<input type="tel" required value={cbt.phone} onChange={(e) => setCbt({ ...cbt, phone: e.target.value })} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
              <label className="block text-sm font-semibold text-ink">Organization/School Name<input required value={cbt.organization_name} onChange={(e) => setCbt({ ...cbt, organization_name: e.target.value })} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
              <label className="block text-sm font-semibold text-ink">Approximate number of staff<select required value={cbt.staff_count} onChange={(e) => setCbt({ ...cbt, staff_count: e.target.value })} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm"><option value="">Select range</option><option>2-5</option><option>5 - 10</option><option>10 - 20</option><option>20 - 50</option></select></label>
              <label className="block text-sm font-semibold text-ink">Approximate no. of Trainees<select required value={cbt.trainees_count} onChange={(e) => setCbt({ ...cbt, trainees_count: e.target.value })} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm"><option value="">Select range</option><option>20 - 50</option><option>50 - 100</option><option>100 - above</option></select></label>
              <label className="block text-sm font-semibold text-ink">WhatsApp Number<input type="tel" required value={cbt.whatsapp_number} onChange={(e) => setCbt({ ...cbt, whatsapp_number: e.target.value })} className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
            </div> : <>
              <label className="mt-4 block text-sm font-semibold text-ink">JAMB Registration Number<input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} required placeholder="e.g. 12345678AB" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
              <label className="mt-4 block text-sm font-semibold text-ink">Candidate Full Name<input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Enter full name as on JAMB record" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
              <label className="mt-4 block text-sm font-semibold text-ink">Exam Year<input value={examYear} onChange={(e) => setExamYear(e.target.value.replace(/\D/g, '').slice(0, 4))} required inputMode="numeric" placeholder="e.g. 2026" className="mt-1.5 w-full rounded-lg border border-parchment-line bg-cream px-3 py-2.5 text-sm" /></label>
            </>}
            {feedback && <p className={`mt-3 rounded-lg p-3 text-sm ${feedback.status === 'success' ? 'bg-success-500/10 text-success-700' : 'bg-ember-500/10 text-ember-600'}`}>{feedback.message}</p>}
            <button disabled={sending} className="mt-4 flex items-center gap-2 rounded-lg bg-gold-500 px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-60">
              {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Continue to payment
            </button>
          </form>
        </div>
      </div>
      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={submit} />
    </AppShell>
  );
}
