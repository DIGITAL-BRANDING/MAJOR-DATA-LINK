import { useEffect, useState, type FormEvent } from 'react';
import PromoIllustrationBadge, { isPromoIllustrationKey } from '../components/PromoIllustration';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LiveChatWidget from '../components/LiveChatWidget';
import { API_BASE } from '../lib/api';
import { isWebPushSupported, removeWebPushSubscription, syncWebPush } from '../lib/web-push';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Download,
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
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  Wallet as WalletIcon,
  Webhook,
  X,
  XCircle
} from 'lucide-react';

// Own token storage, deliberately separate from lib/api.ts's customer-app
// tokens (mdl_access_token/mdl_refresh_token) - a partner portal session is
// a different account type entirely, and the two must never be mixed up in
// the same browser. API_BASE itself is shared (imported above) rather than
// re-read here, so this page gets the same same-origin-mismatch protection
// as the rest of the app - see resolveApiBase() in lib/api.ts.
const PORTAL_BASE = `${API_BASE}/api/partner-portal`;
const ACCESS_KEY = 'mdl_partner_portal_access_token';
const REFRESH_KEY = 'mdl_partner_portal_refresh_token';

type Partner = {
  id: string;
  business_name: string;
  email: string;
  phone: string | null;
  enterprise_offer_code: string | null;
  enterprise_profile?: {
    contact_name: string | null;
    company_registration_number: string | null;
    business_type: string | null;
    website_url: string | null;
    use_case: string | null;
    expected_monthly_volume: number | null;
    requested_services: unknown;
    integration_environment: string | null;
    technical_contact_email: string | null;
    technical_contact_phone: string | null;
  };
  status: 'pending_review' | 'active' | 'suspended';
  wallet_balance: number;
  api_access: {
    tier: 'FUND_WALLET' | 'NIN_BVN' | 'FULL_API';
    wallet_balance: number;
    nin_bvn_minimum_deposit: number;
    full_api_minimum_deposit: number;
    nin_bvn_enabled: boolean;
    full_api_enabled: boolean;
  };
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
  id?: string;
  reference: string;
  type: string;
  status: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  description: string;
  provider?: string | null;
  provider_ref?: string | null;
  idempotency_key?: string;
  created_at: string;
  updated_at?: string;
};
type TransactionDetail = Transaction & { cost: number | null; request_updates: Array<{ id: string; message: string; created_at: string }> };
type WebhookConfig = { webhook_url: string | null; configured: boolean };
type WebhookDelivery = { event_id: string; event: string; status: string; attempts: number; response_status: number | null; last_error: string | null; created_at: string; delivered_at: string | null; next_attempt_at: string | null };
type WebhookHealth = {
  configured: boolean;
  window_days: number;
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  processing: number;
  delivery_rate: number | null;
  last_delivery: { event: string; status: string; attempts: number; response_status: number | null; created_at: string; delivered_at: string | null } | null;
  last_failure: { event: string; attempts: number; response_status: number | null; error: string | null; created_at: string } | null;
};
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

type PartnerNotice = {
  id: string;
  title: string;
  body: string;
  is_read?: boolean;
  broadcast_id?: string | null;
  is_persistent_broadcast?: boolean;
  show_as_popup?: boolean;
  created_at?: string;
  image_key?: string | null;
};

/**
 * Lets a partner turn on browser alerts. The browser only shows its permission
 * prompt after this click, which browsers (Safari especially) require.
 */
function PartnerPushToggle() {
  const [state, setState] = useState<'checking' | 'on' | 'off' | 'unsupported'>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isWebPushSupported()) {
      setState('unsupported');
      return;
    }
    const { access } = getTokens();
    if (!access || Notification.permission !== 'granted') {
      setState('off');
      return;
    }
    // Permission already granted: re-sync quietly so the subscription stays current.
    void syncWebPush(access, { prompt: false }).then((ok) => setState(ok ? 'on' : 'off'));
  }, []);

  if (state === 'checking' || state === 'unsupported') return null;
  if (state === 'on') {
    return <span className="text-xs font-semibold text-emerald-600">Alerts on</span>;
  }

  async function enable() {
    const { access } = getTokens();
    if (!access) return;
    setBusy(true);
    const ok = await syncWebPush(access, { prompt: true });
    setBusy(false);
    setState(ok ? 'on' : 'off');
  }

  return (
    <button
      type="button"
      onClick={enable}
      disabled={busy}
      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? 'Enabling…' : 'Turn on alerts'}
    </button>
  );
}

