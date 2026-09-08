import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Eye,
  EyeOff,
  Gauge,
  KeyRound,
  Landmark,
  LoaderCircle,
  Lock,
  LogOut,
  Mail,
  Phone,
  PlusCircle,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Wallet as WalletIcon,
  Webhook,
  XCircle
} from 'lucide-react';

// Own base URL + token storage, deliberately separate from lib/api.ts's
// customer-app tokens (mdl_access_token/mdl_refresh_token) - a partner
// portal session is a different account type entirely, and the two must
// never be mixed up in the same browser.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const PORTAL_BASE = `${API_BASE}/api/partner-portal`;
const ACCESS_KEY = 'mdl_partner_portal_access_token';
const REFRESH_KEY = 'mdl_partner_portal_refresh_token';

type Partner = {
  id: string;
  business_name: string;
  email: string;
  phone: string | null;
  status: 'pending_review' | 'active' | 'suspended';
  wallet_balance: number;
};
type Wallet = {
  balance: number;
  currency: string;
  virtual_account_number: string | null;
  virtual_account_bank: string | null;
};
type ApiKey = { id: string; name: string; key_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string };
type Summary = { today_calls: number; total_calls: number; total_spend: number; successful_calls: number; failed_calls: number };
type CallsOverviewPoint = { date: string; calls: number };
type PriceRow = { service: string; label: string; unit_price: number };
type Transaction = {
  reference: string;
  type: string;
  status: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  description: string;
  created_at: string;
};
type WebhookConfig = { webhook_url: string | null; configured: boolean };
type ExactTransfer = { amount: number; reference: string; account_number: string; bank_name: string | null; expires_at: string | null };

function getTokens() {
  return { access: sessionStorage.getItem(ACCESS_KEY), refresh: sessionStorage.getItem(REFRESH_KEY) };
}
function setTokens(access: string, refresh: string) {
  sessionStorage.setItem(ACCESS_KEY, access);
  sessionStorage.setItem(REFRESH_KEY, refresh);
}
function clearTokens() {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

/** Attaches the portal session token and retries once after a silent refresh on a 401 - after that, the caller is logged out. */
async function portalFetch<T>(path: string, options: { method?: string; body?: unknown } = {}, isRetry = false): Promise<T> {
  const { method = 'GET', body } = options;
  const { access } = getTokens();
  const res = await fetch(`${PORTAL_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await res.json().catch(() => null);

  if (res.status === 401 && !isRetry) {
    const { refresh } = getTokens();
    if (refresh) {
      try {
        const refreshed = await fetch(`${PORTAL_BASE}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh })
        }).then((r) => r.json());
        if (refreshed?.status) {
          setTokens(refreshed.data.access_token, refreshed.data.refresh_token);
          return portalFetch<T>(path, options, true);
        }
      } catch {
        // fall through to the logout below
      }
    }
    clearTokens();
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) throw new Error(payload?.message ?? 'Something went wrong. Please try again.');
  return payload as T;
}

