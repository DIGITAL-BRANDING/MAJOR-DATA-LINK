import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { API_BASE } from '../lib/api';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Code2, KeyRound, LoaderCircle, Mail, Phone, ShieldCheck } from 'lucide-react';

const PORTAL_BASE = `${API_BASE}/api/partner-portal`;
const ACCESS_KEY = 'mdl_partner_portal_access_token';
const REFRESH_KEY = 'mdl_partner_portal_refresh_token';

type RegistrationForm = {
  businessName: string;
  contactName: string;
  phone: string;
  companyRegistrationNumber: string;
  businessType: string;
  websiteUrl: string;
  useCase: string;
  expectedMonthlyVolume: string;
  integrationEnvironment: 'sandbox' | 'production' | 'both';
  requestedServices: string[];
  technicalContactEmail: string;
  technicalContactPhone: string;
  email: string;
  password: string;
};

const initialForm: RegistrationForm = {
  businessName: '',
  contactName: '',
  phone: '',
  companyRegistrationNumber: '',
  businessType: '',
  websiteUrl: '',
  useCase: '',
  expectedMonthlyVolume: '',
  integrationEnvironment: 'sandbox',
  requestedServices: ['identity'],
  technicalContactEmail: '',
  technicalContactPhone: '',
  email: '',
  password: ''
};

const services = ['identity', 'data', 'wallet', 'async'] as const;

