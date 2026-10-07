import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ExternalLink, Globe2, Loader2, School, ShieldCheck } from 'lucide-react';
import AppShell from '../components/AppShell';
import { PinConfirmDialog } from '../components/PinConfirmDialog';
import { api, ApiError } from '../lib/api';

const DEMO_URL = 'https://edutracng.netlify.app/';
type Plan = { plan: 'MONTHLY' | 'TERMLY' | 'ANNUAL'; label: string; months: number; unit_price: number; is_active: boolean };
type Subscription = { id: string; reference: string; plan: string; status: string; amount: number; created_at: string; starts_at: string | null; expires_at: string | null };
const money = (amount: number) => `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;

export default function SchoolWebsitePage() {
  const nav = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan['plan']>('TERMLY');
  const [schoolName, setSchoolName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [planResult, subscriptionsResult] = await Promise.all([
        api.get<{ data: Plan[] }>('/school-website/plans'),
        api.get<{ data: Subscription[] }>('/school-website/subscriptions')
      ]);
      setPlans(planResult.data ?? []);
      setSubscriptions(subscriptionsResult.data ?? []);
    } catch {
      setMessage('Unable to load school website plans. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  function preparePurchase(event: FormEvent) {
    event.preventDefault();
    if (schoolName.trim().length < 2 || contactPhone.trim().length < 7) {
      setMessage('Enter the school name and a valid contact phone number.');
      return;
    }
    setMessage('');
    setShowPin(true);
  }

  async function purchase(pin: string) {
    setShowPin(false);
    setBusy(true);
    setMessage('');
    try {
      const result = await api.postSlip<{ message: string }>('/school-website/subscribe', {
        plan: selectedPlan, school_name: schoolName.trim(), contact_phone: contactPhone.trim(), pin
      }, api.newIdempotencyKey());
      setMessage(result.message);
      setSchoolName('');
      setContactPhone('');
      await loadData();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Could not place this subscription request. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const chosen = plans.find((plan) => plan.plan === selectedPlan);

  return <AppShell>
    <div className="mx-auto max-w-5xl pb-10">
      <button onClick={() => nav('/dashboard')} className="flex items-center gap-1.5 font-body text-sm font-semibold text-gold-700"><ArrowLeft size={15}/> Dashboard</button>
      <header className="mt-5 overflow-hidden rounded-3xl border border-parchment-line bg-gradient-to-br from-ink via-ink to-brand-800 p-6 text-cream shadow-sm sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-300"><School size={15}/> Education services</span>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">School Website</h1>
          <p className="mt-3 max-w-xl font-body text-sm leading-6 text-cream/80">Explore EduTrac School Management System, view the live sample, and request a subscription for your school from one place.</p>
          <a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-2.5 font-display text-sm font-bold text-ink transition hover:bg-gold-300">Open EduTrac sample <ExternalLink size={15}/></a>
        </div><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-gold-300"><Globe2 size={32}/></div></div>
      </header>

      <section className="mt-6 rounded-2xl border border-parchment-line bg-parchment p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-display text-xl font-bold text-ink">See the sample</h2><p className="mt-1 text-sm text-ink-600">EduTrac’s live sample opens here when the provider allows embedded previews.</p></div><a href={DEMO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-gold-700">Open in new tab <ExternalLink size={14}/></a></div>
        <div className="mt-4 overflow-hidden rounded-xl border border-parchment-line bg-white"><iframe title="EduTrac School Management System sample" src={DEMO_URL} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-[420px] w-full border-0" /></div>
        <p className="mt-2 text-xs text-ink-600">If the sample does not display inside this page, use “Open in new tab”.</p>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-2xl border border-parchment-line bg-parchment p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-ink">Choose a subscription</h2><p className="mt-1 text-sm text-ink-600">Sample prices are shown below. The current price is controlled by K-Tech admin.</p>
          {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-ink-600"><Loader2 className="animate-spin" size={16}/> Loading plans…</div> : <div className="mt-4 grid gap-3 sm:grid-cols-3">{plans.map((plan) => <button key={plan.plan} type="button" onClick={() => setSelectedPlan(plan.plan)} disabled={!plan.is_active} className={`rounded-xl border p-4 text-left transition ${selectedPlan === plan.plan ? 'border-gold-500 bg-gold-500/10 ring-2 ring-gold-500/20' : 'border-parchment-line bg-white'} disabled:cursor-not-allowed disabled:opacity-50`}><span className="text-sm font-semibold text-ink">{plan.label}</span><span className="mt-2 block font-display text-xl font-bold text-gold-700">{money(plan.unit_price)}</span><span className="mt-1 block text-xs text-ink-600">{plan.months} month{plan.months === 1 ? '' : 's'}{plan.is_active ? '' : ' • unavailable'}</span></button>)}</div>}
          <form onSubmit={preparePurchase} className="mt-5 space-y-3">
            <label className="block text-sm font-medium text-ink-700">School name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} maxLength={120} required className="mt-1 w-full rounded-lg border border-parchment-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500" placeholder="Enter your school name" /></label>
            <label className="block text-sm font-medium text-ink-700">Contact phone<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} maxLength={24} required inputMode="tel" className="mt-1 w-full rounded-lg border border-parchment-line bg-white px-3 py-2.5 text-sm outline-none focus:border-gold-500" placeholder="Phone number for setup follow-up" /></label>
            <div className="rounded-lg bg-white/75 p-3 text-sm text-ink-700"><div className="flex items-center justify-between"><span>{chosen?.label ?? 'Selected plan'}</span><strong>{chosen ? money(chosen.unit_price) : '—'}</strong></div><p className="mt-1 text-xs text-ink-600">Wallet payment is taken when you submit. Our team will provision the subscription and activate it.</p></div>
            <button disabled={busy || loading || !chosen?.is_active} type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold-500 py-3 font-display text-sm font-bold text-ink transition hover:bg-gold-600 disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={16}/> : <ShieldCheck size={16}/>} {busy ? 'Submitting…' : 'Subscribe with wallet'}</button>
          </form>
          {message && <p role="status" className="mt-4 rounded-lg bg-white p-3 text-sm font-medium text-ink-700">{message}</p>}
        </div>

        <div className="rounded-2xl border border-parchment-line bg-white p-5 sm:p-6"><div className="flex items-center gap-2"><Check className="text-success-600" size={19}/><h2 className="font-display text-xl font-bold text-ink">My subscriptions</h2></div><p className="mt-1 text-sm text-ink-600">Track requests, activation, and expiry dates.</p>
          {subscriptions.length ? <div className="mt-4 space-y-3">{subscriptions.map((subscription) => <article key={subscription.id} className="rounded-xl border border-parchment-line bg-cream p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-ink">{String(subscription.plan)}</h3><p className="mt-1 font-mono text-xs text-ink-600">{subscription.reference}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${subscription.status === 'success' ? 'bg-success-500/15 text-success-700' : subscription.status === 'pending' ? 'bg-gold-500/15 text-gold-700' : 'bg-ember-500/15 text-ember-700'}`}>{subscription.status === 'success' ? 'Active' : subscription.status === 'pending' ? 'Awaiting activation' : subscription.status}</span></div><p className="mt-2 text-sm font-semibold text-ink">{money(subscription.amount)}</p>{subscription.expires_at && <p className="mt-1 text-xs text-ink-600">Expires: {new Date(subscription.expires_at).toLocaleDateString()}</p>}</article>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-parchment-line p-6 text-center text-sm text-ink-600">No school website subscriptions yet.</p>}
        </div>
      </section>
      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={purchase}/>
    </div>
  </AppShell>;
}