export default function PartnerDashboardPage() {
  const { t } = useTranslation();
  const [checkedSession, setCheckedSession] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [callsOverview, setCallsOverview] = useState<CallsOverviewPoint[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function loadTransactions(query = '') {
    const res = await portalFetch<{ data: Transaction[] }>(`/transactions?limit=25${query ? `&search=${encodeURIComponent(query)}` : ''}`).catch(() => null);
    if (res) setTransactions(res.data);
  }

  async function loadEverything() {
    const me = await portalFetch<{ data: Partner }>('/me');
    setPartner(me.data);
    const [walletRes, keysRes, webhookRes, summaryRes, overviewRes, pricesRes] = await Promise.all([
      portalFetch<{ data: Wallet }>('/wallet').catch(() => null),
      portalFetch<{ data: ApiKey[] }>('/api-keys').catch(() => null),
      portalFetch<{ data: WebhookConfig }>('/webhook').catch(() => null),
      portalFetch<{ data: Summary }>('/summary').catch(() => null),
      portalFetch<{ data: CallsOverviewPoint[] }>('/calls-overview').catch(() => null),
      portalFetch<{ data: PriceRow[] }>('/pricing').catch(() => null)
    ]);
    if (walletRes) setWallet(walletRes.data);
    if (keysRes) setKeys(keysRes.data);
    if (webhookRes) setWebhook(webhookRes.data);
    if (summaryRes) setSummary(summaryRes.data);
    if (overviewRes) setCallsOverview(overviewRes.data);
    if (pricesRes) setPrices(pricesRes.data);
    await loadTransactions();
  }

  useEffect(() => {
    const { access } = getTokens();
    if (!access) {
      setCheckedSession(true);
      return;
    }
    loadEverything()
      .catch(() => setPartner(null))
      .finally(() => setCheckedSession(true));
  }, []);

  useEffect(() => {
    if (!partner) return;
    const timer = setTimeout(() => void loadTransactions(search), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function onAuthSuccess(data: { access_token: string; refresh_token: string; partner: Partner }) {
    setTokens(data.access_token, data.refresh_token);
    setPartner(data.partner);
    void loadEverything();
  }

  function logout() {
    clearTokens();
    setPartner(null);
    setWallet(null);
    setKeys([]);
    setWebhook(null);
    setSummary(null);
    setCallsOverview([]);
    setPrices([]);
    setTransactions([]);
    setNotice('');
    setError('');
  }

  if (!checkedSession) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-slate-600">
        <LoaderCircle className="animate-spin" /> {t('partnerPortal.common.loading')}
      </main>
    );
  }

  if (!partner) {
    return <AuthGate onSuccess={onAuthSuccess} />;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-700 p-2 text-white">
              <Activity size={21} />
            </div>
            <div>
              <p className="font-bold">{t('partnerPortal.header.appName')}</p>
              <p className="text-xs text-slate-500">{t('partnerPortal.header.tagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              to="/partner-docs"
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <BookOpen size={16} />
              {t('partnerPortal.header.documentation')}
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={16} />
              {t('partnerPortal.header.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {error && (
          <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
        {notice && (
          <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <section className="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-600 p-6 text-white">
          <p className="text-sm text-blue-100">{t('partnerPortal.hero.welcomeBack')}</p>
          <h1 className="mt-1 text-2xl font-bold">{partner.business_name}</h1>
          <p className="mt-3 text-3xl font-bold">₦{partner.wallet_balance.toLocaleString()}</p>
          <p className="text-sm text-blue-100">{t('partnerPortal.hero.walletBalance')}</p>
        </section>

        {partner.status !== 'active' && (
          <section
            className={`mt-6 flex items-start gap-3 rounded-2xl border p-5 ${
              partner.status === 'pending_review'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <AlertTriangle size={20} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">
                {partner.status === 'pending_review'
                  ? t('partnerPortal.banner.pendingTitle')
                  : t('partnerPortal.banner.suspendedTitle')}
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                {partner.status === 'pending_review'
                  ? t('partnerPortal.banner.pendingBody', { email: partner.email })
                  : t('partnerPortal.banner.suspendedBody')}
              </p>
            </div>
          </section>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard icon={CalendarCheck2} border="border-l-blue-500" iconColor="text-blue-600" label={t('partnerPortal.metrics.todayCalls')} value={summary?.today_calls ?? 0} />
          <MetricCard icon={Gauge} border="border-l-amber-500" iconColor="text-amber-600" label={t('partnerPortal.metrics.totalCalls')} value={summary?.total_calls ?? 0} />
          <MetricCard
            icon={CircleDollarSign}
            border="border-l-rose-500"
            iconColor="text-rose-600"
            label={t('partnerPortal.metrics.totalSpend')}
            value={`₦${(summary?.total_spend ?? 0).toLocaleString()}`}
          />
          <MetricCard icon={CheckCircle2} border="border-l-emerald-500" iconColor="text-emerald-600" label={t('partnerPortal.metrics.successfulCalls')} value={summary?.successful_calls ?? 0} />
          <MetricCard icon={XCircle} border="border-l-rose-500" iconColor="text-rose-600" label={t('partnerPortal.metrics.failedCalls')} value={summary?.failed_calls ?? 0} />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">{t('partnerPortal.callsOverview.title')}</h2>
          <CallsOverviewChart data={callsOverview} />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <WalletCard wallet={wallet} onError={setError} onNotice={setNotice} onWallet={setWallet} />
          <ApiKeysCard
            keys={keys}
            active={partner.status === 'active'}
            onError={setError}
            onNotice={setNotice}
            onKeys={setKeys}
          />
        </section>

        <section className="mt-6">
          <WebhookCard webhook={webhook} onError={setError} onNotice={setNotice} onWebhook={setWebhook} />
        </section>

        {prices.length > 0 && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Tag className="text-brand-700" size={20} />
              <h2 className="font-bold">{t('partnerPortal.pricing.title')}</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              <Trans i18nKey="partnerPortal.pricing.subtitle" components={{ code: <code /> }} />
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {prices.map((p) => (
                <div key={p.service} className="rounded-xl border-l-4 border-l-brand-600 bg-blue-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">{p.label}</p>
                  <p className="mt-1 text-lg font-bold text-brand-800">₦{p.unit_price.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="font-bold">{t('partnerPortal.callsSummary.title')}</h2>
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5">
              <Search size={14} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('partnerPortal.callsSummary.searchPlaceholder')}
                className="w-40 bg-transparent text-sm outline-none sm:w-56"
              />
            </div>
          </div>
          {transactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                    <th className="px-5 py-3 font-semibold">{t('partnerPortal.callsSummary.colReference')}</th>
                    <th className="px-3 py-3 font-semibold">{t('partnerPortal.callsSummary.colType')}</th>
                    <th className="px-3 py-3 font-semibold">{t('partnerPortal.callsSummary.colAmount')}</th>
                    <th className="px-3 py-3 font-semibold">{t('partnerPortal.callsSummary.colBalanceBefore')}</th>
                    <th className="px-3 py-3 font-semibold">{t('partnerPortal.callsSummary.colBalanceAfter')}</th>
                    <th className="px-3 py-3 font-semibold">{t('partnerPortal.callsSummary.colStatus')}</th>
                    <th className="px-5 py-3 font-semibold">{t('partnerPortal.callsSummary.colDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.reference}>
                      <td className="px-5 py-3 font-mono text-xs">{tx.reference}</td>
                      <td className="px-3 py-3 text-xs uppercase text-slate-500">{tx.type.replaceAll('_', ' ')}</td>
                      <td className="px-3 py-3 font-semibold">₦{tx.amount.toLocaleString()}</td>
                      <td className="px-3 py-3 text-slate-500">{tx.balance_before !== undefined ? `₦${tx.balance_before.toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-3 text-slate-500">{tx.balance_after !== undefined ? `₦${tx.balance_after.toLocaleString()}` : '—'}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold uppercase ${
                            tx.status === 'success' ? 'text-emerald-600' : tx.status === 'pending' ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">{new Date(tx.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{t('partnerPortal.callsSummary.empty')}</p>
          )}
        </section>
      </div>
    </main>
  );
}

// ── Metric card + calls-overview chart ──────────────────────────────────

function MetricCard({
  icon: Icon,
  border,
  iconColor,
  label,
  value
}: {
  icon: typeof Activity;
  border: string;
  iconColor: string;
  label: string;
  value: string | number;
}) {
  return (
    <article className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${border}`}>
      <Icon size={18} className={iconColor} />
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </article>
  );
}

function CallsOverviewChart({ data }: { data: CallsOverviewPoint[] }) {
  const { t } = useTranslation();
  if (data.length === 0) {
    return <p className="mt-6 py-10 text-center text-sm text-slate-400">{t('partnerPortal.callsOverview.empty')}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.calls));
  const width = 720;
  const height = 140;
  const barWidth = width / data.length;

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="h-40 w-full min-w-[640px]">
        {data.map((point, i) => {
          const barHeight = (point.calls / max) * height;
          return (
            <g key={point.date}>
              <rect
                x={i * barWidth + 2}
                y={height - barHeight}
                width={Math.max(barWidth - 4, 1)}
                height={barHeight}
                rx={2}
                className="fill-brand-500"
              >
                <title>
                  {point.date}: {point.calls} calls
                </title>
              </rect>
              {i % 5 === 0 && (
                <text x={i * barWidth + barWidth / 2} y={height + 15} textAnchor="middle" className="fill-slate-400 text-[9px]">
                  {point.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Login / Register ──────────────────────────────────────────────────

function AuthGate({ onSuccess }: { onSuccess: (data: { access_token: string; refresh_token: string; partner: Partner }) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const path = mode === 'login' ? '/login' : '/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { business_name: businessName, contact_phone: phone || undefined, email, password };
      const result = await portalFetch<{ data: { access_token: string; refresh_token: string; partner: Partner } }>(path, {
        method: 'POST',
        body
      });
      onSuccess(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('partnerPortal.auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto flex max-w-md justify-end pb-3">
        <LanguageSwitcher />
      </div>
      <section className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-brand-700 p-3 text-white">
            <ShieldCheck />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-700">{t('partnerPortal.header.appName')}</p>
            <h1 className="text-2xl font-bold">{t('partnerPortal.header.tagline')}</h1>
          </div>
        </div>

        <div className="mt-6 flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg py-2 ${mode === 'login' ? 'bg-white text-brand-700 shadow' : 'text-slate-500'}`}
          >
            {t('partnerPortal.auth.login')}
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-lg py-2 ${mode === 'register' ? 'bg-white text-brand-700 shadow' : 'text-slate-500'}`}
          >
            {t('partnerPortal.auth.register')}
          </button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Building2 size={16} className="text-brand-700" />
                {t('partnerPortal.auth.businessName')}
              </label>
              <input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={t('partnerPortal.auth.businessNamePlaceholder')}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Mail size={16} className="text-brand-700" />
              {t('partnerPortal.auth.email')}
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('partnerPortal.auth.emailPlaceholder')}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <Phone size={16} className="text-brand-700" />
                {t('partnerPortal.auth.phone')}
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('partnerPortal.auth.phonePlaceholder')}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
              />
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Lock size={16} className="text-brand-700" />
              {t('partnerPortal.auth.password')}
            </label>
            <div className="mt-2 flex rounded-lg border border-slate-300 focus-within:border-brand-500">
              <input
                required
                minLength={8}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? t('partnerPortal.auth.passwordPlaceholderRegister') : '••••••••'}
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-3 text-slate-500">
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {busy ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {mode === 'login' ? t('partnerPortal.auth.loginCta') : t('partnerPortal.auth.registerCta')}
          </button>
        </form>

        {mode === 'register' && (
          <p className="mt-5 text-xs leading-relaxed text-slate-500">{t('partnerPortal.auth.registerNotice')}</p>
        )}
      </section>
    </main>
  );
}

// ── Wallet ────────────────────────────────────────────────────────────

function WalletCard({
  wallet,
  onError,
  onNotice,
  onWallet
}: {
  wallet: Wallet | null;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
  onWallet: (w: Wallet) => void;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [exactTransfer, setExactTransfer] = useState<ExactTransfer | null>(null);
  const [busy, setBusy] = useState(false);

  async function createFundingAccount() {
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: Wallet }>('/wallet/funding-account', { method: 'POST' });
      onWallet(result.data);
      onNotice(t('partnerPortal.wallet.fundingAccountCreated'));
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.wallet.fundingAccountFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function createExactTransfer(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: ExactTransfer }>('/wallet/fund/dynamic', { method: 'POST', body: { amount: value } });
      setExactTransfer(result.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.wallet.exactTransferFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onNotice(t('partnerPortal.common.copied'));
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Landmark className="text-brand-700" size={20} />
        <h2 className="font-bold">{t('partnerPortal.wallet.title')}</h2>
      </div>

      {wallet?.virtual_account_number ? (
        <div className="mt-4 rounded-xl bg-blue-50 p-4">
          <p className="text-xs font-semibold text-slate-500">
            {wallet.virtual_account_bank ?? t('partnerPortal.wallet.bankTransferFallback')} · {t('partnerPortal.wallet.permanentAccount')}
          </p>
          <p className="mt-2 font-mono text-xl font-bold">{wallet.virtual_account_number}</p>
          <p className="mt-1 text-xs text-slate-600">{t('partnerPortal.wallet.transferHint')}</p>
          <button
            onClick={() => void copy(wallet.virtual_account_number!)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white"
          >
            <Copy size={15} />
            {t('partnerPortal.wallet.copyAccountNumber')}
          </button>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => void createFundingAccount()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          <WalletIcon size={16} />
          {busy ? t('partnerPortal.wallet.creating') : t('partnerPortal.wallet.createAccount')}
        </button>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-xs font-semibold text-slate-600">{t('partnerPortal.wallet.exactTransferLabel')}</p>
        <form onSubmit={createExactTransfer} className="mt-2 flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={t('partnerPortal.wallet.amountPlaceholder')}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
          />
          <button disabled={busy} className="rounded-lg border border-brand-700 px-3 text-sm font-semibold text-brand-700">
            {t('partnerPortal.common.generate')}
          </button>
        </form>
        {exactTransfer && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
            <p className="font-semibold">
              ₦{exactTransfer.amount.toLocaleString()} → {exactTransfer.bank_name ?? t('partnerPortal.wallet.bankTransferFallback')}
            </p>
            <p className="mt-1 font-mono font-bold">{exactTransfer.account_number}</p>
            <p className="mt-1 text-xs text-slate-600">
              {t('partnerPortal.wallet.refLabel')}: {exactTransfer.reference}
              {exactTransfer.expires_at ? ` · ${t('partnerPortal.wallet.expiresLabel')} ${new Date(exactTransfer.expires_at).toLocaleString()}` : ''}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

// ── API keys ──────────────────────────────────────────────────────────

function ApiKeysCard({
  keys,
  active,
  onError,
  onNotice,
  onKeys
}: {
  keys: ApiKey[];
  active: boolean;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
  onKeys: (k: ApiKey[]) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: { key: string } }>('/api-keys', { method: 'POST', body: { name: 'Live key' } });
      setRevealedKey(result.data.key);
      const refreshed = await portalFetch<{ data: ApiKey[] }>('/api-keys');
      onKeys(refreshed.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.apiKeys.generateFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    onError('');
    try {
      await portalFetch(`/api-keys/${id}/revoke`, { method: 'POST' });
      const refreshed = await portalFetch<{ data: ApiKey[] }>('/api-keys');
      onKeys(refreshed.data);
      onNotice(t('partnerPortal.apiKeys.revokedNotice'));
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.apiKeys.revokeFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onNotice(t('partnerPortal.common.copied'));
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="text-brand-700" size={20} />
          <h2 className="font-bold">{t('partnerPortal.apiKeys.title')}</h2>
        </div>
        <button
          disabled={busy || !active}
          onClick={() => void generate()}
          title={active ? undefined : t('partnerPortal.apiKeys.pendingApprovalTooltip')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          <PlusCircle size={14} />
          {t('partnerPortal.apiKeys.newKey')}
        </button>
      </div>

      {revealedKey && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-800">{t('partnerPortal.apiKeys.revealNotice')}</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{revealedKey}</code>
            <button onClick={() => void copy(revealedKey)} className="text-brand-700">
              <Copy size={15} />
            </button>
          </div>
          <button onClick={() => setRevealedKey(null)} className="mt-3 text-xs font-semibold text-amber-800 underline">
            {t('partnerPortal.apiKeys.savedIt')}
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {keys.length === 0 && <p className="text-sm text-slate-500">{t('partnerPortal.apiKeys.noKeys')}</p>}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <div>
              <p className="text-sm font-semibold">{k.name}</p>
              <p className="font-mono text-xs text-slate-500">{k.key_prefix}••••••••</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {k.revoked_at
                  ? t('partnerPortal.apiKeys.revokedOn', { date: new Date(k.revoked_at).toLocaleDateString() })
                  : k.last_used_at
                    ? t('partnerPortal.apiKeys.lastUsedOn', { date: new Date(k.last_used_at).toLocaleDateString() })
                    : t('partnerPortal.apiKeys.neverUsed')}
              </p>
            </div>
            {!k.revoked_at && (
              <button
                disabled={busy}
                onClick={() => void revoke(k.id)}
                className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                title={t('partnerPortal.apiKeys.revokeTitle')}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

// ── Webhook ───────────────────────────────────────────────────────────

function WebhookCard({
  webhook,
  onError,
  onNotice,
  onWebhook
}: {
  webhook: WebhookConfig | null;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
  onWebhook: (w: WebhookConfig) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState(webhook?.webhook_url ?? '');
  const [busy, setBusy] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: { webhook_url: string; webhook_secret: string } }>('/webhook', {
        method: 'POST',
        body: { webhook_url: url }
      });
      setRevealedSecret(result.data.webhook_secret);
      onWebhook({ webhook_url: result.data.webhook_url, configured: true });
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    onError('');
    try {
      await portalFetch('/webhook/test', { method: 'POST' });
      onNotice(t('partnerPortal.webhook.testQueued'));
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.testFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onNotice(t('partnerPortal.common.copied'));
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2">
        <Webhook className="text-brand-700" size={20} />
        <h2 className="font-bold">{t('partnerPortal.webhook.title')}</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        <Trans i18nKey="partnerPortal.webhook.description" components={{ code: <code /> }} />
      </p>

      <form onSubmit={save} className="mt-4 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          placeholder={t('partnerPortal.webhook.urlPlaceholder')}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
        <button disabled={busy} className="rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
          {t('partnerPortal.common.save')}
        </button>
      </form>

      {revealedSecret && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-bold text-amber-800">{t('partnerPortal.webhook.secretNotice')}</p>
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-white px-3 py-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{revealedSecret}</code>
            <button onClick={() => void copy(revealedSecret)} className="text-brand-700">
              <Copy size={15} />
            </button>
          </div>
        </div>
      )}

      {webhook?.configured && (
        <button
          disabled={busy}
          onClick={() => void sendTest()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand-700 px-3 py-2 text-xs font-semibold text-brand-700 disabled:opacity-50"
        >
          <CheckCircle2 size={14} />
          {t('partnerPortal.webhook.sendTest')}
        </button>
      )}
    </article>
  );
}