/**
 * Partner-portal counterpart of AppShell.tsx's NotificationBell - same
 * poll-every-30s/mark-read-on-open behaviour, just talking to
 * /api/partner-portal/notifications via portalFetch instead of the
 * customer-app `api` client.
 */
function PartnerNotificationBell() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PartnerNotice[]>([]);
  const [open, setOpen] = useState(false);
  const load = () =>
    portalFetch<{ data?: PartnerNotice[] }>('/notifications?limit=10')
      .then((r) => setItems(r.data ?? []))
      .catch(() => {});
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);
  const isPersistentBroadcast = (notice: PartnerNotice) => Boolean(notice.is_persistent_broadcast || notice.broadcast_id);
  const unread = items.filter((n) => !n.is_read && !isPersistentBroadcast(n)).length;
  async function toggle() {
    setOpen((v) => !v);
    if (unread) {
      const ids = items.filter((n) => !n.is_read && !isPersistentBroadcast(n)).map((n) => n.id);
      setItems((v) => v.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)));
      await portalFetch('/notifications/read', { method: 'POST', body: { ids } }).catch(() => {});
    }
  }
  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label="Open notifications"
        className="relative rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-50"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <section className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <b className="text-sm text-slate-900">{t('partnerPortal.notifications.recent')}</b>
            <button onClick={() => setOpen(false)} aria-label="Close notifications">
              <X size={17} />
            </button>
          </header>
          <div className="max-h-96 overflow-y-auto">
            {items.length ? (
              items.map((n) => (
                <article key={n.id} className="border-b border-slate-100 px-4 py-3 last:border-0">
                  <p className="text-sm font-bold text-slate-900">{n.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{n.body}</p>
                  <time className="mt-2 block text-[10px] text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</time>
                </article>
              ))
            ) : (
              <p className="p-5 text-center text-sm text-slate-600">{t('partnerPortal.notifications.empty')}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Partner-portal counterpart of components/NotificationPopup.tsx - same
 * newest-broadcast-wins logic (see that file's doc comment for the full
 * rationale), scoped to the partner session via portalFetch.
 */
function PartnerNotificationPopup() {
  const [notice, setNotice] = useState<PartnerNotice | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => {
      portalFetch<{ data?: PartnerNotice[] }>('/notifications?limit=20')
        .then((response) => {
          if (!active) return;
          const items = response.data ?? [];
          const broadcasts = items
            .filter((item) => Boolean(item.broadcast_id || item.is_persistent_broadcast))
            .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''));
          const newestBroadcast = broadcasts[0];

          const next = newestBroadcast
            ? (hiddenIds.includes(newestBroadcast.id) ? undefined : newestBroadcast)
            : items.find((item) => item.show_as_popup && !hiddenIds.includes(item.id));
          setNotice(next ?? null);
        })
        .catch(() => {
          // Notifications are optional; never block access to the portal.
        });
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [hiddenIds]);

  const close = () => {
    if (!notice) return;
    setHiddenIds((ids) => [...ids, notice.id]);
    setNotice(null);
  };

  if (!notice) return null;
  // Same design as the app's PromoPopupDialog (see components/NotificationPopup.tsx).
  const illustration = isPromoIllustrationKey(notice.image_key) ? notice.image_key : null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1C1C1E]/60 p-7" role="dialog" aria-modal="true" aria-labelledby="partner-notification-title">
      <div className="w-full max-w-md rounded-2xl bg-white px-6 pb-6 pt-8 text-center shadow-2xl">
        {illustration && (
          <>
            <PromoIllustrationBadge illustration={illustration} />
            <div className="h-5" />
          </>
        )}
        <h2 id="partner-notification-title" className="text-[19px] font-extrabold leading-tight text-[#1C1C1E]">{notice.title}</h2>
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-6 text-[#636366]">{notice.body}</p>
        <button type="button" onClick={close} className="mt-6 w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-bold text-white shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#F7C948]">
          Okay
        </button>
      </div>
    </div>
  );
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
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function transactionQuery(path = '/transactions') {
    const params = new URLSearchParams({ limit: '25' });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    return `${path}?${params.toString()}`;
  }

  async function loadTransactions() {
    const res = await portalFetch<{ data: Transaction[] }>(transactionQuery()).catch(() => null);
    if (res) setTransactions(res.data);
  }

  async function openTransaction(reference: string) {
    setDetailBusy(true);
    try {
      const res = await portalFetch<{ data: TransactionDetail }>(`/transactions/${encodeURIComponent(reference)}`);
      setSelectedTransaction(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load transaction details');
    } finally {
      setDetailBusy(false);
    }
  }

  async function exportTransactions() {
    const { access } = getTokens();
    const exportQuery = new URLSearchParams(transactionQuery('/transactions.csv').split('?')[1]);
    exportQuery.set('limit', '10000');
    const response = await fetch(`${PORTAL_BASE}/transactions.csv?${exportQuery.toString()}`, { headers: { Authorization: `Bearer ${access}` } });
    if (!response.ok) {
      setError('Could not export transactions');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `partner-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
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
    const timer = setTimeout(() => void loadTransactions(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, typeFilter, fromDate, toDate]);

  // Admin completion and provider reconciliation happen server-side. While
  // a partner still has an in-progress call, refresh the ledger quietly so a
  // completed request becomes SUCCESS without requiring a page reload.
  useEffect(() => {
    if (!partner || !transactions.some((transaction) => transaction.status === 'pending')) return;
    const timer = window.setInterval(() => void loadTransactions(), 15_000);
    return () => window.clearInterval(timer);
    // loadTransactions intentionally stays stable with the current portal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner, transactions, search, statusFilter, typeFilter, fromDate, toDate]);

  function onAuthSuccess(data: { access_token: string; refresh_token: string; partner: Partner }) {
    setTokens(data.access_token, data.refresh_token);
    setPartner(data.partner);
    void loadEverything();
  }

  function logout() {
    void removeWebPushSubscription();
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
      <PartnerNotificationPopup />
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
            <PartnerPushToggle />
            <PartnerNotificationBell />
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

        <section className="rounded-3xl border border-brand-900/40 bg-brand-800 bg-gradient-to-br from-brand-800 to-brand-600 p-6 text-white shadow-lg shadow-brand-900/20">
          <p className="text-sm font-medium text-blue-100">{t('partnerPortal.hero.welcomeBack')}</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{partner.business_name}</h1>
          <p className="mt-4 text-4xl font-extrabold tabular-nums tracking-tight text-white sm:text-5xl">
            ₦{partner.wallet_balance.toLocaleString()}
          </p>
          <p className="mt-1 text-sm font-medium text-blue-100">{t('partnerPortal.hero.walletBalance')}</p>
        </section>

        {partner.enterprise_offer_code && (
          <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">{t('partnerPortal.enterpriseOffer.title')}</p>
              <p className="mt-1 text-sm">{t('partnerPortal.enterpriseOffer.body')}</p>
            </div>
            <code className="rounded-lg bg-white px-4 py-2 text-base font-extrabold tracking-[0.12em] shadow-sm">{partner.enterprise_offer_code}</code>
          </section>
        )}

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

        {partner.status === 'active' && (
          <section className="mt-6 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-brand-700">Partner API access</p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">Welcome to the K-Tech Solutions Partner API.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Your account has been approved. Fund your wallet with a minimum of ₦{partner.api_access.nin_bvn_minimum_deposit.toLocaleString()} to activate NIN and BVN identity APIs. Maintain a minimum balance of ₦{partner.api_access.full_api_minimum_deposit.toLocaleString()} to unlock the full API suite, including data and airtime services.
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  Current access: {partner.api_access.tier === 'FULL_API' ? 'Full API access' : partner.api_access.tier === 'NIN_BVN' ? 'NIN & BVN API access' : 'Wallet funding required'}.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.api_access.full_api_enabled ? 'bg-emerald-100 text-emerald-800' : partner.api_access.nin_bvn_enabled ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                {partner.api_access.full_api_enabled ? 'FULL API' : partner.api_access.nin_bvn_enabled ? 'NIN / BVN' : 'FUND WALLET'}
              </span>
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
            <div>
              <h2 className="font-bold">{t('partnerPortal.callsSummary.title')}</h2>
              <p className="mt-1 text-xs text-slate-500">Click a row to inspect provider references and status updates.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void exportTransactions()} className="hidden items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:flex">
                <Download size={14} /> {t('partnerPortal.callsSummary.exportCsv')}
              </button>
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
          </div>
          <div className="grid gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">{t('partnerPortal.callsSummary.allStatuses')}</option>
              <option value="PENDING">Pending</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="REVERSED">Reversed</option>
              <option value="DECLINED">Declined</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">{t('partnerPortal.callsSummary.allTypes')}</option>
              <option value="NIN_VERIFICATION">NIN verification</option>
              <option value="BVN_VERIFICATION">BVN verification</option>
              <option value="IDENTITY_SERVICE_REQUEST">Identity service</option>
              <option value="DATA_PURCHASE">Data purchase</option>
              <option value="AIRTIME_PURCHASE">Airtime purchase</option>
              <option value="WALLET_FUNDING">Wallet funding</option>
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
              {t('partnerPortal.callsSummary.from')}
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">
              {t('partnerPortal.callsSummary.to')}
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" />
            </label>
            <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setFromDate(''); setToDate(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Clear filters</button>
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
                    <th className="px-5 py-3 font-semibold">{t('partnerPortal.callsSummary.details')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => (
                    <tr key={tx.reference} className="transition-colors hover:bg-blue-50/50">
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
                      <td className="px-5 py-3"><button type="button" onClick={() => void openTransaction(tx.reference)} className="font-semibold text-brand-700 hover:underline">{t('partnerPortal.callsSummary.details')}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">{t('partnerPortal.callsSummary.empty')}</p>
          )}
        </section>

        {selectedTransaction && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-5" role="dialog" aria-modal="true">
            <section className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{t('partnerPortal.callsSummary.detailTitle')}</p>
                  <h2 className="mt-1 break-all font-mono text-lg font-bold text-slate-900">{selectedTransaction.reference}</h2>
                </div>
                <button type="button" onClick={() => setSelectedTransaction(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600">{t('partnerPortal.callsSummary.close')}</button>
              </div>
              {detailBusy ? <p className="mt-6 text-sm text-slate-500">Loading…</p> : (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <DetailItem label="Status" value={selectedTransaction.status.toUpperCase()} />
                    <DetailItem label="Service" value={selectedTransaction.type.replaceAll('_', ' ')} />
                    <DetailItem label="Amount" value={`₦${selectedTransaction.amount.toLocaleString()}`} />
                    <DetailItem label="Provider" value={selectedTransaction.provider ?? '—'} />
                    <DetailItem label="Provider reference" value={selectedTransaction.provider_ref ?? '—'} />
                    <DetailItem label="Created" value={new Date(selectedTransaction.created_at).toLocaleString()} />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-bold">{t('partnerPortal.callsSummary.timeline')}</h3>
                    <div className="mt-3 space-y-3 border-l-2 border-brand-200 pl-4">
                      <div><p className="text-sm font-semibold">Request recorded</p><p className="text-xs text-slate-500">{new Date(selectedTransaction.created_at).toLocaleString()}</p></div>
                      {selectedTransaction.request_updates.map((update) => <div key={update.id}><p className="text-sm font-semibold">{update.message}</p><p className="text-xs text-slate-500">{new Date(update.created_at).toLocaleString()}</p></div>)}
                      {selectedTransaction.updated_at && selectedTransaction.updated_at !== selectedTransaction.created_at && <div><p className="text-sm font-semibold">Current status: {selectedTransaction.status}</p><p className="text-xs text-slate-500">Last updated {new Date(selectedTransaction.updated_at).toLocaleString()}</p></div>}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
      <LiveChatWidget
        active
        token={getTokens().access}
        ownerKey={partner.id}
        headerLabel="K-Tech Partner Support"
      />
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
    <article className={`rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${border}`}>
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 ${iconColor}`}>
        <Icon size={18} />
      </span>
      <p className="mt-3 text-xl font-bold tabular-nums text-slate-900 sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </article>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
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
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [useCase, setUseCase] = useState('');
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState('');
  const [requestedServices, setRequestedServices] = useState('');
  const [integrationEnvironment, setIntegrationEnvironment] = useState('sandbox');
  const [technicalContactEmail, setTechnicalContactEmail] = useState('');
  const [technicalContactPhone, setTechnicalContactPhone] = useState('');
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
          : {
              business_name: businessName,
              contact_name: contactName,
              contact_phone: phone || undefined,
              company_registration_number: companyRegistrationNumber || undefined,
              business_type: businessType || undefined,
              website_url: websiteUrl || undefined,
              use_case: useCase || undefined,
              expected_monthly_volume: expectedMonthlyVolume ? Number(expectedMonthlyVolume) : undefined,
              requested_services: requestedServices.split(',').map((service) => service.trim()).filter(Boolean),
              integration_environment: integrationEnvironment,
              technical_contact_email: technicalContactEmail || undefined,
              technical_contact_phone: technicalContactPhone || undefined,
              email,
              password
            };
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
      <section className={`mx-auto rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 ${mode === 'register' ? 'max-w-3xl' : 'max-w-md'}`}>
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

          {mode === 'register' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.contactName')}</label>
                  <input required value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={t('partnerPortal.auth.contactNamePlaceholder')} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.companyRegistrationNumber')}</label>
                  <input value={companyRegistrationNumber} onChange={(e) => setCompanyRegistrationNumber(e.target.value)} placeholder={t('partnerPortal.auth.companyRegistrationNumberPlaceholder')} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.businessType')}</label>
                  <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500">
                    <option value="">{t('partnerPortal.auth.selectBusinessType')}</option>
                    <option value="fintech">Fintech / Payments</option>
                    <option value="telco">Telecom / Aggregator</option>
                    <option value="school">School / Institution</option>
                    <option value="government">Government / NGO</option>
                    <option value="other">{t('partnerPortal.auth.otherBusinessType')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.website')}</label>
                  <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.expectedVolume')}</label>
                  <input type="number" min="1" value={expectedMonthlyVolume} onChange={(e) => setExpectedMonthlyVolume(e.target.value)} placeholder="e.g. 5000" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.environment')}</label>
                  <select value={integrationEnvironment} onChange={(e) => setIntegrationEnvironment(e.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500">
                    <option value="sandbox">Sandbox first</option>
                    <option value="production">Production</option>
                    <option value="both">Sandbox and production</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold">{t('partnerPortal.auth.requestedServices')}</label>
                <input value={requestedServices} onChange={(e) => setRequestedServices(e.target.value)} placeholder={t('partnerPortal.auth.requestedServicesPlaceholder')} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-sm font-semibold">{t('partnerPortal.auth.useCase')}</label>
                <textarea required minLength={10} value={useCase} onChange={(e) => setUseCase(e.target.value)} placeholder={t('partnerPortal.auth.useCasePlaceholder')} rows={3} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.technicalEmail')}</label>
                  <input type="email" value={technicalContactEmail} onChange={(e) => setTechnicalContactEmail(e.target.value)} placeholder="developer@company.com" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold">{t('partnerPortal.auth.technicalPhone')}</label>
                  <input value={technicalContactPhone} onChange={(e) => setTechnicalContactPhone(e.target.value)} placeholder="08012345678" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
                </div>
              </div>
            </>
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
  const [ownerBvn, setOwnerBvn] = useState('');

  async function createFundingAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: Wallet }>('/wallet/funding-account', {
        method: 'POST',
        body: { bvn: ownerBvn.trim() }
      });
      onWallet(result.data);
      setOwnerBvn('');
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
        <form onSubmit={createFundingAccount} className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">{t('partnerPortal.wallet.bvnIntro')}</p>
          <label className="block text-xs font-semibold text-slate-600">
            {t('partnerPortal.wallet.bvnLabel')}
            <input
              value={ownerBvn}
              onChange={(e) => setOwnerBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric"
              autoComplete="off"
              required
              placeholder="00000000000"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
            />
          </label>
          <p className="text-xs text-slate-500">{t('partnerPortal.wallet.bvnPrivacy')}</p>
          <button
            disabled={busy || ownerBvn.length !== 11}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <WalletIcon size={16} />
            {busy ? t('partnerPortal.wallet.creating') : t('partnerPortal.wallet.createAccount')}
          </button>
        </form>
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
  const [keyName, setKeyName] = useState('Live key');

  async function generate() {
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: { key: string } }>('/api-keys', { method: 'POST', body: { name: keyName.trim() || 'Live key' } });
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

  async function rotate(key: ApiKey) {
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: { key: string } }>(`/api-keys/${encodeURIComponent(key.id)}/rotate`, {
        method: 'POST',
        body: { name: key.name }
      });
      setRevealedKey(result.data.key);
      const refreshed = await portalFetch<{ data: ApiKey[] }>('/api-keys');
      onKeys(refreshed.data);
      onNotice(t('partnerPortal.apiKeys.rotatedNotice'));
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.apiKeys.rotateFailed'));
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

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
        <label htmlFor="partner-api-key-name" className="text-xs font-semibold text-slate-600">{t('partnerPortal.apiKeys.keyLabel')}</label>
        <input id="partner-api-key-name" value={keyName} onChange={(event) => setKeyName(event.target.value)} maxLength={80} className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-brand-500" />
        <span className="text-[11px] text-slate-500">{t('partnerPortal.apiKeys.activeCount', { count: keys.filter((key) => !key.revoked_at).length })}</span>
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
              <p className="flex items-center gap-2 text-sm font-semibold">
                {k.name}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${k.revoked_at ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                  {k.revoked_at ? t('partnerPortal.apiKeys.revoked') : t('partnerPortal.apiKeys.active')}
                </span>
              </p>
              <p className="font-mono text-xs text-slate-500">{k.key_prefix}••••••••</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {k.revoked_at
                  ? t('partnerPortal.apiKeys.revokedOn', { date: new Date(k.revoked_at).toLocaleDateString() })
                  : k.last_used_at
                    ? t('partnerPortal.apiKeys.lastUsedOn', { date: new Date(k.last_used_at).toLocaleDateString() })
                    : t('partnerPortal.apiKeys.neverUsed')}
                {' · '}{new Date(k.created_at).toLocaleDateString()}
              </p>
            </div>
            {!k.revoked_at && (
              <div className="flex items-center gap-1">
                <button type="button" disabled={busy} onClick={() => void rotate(k)} className="rounded-lg border border-blue-200 p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40" title={t('partnerPortal.apiKeys.rotateTitle')}>
                  <RefreshCw size={15} />
                </button>
                <button type="button" disabled={busy} onClick={() => void revoke(k.id)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40" title={t('partnerPortal.apiKeys.revokeTitle')}>
                  <Trash2 size={15} />
                </button>
              </div>
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
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [health, setHealth] = useState<WebhookHealth | null>(null);

  async function loadDeliveries() {
    if (!webhook?.configured) { setDeliveries([]); return; }
    try {
      const result = await portalFetch<{ data: WebhookDelivery[] }>('/webhook/deliveries?limit=10');
      setDeliveries(result.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.historyFailed'));
    }
  }

  async function loadHealth() {
    if (!webhook?.configured) { setHealth(null); return; }
    try {
      const result = await portalFetch<{ data: WebhookHealth }>('/webhook/health');
      setHealth(result.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.healthFailed'));
    }
  }

  useEffect(() => { void loadDeliveries(); void loadHealth(); }, [webhook?.configured]);

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
      // The backend attempts delivery before returning, so surface the real
      // result instead of only saying that the test entered the queue. This
      // makes a missing/incorrect partner callback immediately visible.
      const result = await portalFetch<{ data: { status: string; attempts: number } }>('/webhook/test', { method: 'POST' });
      if (result.data.status === 'delivered') {
        onNotice('Webhook test delivered successfully.');
      } else {
        onError(`Webhook test was not delivered yet (status: ${result.data.status}, attempt: ${result.data.attempts}). Check the callback route and webhook secret.`);
      }
      await loadDeliveries();
      await loadHealth();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.testFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: { requeued: number } }>('/webhook/retry-failed', { method: 'POST' });
      onNotice(result.data.requeued > 0
        ? t('partnerPortal.webhook.retryQueued', { count: result.data.requeued })
        : t('partnerPortal.webhook.retryNone'));
      await loadDeliveries();
      await loadHealth();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.retryFailedError'));
    } finally {
      setBusy(false);
    }
  }

  async function retryDelivery(eventId: string) {
    setBusy(true);
    onError('');
    try {
      const result = await portalFetch<{ data: { status: string } }>(`/webhook/deliveries/${encodeURIComponent(eventId)}/retry`, { method: 'POST' });
      if (result.data.status === 'delivered') onNotice(t('partnerPortal.webhook.deliveryRetried'));
      else onNotice(t('partnerPortal.webhook.deliveryRetryQueued'));
      await loadDeliveries();
      await loadHealth();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('partnerPortal.webhook.retryFailedError'));
    } finally { setBusy(false); }
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
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => void sendTest()}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-700 px-3 py-2 text-xs font-semibold text-brand-700 disabled:opacity-50"
          >
            <CheckCircle2 size={14} />
            {t('partnerPortal.webhook.sendTest')}
          </button>
          <button
            disabled={busy}
            onClick={() => void retryFailed()}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-600 px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
          >
            <RefreshCw size={14} />
            {t('partnerPortal.webhook.retryFailed')}
          </button>
        </div>
      )}
      {webhook?.configured && (
        health && <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold">{t('partnerPortal.webhook.healthTitle')}</h3>
              <p className="text-xs text-slate-500">{t('partnerPortal.webhook.last30Days')}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${health.delivery_rate !== null && health.delivery_rate >= 99 ? 'bg-emerald-100 text-emerald-800' : health.failed > 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
              {health.delivery_rate === null ? '—' : `${health.delivery_rate}%`}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <HealthMetric label={t('partnerPortal.webhook.delivered')} value={health.delivered} color="text-emerald-700" />
            <HealthMetric label={t('partnerPortal.webhook.failed')} value={health.failed} color="text-rose-700" />
            <HealthMetric label={t('partnerPortal.webhook.pending')} value={health.pending + health.processing} color="text-amber-700" />
            <HealthMetric label="Total" value={health.total} color="text-slate-700" />
          </div>
          {health.last_failure && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="font-bold">{t('partnerPortal.webhook.lastFailure')}</p>
            <p className="mt-1 break-all">{health.last_failure.event} · {health.last_failure.response_status ? `HTTP ${health.last_failure.response_status}` : 'No HTTP response'} · {health.last_failure.error ?? 'Delivery failed'} · {new Date(health.last_failure.created_at).toLocaleString()}</p>
          </div>}
        </section>
      )}
      {webhook?.configured && (
        <section className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{t('partnerPortal.webhook.recentDeliveries')}</h3>
            <button type="button" disabled={busy} onClick={() => { void loadDeliveries(); void loadHealth(); }} className="text-xs font-semibold text-brand-700 disabled:opacity-50">{t('partnerPortal.webhook.refresh')}</button>
          </div>
          {deliveries.length === 0 ? <p className="mt-2 text-xs text-slate-500">{t('partnerPortal.webhook.noDeliveries')}</p> : (
            <div className="mt-2 divide-y divide-slate-100">
              {deliveries.map((delivery) => (
                <div key={delivery.event_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold">{delivery.event} · <span className={delivery.status === 'failed' ? 'text-red-700' : delivery.status === 'delivered' ? 'text-green-700' : 'text-amber-700'}>{delivery.status}</span></p>
                    <p className="text-slate-500">{new Date(delivery.created_at).toLocaleString()} · {t('partnerPortal.webhook.attempts', { count: delivery.attempts })}{delivery.response_status ? ` · HTTP ${delivery.response_status}` : ''}</p>
                    {delivery.last_error && <p className="break-all text-red-700">{delivery.last_error}</p>}
                  </div>
                  {delivery.status === 'failed' && <button type="button" disabled={busy} onClick={() => void retryDelivery(delivery.event_id)} className="rounded-lg border border-amber-600 px-2 py-1 font-semibold text-amber-800 disabled:opacity-50">{t('partnerPortal.webhook.retryOne')}</button>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  );
}

function HealthMetric({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className="rounded-lg bg-white px-3 py-2"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-lg font-bold ${color}`}>{value}</p></div>;
}
