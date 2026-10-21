import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { ArrowRight, BadgeCheck, BarChart3, Building2, CheckCircle2, Code2, KeyRound, ShieldCheck, WalletCards, Webhook } from 'lucide-react';

const serviceCards = [
  { icon: ShieldCheck, key: 'identity', tone: 'from-blue-600 to-indigo-700' },
  { icon: BarChart3, key: 'data', tone: 'from-violet-600 to-purple-700' },
  { icon: WalletCards, key: 'wallet', tone: 'from-emerald-600 to-teal-700' },
  { icon: Webhook, key: 'async', tone: 'from-amber-500 to-orange-600' }
] as const;

const plans = [
  { key: 'starter', featured: false },
  { key: 'growth', featured: true },
  { key: 'enterprise', featured: false }
] as const;

export default function EnterpriseApiPage() {
  const { t } = useTranslation();
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950"><Code2 size={22} /></span>
            <span><strong className="block text-sm">K-Tech Solutions</strong><small className="text-xs text-slate-400">Enterprise API Platform</small></span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link to="/partner-docs" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 sm:block">{t('partnerPortal.enterpriseApi.documentation')}</Link>
            <Link to="/partner-dashboard" className="rounded-lg bg-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-300">{t('partnerPortal.enterpriseApi.signIn')}</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.2),_transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200"><Building2 size={14} /> {t('partnerPortal.enterpriseApi.eyebrow')}</span>
            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">{t('partnerPortal.enterpriseApi.heroTitle')}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{t('partnerPortal.enterpriseApi.heroBody')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/partner-register" className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-300">{t('partnerPortal.enterpriseApi.apply')} <ArrowRight size={17} /></Link>
              <Link to="/partner-docs" className="rounded-xl border border-white/20 px-5 py-3 font-semibold text-white hover:bg-white/10">{t('partnerPortal.enterpriseApi.viewDocs')}</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
              {['https', 'idempotency', 'webhooks'].map((key) => <span key={key} className="inline-flex items-center gap-2"><CheckCircle2 size={15} className="text-cyan-300" />{t(`partnerPortal.enterpriseApi.trust.${key}`)}</span>)}
            </div>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/[0.06] p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/10 pb-4"><span className="text-sm font-bold text-slate-200">POST /api/v1/identity/verify</span><span className="rounded-full bg-emerald-400/15 px-2 py-1 text-[10px] font-bold text-emerald-300">200 OK</span></div>
            <pre className="mt-5 overflow-x-auto text-xs leading-7 text-cyan-100"><code>{`{
  "status": true,
  "reference": "MDL-8821",
  "data": {
    "result": "verified",
    "provider": "Musa Verification V1"
  }
}`}</code></pre>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl bg-white/5 p-3"><b className="block text-lg text-white">99.9%</b><span className="text-slate-400">uptime target</span></div><div className="rounded-xl bg-white/5 p-3"><b className="block text-lg text-white">60/min</b><span className="text-slate-400">standard rate</span></div><div className="rounded-xl bg-white/5 p-3"><b className="block text-lg text-white">24/7</b><span className="text-slate-400">delivery events</span></div></div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">{t('partnerPortal.enterpriseApi.servicesEyebrow')}</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">{t('partnerPortal.enterpriseApi.servicesTitle')}</h2><p className="mt-4 text-slate-400">{t('partnerPortal.enterpriseApi.servicesBody')}</p></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {serviceCards.map(({ icon: Icon, key, tone }) => <article key={key} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05]"><div className={`bg-gradient-to-br ${tone} p-5`}><Icon size={25} /><h3 className="mt-10 text-xl font-bold">{t(`partnerPortal.enterpriseApi.services.${key}.title`)}</h3></div><p className="p-5 text-sm leading-6 text-slate-400">{t(`partnerPortal.enterpriseApi.services.${key}.body`)}</p></article>)}
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-7xl px-5 py-16"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-300">{t('partnerPortal.enterpriseApi.accessEyebrow')}</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">{t('partnerPortal.enterpriseApi.accessTitle')}</h2><p className="mt-4 text-slate-400">{t('partnerPortal.enterpriseApi.accessBody')}</p></div><div className="mt-10 grid gap-5 lg:grid-cols-3">{plans.map(({ key, featured }) => <article key={key} className={`rounded-2xl border p-6 ${featured ? 'border-cyan-300 bg-cyan-300/10 shadow-xl shadow-cyan-950/30' : 'border-white/10 bg-slate-900/70'}`}><div className="flex items-center justify-between"><h3 className="text-xl font-bold">{t(`partnerPortal.enterpriseApi.plans.${key}.title`)}</h3>{featured && <span className="rounded-full bg-cyan-300 px-2 py-1 text-[10px] font-black uppercase text-slate-950">{t('partnerPortal.enterpriseApi.recommended')}</span>}</div><p className="mt-3 min-h-12 text-sm text-slate-400">{t(`partnerPortal.enterpriseApi.plans.${key}.body`)}</p><ul className="mt-6 space-y-3 text-sm text-slate-200">{(t(`partnerPortal.enterpriseApi.plans.${key}.features`, { returnObjects: true }) as string[]).map((feature) => <li key={feature} className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan-300" />{feature}</li>)}</ul><Link to="/partner-register" className={`mt-7 block rounded-xl px-4 py-3 text-center text-sm font-bold ${featured ? 'bg-cyan-400 text-slate-950 hover:bg-cyan-300' : 'border border-white/20 text-white hover:bg-white/10'}`}>{t('partnerPortal.enterpriseApi.choosePlan')}</Link></article>)}</div></div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16"><div className="grid gap-5 md:grid-cols-3">{(['security', 'keys', 'support'] as const).map((key) => <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/10 text-cyan-300">{key === 'security' ? <ShieldCheck size={21} /> : key === 'keys' ? <KeyRound size={21} /> : <BadgeCheck size={21} />}</div><h3 className="mt-5 font-bold">{t(`partnerPortal.enterpriseApi.promise.${key}.title`)}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{t(`partnerPortal.enterpriseApi.promise.${key}.body`)}</p></div>)}</div></section>

      <footer className="border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} K-Tech Solutions · <Link to="/partner-docs" className="text-cyan-300 hover:underline">{t('partnerPortal.enterpriseApi.documentation')}</Link></footer>
    </main>
  );
}