export default function EnterpriseRegistrationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof RegistrationForm>(key: K, value: RegistrationForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleService = (service: string) => {
    update('requestedServices', form.requestedServices.includes(service) ? form.requestedServices.filter((item) => item !== service) : [...form.requestedServices, service]);
  };

  function goNext() {
    setError('');
    if (step === 1 && (!form.businessName.trim() || !form.contactName.trim() || !form.businessType)) {
      setError(t('partnerPortal.registrationPage.companyRequired'));
      return;
    }
    if (step === 2 && (form.requestedServices.length === 0 || form.useCase.trim().length < 10)) {
      setError(t('partnerPortal.registrationPage.integrationRequired'));
      return;
    }
    setStep((current) => Math.min(current + 1, 3));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (step < 3) {
      goNext();
      return;
    }
    if (!consent) {
      setError(t('partnerPortal.registrationPage.consentRequired'));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${PORTAL_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: form.businessName.trim(),
          contact_name: form.contactName.trim(),
          contact_phone: form.phone.trim() || undefined,
          company_registration_number: form.companyRegistrationNumber.trim() || undefined,
          business_type: form.businessType,
          website_url: form.websiteUrl.trim() || undefined,
          use_case: form.useCase.trim(),
          expected_monthly_volume: form.expectedMonthlyVolume ? Number(form.expectedMonthlyVolume) : undefined,
          requested_services: form.requestedServices,
          integration_environment: form.integrationEnvironment,
          technical_contact_email: form.technicalContactEmail.trim() || undefined,
          technical_contact_phone: form.technicalContactPhone.trim() || undefined,
          email: form.email.trim(),
          password: form.password
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.status) throw new Error(payload?.message ?? t('partnerPortal.auth.genericError'));
      sessionStorage.setItem(ACCESS_KEY, payload.data.access_token);
      sessionStorage.setItem(REFRESH_KEY, payload.data.refresh_token);
      navigate('/partner-dashboard?view=overview', { replace: true });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t('partnerPortal.auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/enterprise-api" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950"><Code2 size={22} /></span><span><strong className="block text-sm">K-Tech Solutions</strong><small className="text-xs text-slate-400">Enterprise API onboarding</small></span></Link>
          <div className="flex items-center gap-3"><LanguageSwitcher /><Link to="/partner-dashboard" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">{t('partnerPortal.registrationPage.signIn')}</Link></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[.72fr_1.28fr] lg:py-20">
        <aside>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[.16em] text-cyan-200"><Building2 size={14} /> {t('partnerPortal.registrationPage.eyebrow')}</span>
          <h1 className="mt-6 text-4xl font-black leading-tight sm:text-5xl">{t('partnerPortal.registrationPage.title')}</h1>
          <p className="mt-5 max-w-xl leading-7 text-slate-400">{t('partnerPortal.registrationPage.body')}</p>
          <div className="mt-8 space-y-4">
            {[ShieldCheck, KeyRound, CheckCircle2].map((Icon, index) => <div key={index} className="flex gap-3"><Icon className="mt-0.5 shrink-0 text-cyan-300" size={19} /><p className="text-sm text-slate-300">{t(`partnerPortal.registrationPage.benefit${index + 1}`)}</p></div>)}
          </div>
        </aside>

        <section className="rounded-3xl border border-white/10 bg-white/[.06] p-5 shadow-2xl shadow-cyan-950/30 sm:p-8">
          <div className="mb-8 grid grid-cols-3 gap-2">
            {[t('partnerPortal.registrationPage.stepCompany'), t('partnerPortal.registrationPage.stepIntegration'), t('partnerPortal.registrationPage.stepAccess')].map((label, index) => <div key={label} className={`rounded-xl px-3 py-3 text-center text-xs font-bold ${step === index + 1 ? 'bg-cyan-400 text-slate-950' : step > index + 1 ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-400'}`}><span className="block text-[10px] uppercase tracking-wider">{index + 1}</span>{label}</div>)}
          </div>

          <form onSubmit={submit} className="space-y-5">
            {step === 1 && <>
              <div><h2 className="text-xl font-bold">{t('partnerPortal.registrationPage.companySection')}</h2><p className="mt-1 text-sm text-slate-400">{t('partnerPortal.registrationPage.companyHint')}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('partnerPortal.auth.businessName')} value={form.businessName} onChange={(value) => update('businessName', value)} required placeholder={t('partnerPortal.auth.businessNamePlaceholder')} />
                <Field label={t('partnerPortal.auth.contactName')} value={form.contactName} onChange={(value) => update('contactName', value)} required placeholder={t('partnerPortal.auth.contactNamePlaceholder')} />
                <Field label={t('partnerPortal.auth.phone')} value={form.phone} onChange={(value) => update('phone', value)} placeholder={t('partnerPortal.auth.phonePlaceholder')} icon={<Phone size={15} />} />
                <Field label={t('partnerPortal.auth.companyRegistrationNumber')} value={form.companyRegistrationNumber} onChange={(value) => update('companyRegistrationNumber', value)} placeholder={t('partnerPortal.auth.companyRegistrationNumberPlaceholder')} />
                <SelectField label={t('partnerPortal.auth.businessType')} value={form.businessType} onChange={(value) => update('businessType', value)} options={[['', t('partnerPortal.auth.selectBusinessType')], ['fintech', 'Fintech / Payments'], ['telco', 'Telecom / Aggregator'], ['school', 'School / Institution'], ['government', 'Government / NGO'], ['other', t('partnerPortal.auth.otherBusinessType')]]} />
                <Field label={t('partnerPortal.auth.website')} value={form.websiteUrl} onChange={(value) => update('websiteUrl', value)} placeholder="https://example.com" type="url" />
              </div>
            </>}

            {step === 2 && <>
              <div><h2 className="text-xl font-bold">{t('partnerPortal.registrationPage.integrationSection')}</h2><p className="mt-1 text-sm text-slate-400">{t('partnerPortal.registrationPage.integrationHint')}</p></div>
              <div><p className="mb-2 text-sm font-semibold">{t('partnerPortal.auth.requestedServices')}</p><div className="grid gap-3 sm:grid-cols-2">{services.map((value) => <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm text-slate-200 hover:border-cyan-300/50"><input type="checkbox" checked={form.requestedServices.includes(value)} onChange={() => toggleService(value)} className="h-4 w-4 accent-cyan-400" />{t(`partnerPortal.enterpriseApi.services.${value}.title`)}</label>)}</div></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label={t('partnerPortal.auth.expectedVolume')} value={form.expectedMonthlyVolume} onChange={(value) => update('expectedMonthlyVolume', value)} type="number" min="1" placeholder="e.g. 5000" /><SelectField label={t('partnerPortal.auth.environment')} value={form.integrationEnvironment} onChange={(value) => update('integrationEnvironment', value as RegistrationForm['integrationEnvironment'])} options={[['sandbox', 'Sandbox first'], ['production', 'Production'], ['both', 'Sandbox and production']]} /></div>
              <div><label className="text-sm font-semibold">{t('partnerPortal.auth.useCase')}<textarea required minLength={10} value={form.useCase} onChange={(event) => update('useCase', event.target.value)} rows={4} placeholder={t('partnerPortal.auth.useCasePlaceholder')} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300" /></label></div>
              <div className="grid gap-4 sm:grid-cols-2"><Field label={t('partnerPortal.auth.technicalEmail')} value={form.technicalContactEmail} onChange={(value) => update('technicalContactEmail', value)} type="email" placeholder="developer@company.com" icon={<Mail size={15} />} /><Field label={t('partnerPortal.auth.technicalPhone')} value={form.technicalContactPhone} onChange={(value) => update('technicalContactPhone', value)} placeholder="08012345678" /></div>
            </>}

            {step === 3 && <>
              <div><h2 className="text-xl font-bold">{t('partnerPortal.registrationPage.accountSection')}</h2><p className="mt-1 text-sm text-slate-400">{t('partnerPortal.registrationPage.accountHint')}</p></div>
              <Field label={t('partnerPortal.auth.email')} value={form.email} onChange={(value) => update('email', value)} required type="email" placeholder={t('partnerPortal.auth.emailPlaceholder')} icon={<Mail size={15} />} />
              <Field label={t('partnerPortal.auth.password')} value={form.password} onChange={(value) => update('password', value)} required type="password" min="8" placeholder={t('partnerPortal.auth.passwordPlaceholderRegister')} icon={<KeyRound size={15} />} />
              <label className="flex gap-3 rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm leading-6 text-slate-300"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-400" />{t('partnerPortal.registrationPage.consent')}</label>
            </>}

            {error && <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            <div className="flex flex-wrap justify-between gap-3 pt-2"><button type="button" onClick={() => setStep((current) => Math.max(current - 1, 1))} disabled={step === 1 || busy} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-300 disabled:invisible"><ArrowLeft size={16} />{t('partnerPortal.registrationPage.back')}</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">{busy ? <LoaderCircle size={17} className="animate-spin" /> : step === 3 ? <ShieldCheck size={17} /> : <ArrowRight size={17} />}{busy ? t('partnerPortal.registrationPage.submitting') : step === 3 ? t('partnerPortal.registrationPage.submit') : t('partnerPortal.registrationPage.next')}</button></div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, placeholder, icon, min }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; placeholder?: string; icon?: ReactNode; min?: string }) {
  return <label className="block text-sm font-semibold text-slate-200">{label}{required && <span className="ml-1 text-cyan-300">*</span>}<span className="mt-2 flex items-center rounded-xl border border-white/15 bg-slate-900 px-3 focus-within:border-cyan-300">{icon && <span className="mr-2 text-cyan-300">{icon}</span>}<input required={required} type={type} min={min} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600" /></span></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="block text-sm font-semibold text-slate-200">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-300">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
