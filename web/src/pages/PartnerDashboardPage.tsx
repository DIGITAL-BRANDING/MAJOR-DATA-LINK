import { useEffect, useState, type FormEvent } from 'react';
import PromoIllustrationBadge, { isPromoIllustrationKey } from '../components/PromoIllustration';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import LiveChatWidget from '../components/LiveChatWidget';
import { API_BASE } from '../lib/api';
import { isWebPushSupported, removeWebPushSubscription, syncWebPush } from '../lib/web-push';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  CircleDollarSign,
  Copy,
  Circle,
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
  Menu,
  PlusCircle,
  RefreshCw,
  Rocket,
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
  status: 'pending_review' | 'active' | 'rejected' | 'suspended';
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
type PricingCategory = 'airtime' | 'data' | 'cable' | 'education' | 'electricity' | 'nin' | 'bvn' | 'jamb' | 'cac' | 'tax' | 'other';

function getPricingCategory(price: PriceRow): PricingCategory {
  const value = `${price.service} ${price.label}`.toLowerCase();
  if (/\bbvn\b/.test(value)) return 'bvn';
  if (/\bnin\b|ipe clearance|demographic/.test(value)) return 'nin';
  if (/\bjamb\b/.test(value)) return 'jamb';
  if (/\bcac\b|company registration|business name/.test(value)) return 'cac';
  if (/\btin\b|\btax\b/.test(value)) return 'tax';
  if (/waec|neco|nab?teb|result checker|result pin|scratch card/.test(value)) return 'education';
  if (/electricity|disco|\bmeter\b/.test(value)) return 'electricity';
  if (/cable|dstv|gotv|startimes/.test(value)) return 'cable';
  if (/airtime|\bvtu\b/.test(value)) return 'airtime';
  if (/data plan|\bdata\b/.test(value)) return 'data';
  return 'other';
}
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
function transactionPageNumbers(currentPage: number, totalPages: number): Array<number | 'start-gap' | 'end-gap'> {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 3) return [1, 2, 3, 'end-gap', totalPages];
  if (currentPage >= totalPages - 2) return [1, 'start-gap', totalPages - 2, totalPages - 1, totalPages];
  return [1, 'start-gap', currentPage, 'end-gap', totalPages];
}
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
type PartnerActivity = {
  id: string;
  kind: 'transaction' | 'request_update' | 'webhook' | 'api_key';
  event: string;
  title: string;
  status: string;
  reference: string | null;
  provider: string | null;
  details: string | null;
  occurred_at: string;
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
  const [searchParams] = useSearchParams();
  const requestedView = searchParams.get('view') ?? 'overview';
  const dashboardView = ['overview', 'onboarding', 'wallet', 'webhooks', 'activity', 'transactions', 'pricing'].includes(requestedView) ? requestedView : 'overview';
  const showView = (...views: string[]) => views.includes(dashboardView);
  const [checkedSession, setCheckedSession] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhook, setWebhook] = useState<WebhookConfig | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [callsOverview, setCallsOverview] = useState<CallsOverviewPoint[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [pricingCategory, setPricingCategory] = useState<'all' | PricingCategory>('all');
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingPageSize, setPricingPageSize] = useState(10);
  const [pricingPage, setPricingPage] = useState(1);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPageSize, setTransactionPageSize] = useState(10);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [activity, setActivity] = useState<PartnerActivity[]>([]);
  const [activitySearch, setActivitySearch] = useState('');
  const [activityKind, setActivityKind] = useState('all');
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
    const params = new URLSearchParams({ limit: String(transactionPageSize), offset: String((transactionPage - 1) * transactionPageSize) });
    if (search.trim()) params.set('search', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (typeFilter) params.set('type', typeFilter);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    return `${path}?${params.toString()}`;
  }

  async function loadTransactions() {
    setTransactionsLoading(true);
    const res = await portalFetch<{ data: Transaction[]; meta?: { total: number } }>(transactionQuery()).catch(() => null);
    if (res) {
      setTransactions(res.data);
      setTransactionTotal(res.meta?.total ?? res.data.length);
    }
    setTransactionsLoading(false);
  }

  async function loadActivity() {
    const params = new URLSearchParams({ limit: '40', kind: activityKind });
    if (activitySearch.trim()) params.set('search', activitySearch.trim());
    const res = await portalFetch<{ data: PartnerActivity[] }>(`/activity?${params.toString()}`).catch(() => null);
    if (res) setActivity(res.data);
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
    exportQuery.set('offset', '0');
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
    await Promise.all([loadTransactions(), loadActivity()]);
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
  }, [search, statusFilter, typeFilter, fromDate, toDate, transactionPage, transactionPageSize]);

  useEffect(() => {
    if (!partner) return;
    const timer = setTimeout(() => void loadActivity(), 300);
    return () => clearTimeout(timer);
    // loadActivity intentionally stays stable with the current portal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner, activitySearch, activityKind]);

  // Admin completion and provider reconciliation happen server-side. While
  // a partner still has an in-progress call, refresh the ledger quietly so a
  // completed request becomes SUCCESS without requiring a page reload.
  useEffect(() => {
    if (!partner || !transactions.some((transaction) => transaction.status === 'pending' || transaction.status === 'processing')) return;
    const timer = window.setInterval(() => void loadTransactions(), 15_000);
    return () => window.clearInterval(timer);
    // loadTransactions intentionally stays stable with the current portal session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner, transactions, search, statusFilter, typeFilter, fromDate, toDate, transactionPage, transactionPageSize]);

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
    setActivity([]);
    setNotice('');
    setError('');
  }

  const pricingCategoryOrder: PricingCategory[] = ['airtime', 'data', 'cable', 'education', 'electricity', 'nin', 'bvn', 'jamb', 'cac', 'tax', 'other'];
  const pricingCategories = pricingCategoryOrder.filter((category) => prices.some((price) => getPricingCategory(price) === category));
  const normalizedPricingSearch = pricingSearch.trim().toLowerCase();
  const filteredPrices = prices.filter((price) => {
    const matchesCategory = pricingCategory === 'all' || getPricingCategory(price) === pricingCategory;
    const matchesSearch = !normalizedPricingSearch || `${price.label} ${price.service}`.toLowerCase().includes(normalizedPricingSearch);
    return matchesCategory && matchesSearch;
  });
  const pricingPageCount = Math.max(1, Math.ceil(filteredPrices.length / pricingPageSize));
  const visiblePrices = filteredPrices.slice((pricingPage - 1) * pricingPageSize, pricingPage * pricingPageSize);
  const pricingCategoryLabel = (category: PricingCategory) => t(`partnerPortal.pricing.categories.${category}`);

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
    <main className="min-h-screen bg-slate-100/70 text-slate-900">
      <PartnerNotificationPopup />
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-brand-700 to-blue-500 p-2.5 text-white shadow-md shadow-brand-900/15">
              <Activity size={21} />
            </div>
            <div>
              <p className="font-bold tracking-tight">{t('partnerPortal.header.appName')}</p>
              <p className="text-xs text-slate-500">{t('partnerPortal.header.tagline')}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden lg:block"><PartnerPushToggle /></div>
            <PartnerNotificationBell />
            <div className="hidden sm:block"><LanguageSwitcher /></div>
            <Link
              to="/partner-docs"
              className="hidden items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 md:flex"
            >
              <BookOpen size={16} />
              {t('partnerPortal.header.documentation')}
            </Link>
            <button
              onClick={logout}
              className="hidden items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 md:flex"
            >
              <LogOut size={16} />
              {t('partnerPortal.header.logout')}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {error && (
          <p className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
        )}
        {notice && (
          <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        )}

        <PartnerQuickLinks onLogout={logout} />

        {showView('overview') && <section id="overview" className="relative isolate scroll-mt-24 overflow-hidden rounded-3xl bg-slate-950 bg-gradient-to-br from-slate-950 via-blue-950 to-brand-800 p-5 text-white shadow-xl shadow-blue-950/10 sm:p-8" style={{ backgroundColor: '#020617' }}>
          <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 left-1/3 -z-10 h-64 w-64 rounded-full bg-blue-400/15 blur-3xl" />
          <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100 backdrop-blur">
                <span className={`h-2 w-2 rounded-full ${partner.status === 'active' ? 'bg-emerald-400' : partner.status === 'pending_review' ? 'bg-amber-400' : 'bg-rose-400'}`} />
                {partner.status.replaceAll('_', ' ')}
              </div>
              <p className="mt-5 text-sm font-medium text-blue-100">{t('partnerPortal.hero.welcomeBack')}</p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">{partner.business_name}</h1>
              <p className="mt-2 break-all text-sm text-blue-100/75">{partner.email}</p>
            </div>
            <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:max-w-xs sm:p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
                <WalletIcon size={16} /> {t('partnerPortal.hero.walletBalance')}
              </div>
              <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-white sm:text-4xl">₦{partner.wallet_balance.toLocaleString()}</p>
              <Link to="/partner-dashboard?view=wallet" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200 transition hover:text-white">
                {t('partnerPortal.quickLinks.wallet')} <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>}

        {showView('overview') && partner.enterprise_offer_code && (
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
                  : partner.status === 'rejected'
                    ? t('partnerPortal.banner.rejectedTitle')
                    : t('partnerPortal.banner.suspendedTitle')}
              </p>
              <p className="mt-1 text-sm leading-relaxed">
                {partner.status === 'pending_review'
                  ? t('partnerPortal.banner.pendingBody', { email: partner.email })
                  : partner.status === 'rejected'
                    ? t('partnerPortal.banner.rejectedBody')
                    : t('partnerPortal.banner.suspendedBody')}
              </p>
            </div>
          </section>
        )}

        {showView('overview', 'onboarding') && (
          <PartnerOnboardingCenter partner={partner} wallet={wallet} keys={keys} webhook={webhook} />
        )}

        {showView('overview') && partner.status === 'active' && (
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

        {showView('overview') && <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
        </section>}

        {showView('overview') && <section id="calls-overview" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">{t('partnerPortal.callsOverview.title')}</h2>
          <CallsOverviewChart data={callsOverview} />
        </section>}

        {showView('wallet') && <section id="wallet" className="mt-6 scroll-mt-24 grid gap-6 lg:grid-cols-2">
          <WalletCard wallet={wallet} onError={setError} onNotice={setNotice} onWallet={setWallet} />
          <ApiKeysCard
            keys={keys}
            active={partner.status === 'active'}
            onError={setError}
            onNotice={setNotice}
            onKeys={setKeys}
          />
        </section>}

        {showView('webhooks') && <section id="webhooks" className="mt-6 scroll-mt-24">
          <WebhookCard webhook={webhook} onError={setError} onNotice={setNotice} onWebhook={setWebhook} />
        </section>}

        {showView('pricing') && (
          <section id="pricing" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-brand-800 px-5 py-6 text-white sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-blue-200">
                    <Tag size={16} />
                    <span className="text-xs font-bold uppercase tracking-[0.16em]">{t('partnerPortal.pricing.eyebrow')}</span>
                  </div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">{t('partnerPortal.pricing.title')}</h2>
                  <p className="mt-1 max-w-2xl text-sm text-blue-100/80">
                    <Trans i18nKey="partnerPortal.pricing.subtitle" components={{ code: <code /> }} />
                  </p>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                  <p className="text-xs text-blue-100">{t('partnerPortal.pricing.availableServices')}</p>
                  <p className="mt-1 text-2xl font-bold">{prices.length}</p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 px-4 pt-4 sm:px-6">
              <div className="flex gap-1 overflow-x-auto pb-3">
                <button type="button" onClick={() => { setPricingCategory('all'); setPricingPage(1); }} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${pricingCategory === 'all' ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {t('partnerPortal.pricing.allCategories')}
                </button>
                {pricingCategories.map((category) => (
                  <button key={category} type="button" onClick={() => { setPricingCategory(category); setPricingPage(1); }} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${pricingCategory === category ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {pricingCategoryLabel(category)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <span>{t('partnerPortal.pricing.show')}</span>
                <select value={pricingPageSize} onChange={(event) => { setPricingPageSize(Number(event.target.value)); setPricingPage(1); }} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                  {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <span>{t('partnerPortal.pricing.entries')}</span>
              </label>
              <label className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-400 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 sm:max-w-xs">
                <Search size={16} />
                <input value={pricingSearch} onChange={(event) => { setPricingSearch(event.target.value); setPricingPage(1); }} placeholder={t('partnerPortal.pricing.search')} className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
            </div>

            <div className="overflow-x-auto px-4 sm:px-6">
              <table className="w-full min-w-[540px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-bold">{t('partnerPortal.pricing.service')}</th>
                    <th className="px-4 py-3 font-bold">{t('partnerPortal.pricing.category')}</th>
                    <th className="px-4 py-3 text-right font-bold">{t('partnerPortal.pricing.partnerPrice')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiblePrices.map((price) => (
                    <tr key={price.service} className="transition hover:bg-blue-50/50">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-800">{price.label}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{price.service}</p>
                      </td>
                      <td className="px-4 py-3.5"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{pricingCategoryLabel(getPricingCategory(price))}</span></td>
                      <td className="px-4 py-3.5 text-right font-bold tabular-nums text-brand-800">₦{Number(price.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  {visiblePrices.length === 0 && <tr><td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-500">{t('partnerPortal.pricing.empty')}</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>{t('partnerPortal.pricing.showing', { start: filteredPrices.length ? (pricingPage - 1) * pricingPageSize + 1 : 0, end: Math.min(pricingPage * pricingPageSize, filteredPrices.length), total: filteredPrices.length })}</p>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button type="button" disabled={pricingPage <= 1} onClick={() => setPricingPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{t('partnerPortal.pricing.previous')}</button>
                <span className="min-w-20 text-center text-xs font-medium text-slate-500">{t('partnerPortal.pricing.page', { page: Math.min(pricingPage, pricingPageCount), pages: pricingPageCount })}</span>
                <button type="button" disabled={pricingPage >= pricingPageCount} onClick={() => setPricingPage((page) => Math.min(pricingPageCount, page + 1))} className="rounded-lg border border-slate-300 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{t('partnerPortal.pricing.next')}</button>
              </div>
            </div>
          </section>
        )}

        {showView('transactions') && <section id="transactions" className="mt-6 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">{t('partnerPortal.quickLinks.transactions')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('partnerPortal.callsSummary.transactionsSubtitle')}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-slate-400 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 sm:w-72">
                <Search size={16} />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setTransactionPage(1); }} placeholder={t('partnerPortal.callsSummary.searchPlaceholder')} className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
              </label>
              <button type="button" onClick={() => void exportTransactions()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                <Download size={15} /> {t('partnerPortal.callsSummary.exportCsv')}
              </button>
            </div>
          </div>
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setTransactionPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              <option value="">{t('partnerPortal.callsSummary.allStatuses')}</option>
              {['PENDING', 'SUCCESS', 'FAILED', 'IGNORED', 'DECLINED', 'REVERSED'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setTransactionPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
              <option value="">{t('partnerPortal.callsSummary.allTypes')}</option>
              {['WALLET_FUNDING', 'WALLET_TRANSFER', 'DATA_PURCHASE', 'AIRTIME_PURCHASE', 'ELECTRICITY_PURCHASE', 'CABLE_PURCHASE', 'RESULT_PIN', 'SMS', 'WITHDRAWAL', 'REFERRAL_COMMISSION', 'MANUAL_ADJUSTMENT', 'COUPON_REDEMPTION', 'NIN_VERIFICATION', 'BVN_VERIFICATION', 'IDENTITY_SERVICE_REQUEST', 'NIN_MODIFICATION', 'BVN_LICENSE_ONBOARDING', 'CAC_SERVICE_REQUEST', 'BVN_MODIFICATION', 'BIRTH_ATTESTATION', 'NEWSPAPER_PUBLICATION', 'BVN_CRM', 'JAMB_SERVICE_REQUEST', 'SCHOOL_WEBSITE_SUBSCRIPTION', 'TIN_SERVICE_REQUEST', 'REFUND', 'WALLET_FUNDING_FEE'].map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
            </select>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">{t('partnerPortal.callsSummary.from')}<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setTransactionPage(1); }} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" /></label>
            <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">{t('partnerPortal.callsSummary.to')}<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setTransactionPage(1); }} className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none" /></label>
            <button type="button" onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setFromDate(''); setToDate(''); setTransactionPage(1); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">{t('partnerPortal.callsSummary.clearFilters')}</button>
          </div>
          <div className="flex flex-col gap-3 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <label className="flex items-center gap-2">{t('partnerPortal.callsSummary.show')}<select value={transactionPageSize} onChange={(event) => { setTransactionPageSize(Number(event.target.value)); setTransactionPage(1); }} className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-brand-500">{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select>{t('partnerPortal.callsSummary.entries')}</label>
            <span>{t('partnerPortal.callsSummary.showingTransactions', { start: transactionTotal ? (transactionPage - 1) * transactionPageSize + 1 : 0, end: Math.min(transactionPage * transactionPageSize, transactionTotal), total: transactionTotal })}</span>
          </div>
          <div className="overflow-x-auto px-3 sm:px-5">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead><tr className="border-y border-blue-100 bg-blue-50 text-xs font-semibold text-slate-700">
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colReference')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colNin')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colType')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colAmount')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colBalanceBefore')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colBalanceAfter')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colStatus')}</th>
                <th className="px-3 py-3">{t('partnerPortal.callsSummary.colDate')}</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-200">
                {transactions.map((tx) => {
                  const statusColor = tx.status === 'success' ? 'bg-emerald-100 text-emerald-700' : tx.status === 'processing' ? 'bg-sky-100 text-sky-700' : tx.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';
                  const isNinRequest = tx.type.toLowerCase().includes('nin') || tx.description.toLowerCase().includes('nin');
                  return <tr key={tx.reference} className="transition-colors hover:bg-blue-50/50">
                    <td className="px-3 py-3.5"><button type="button" onClick={() => void openTransaction(tx.reference)} className="max-w-[220px] truncate font-mono text-xs text-brand-800 hover:underline" title={tx.reference}>{tx.reference}</button></td>
                    <td className="px-3 py-3.5 font-mono text-xs text-slate-500">{isNinRequest ? t('partnerPortal.callsSummary.protectedIdentifier') : '—'}</td>
                    <td className="px-3 py-3.5 font-medium text-slate-700">{tx.description || tx.type.replaceAll('_', ' ')}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 font-semibold tabular-nums text-slate-800">₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-slate-600">₦{tx.balance_before?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3.5 tabular-nums text-slate-600">₦{tx.balance_after?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}</td>
                    <td className="px-3 py-3.5"><span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusColor}`}>{tx.status.replaceAll('_', ' ')}</span></td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-600">{new Date(tx.created_at).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>;
                })}
                {!transactions.length && <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500">{transactionsLoading ? t('partnerPortal.common.loading') : t('partnerPortal.callsSummary.empty')}</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-center sm:px-6">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button type="button" disabled={transactionPage <= 1} onClick={() => setTransactionPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">‹ {t('partnerPortal.callsSummary.previous')}</button>
              {transactionPageNumbers(transactionPage, Math.max(1, Math.ceil(transactionTotal / transactionPageSize))).map((page, index) => typeof page === 'number'
                ? <button key={page} type="button" aria-current={transactionPage === page ? 'page' : undefined} onClick={() => setTransactionPage(page)} className={`min-w-9 rounded-lg border px-3 py-2 text-sm font-semibold transition ${transactionPage === page ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{page}</button>
                : <span key={`${page}-${index}`} className="px-1 text-slate-400">…</span>)}
              <button type="button" disabled={transactionPage >= Math.ceil(transactionTotal / transactionPageSize) || transactionTotal === 0} onClick={() => setTransactionPage((page) => page + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{t('partnerPortal.callsSummary.next')} ›</button>
            </div>
          </div>
        </section>}

        {showView('activity') && <ActivityCenter
          activity={activity}
          search={activitySearch}
          kind={activityKind}
          onSearch={setActivitySearch}
          onKind={setActivityKind}
          onRefresh={() => void loadActivity()}
        />}

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

function PartnerOnboardingCenter({
  partner,
  wallet,
  keys,
  webhook
}: {
  partner: Partner;
  wallet: Wallet | null;
  keys: ApiKey[];
  webhook: WebhookConfig | null;
}) {
  const { t } = useTranslation();
  const walletBalance = wallet?.balance ?? partner.wallet_balance;
  const activeKey = keys.some((key) => !key.revoked_at);
  const steps = [
    {
      title: t('partnerPortal.onboarding.registrationTitle'),
      body: t('partnerPortal.onboarding.registrationBody'),
      complete: true,
      to: '/partner-dashboard?view=overview'
    },
    {
      title: t('partnerPortal.onboarding.approvalTitle'),
      body: t(`partnerPortal.onboarding.approvalBody.${partner.status}`),
      complete: partner.status === 'active',
      to: '/partner-docs'
    },
    {
      title: t('partnerPortal.onboarding.walletTitle'),
      body: t('partnerPortal.onboarding.walletBody', { minimum: partner.api_access.nin_bvn_minimum_deposit }),
      complete: walletBalance >= partner.api_access.nin_bvn_minimum_deposit,
      to: '/partner-dashboard?view=wallet'
    },
    {
      title: t('partnerPortal.onboarding.apiKeyTitle'),
      body: t('partnerPortal.onboarding.apiKeyBody'),
      complete: activeKey,
      to: '/partner-dashboard?view=wallet'
    },
    {
      title: t('partnerPortal.onboarding.webhookTitle'),
      body: t('partnerPortal.onboarding.webhookBody'),
      complete: Boolean(webhook?.configured && webhook.webhook_url),
      to: '/partner-dashboard?view=webhooks'
    }
  ];
  const completed = steps.filter((step) => step.complete).length;
  const progress = Math.round((completed / steps.length) * 100);
  const statusKey = partner.status === 'active' ? 'active' : partner.status;

  return (
    <section id="onboarding" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Rocket size={20} /></span>
          <div>
            <h2 className="font-bold text-slate-900">{t('partnerPortal.onboarding.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">{t('partnerPortal.onboarding.subtitle')}</p>
          </div>
        </div>
        <div className="min-w-48 rounded-xl bg-slate-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
            <span>{t('partnerPortal.onboarding.progress', { completed, total: steps.length })}</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-500">{t('partnerPortal.onboarding.applicationStatus')}:</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.status === 'active' ? 'bg-emerald-100 text-emerald-700' : partner.status === 'pending_review' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
          {t(`partnerPortal.onboarding.status.${statusKey}`)}
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {steps.map((step, index) => (
          <div key={step.title} className={`rounded-xl border p-4 ${step.complete ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start gap-3">
              {step.complete ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={19} /> : <Circle className="mt-0.5 shrink-0 text-slate-300" size={19} />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">{index + 1}. {step.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{step.body}</p>
                <Link to={step.to} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline">
                  {step.complete ? t('partnerPortal.onboarding.completed') : t('partnerPortal.onboarding.openStep')} <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {completed === steps.length && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="font-semibold">{t('partnerPortal.onboarding.ready')}</span>
          <Link to="/partner-docs" className="inline-flex items-center gap-1 font-bold hover:underline">{t('partnerPortal.quickLinks.documentation')} <ArrowRight size={14} /></Link>
        </div>
      )}
    </section>
  );
}

function PartnerQuickLinks({ onLogout }: { onLogout: () => void }) {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeView = searchParams.get('view') ?? 'overview';
  const links = [
    ['overview', t('partnerPortal.quickLinks.overview')],
    ['onboarding', t('partnerPortal.quickLinks.onboarding')],
    ['wallet', t('partnerPortal.quickLinks.wallet')],
    ['webhooks', t('partnerPortal.quickLinks.webhooks')],
    ['activity', t('partnerPortal.quickLinks.activity')],
    ['transactions', t('partnerPortal.quickLinks.transactions')],
    ['pricing', t('partnerPortal.quickLinks.pricing')]
  ];
  const linkClass = (view: string) => `block rounded-lg px-3 py-2.5 text-sm font-semibold transition md:inline-flex md:shrink-0 md:py-2 md:text-xs ${activeView === view ? 'bg-brand-700 text-white shadow-sm' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`;
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 md:hidden">
        <span className="text-sm font-semibold text-slate-700">{t('partnerPortal.quickLinks.label')}</span>
        <button type="button" aria-expanded={mobileMenuOpen} aria-controls="partner-mobile-menu" onClick={() => setMobileMenuOpen((open) => !open)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
          <Menu size={16} /> {mobileMenuOpen ? t('partnerPortal.quickLinks.closeMenu') : t('partnerPortal.quickLinks.openMenu')}
        </button>
      </div>
      <nav aria-label={t('partnerPortal.quickLinks.label')} className="hidden gap-1 overflow-x-auto p-2 md:flex">
        {links.map(([view, label]) => <Link key={view} to={`/partner-dashboard?view=${view}`} className={linkClass(view)}>{label}</Link>)}
        <Link to="/partner-docs" className="inline-flex shrink-0 items-center rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-800">{t('partnerPortal.quickLinks.documentation')}</Link>
      </nav>
      {mobileMenuOpen && <nav id="partner-mobile-menu" aria-label={t('partnerPortal.quickLinks.label')} className="grid gap-1 border-t border-slate-100 p-2 md:hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-2 pb-3">
          <PartnerPushToggle />
          <LanguageSwitcher />
        </div>
        {links.map(([view, label]) => <Link key={view} to={`/partner-dashboard?view=${view}`} onClick={() => setMobileMenuOpen(false)} className={linkClass(view)}>{label}</Link>)}
        <Link to="/partner-docs" onClick={() => setMobileMenuOpen(false)} className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50">{t('partnerPortal.quickLinks.documentation')}</Link>
        <button type="button" onClick={onLogout} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><LogOut size={16} />{t('partnerPortal.header.logout')}</button>
      </nav>}
    </div>
  );
}

function ActivityCenter({
  activity,
  search,
  kind,
  onSearch,
  onKind,
  onRefresh
}: {
  activity: PartnerActivity[];
  search: string;
  kind: string;
  onSearch: (value: string) => void;
  onKind: (value: string) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section id="activity" className="mt-6 scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="text-brand-700" size={20} />
            <h2 className="font-bold">{t('partnerPortal.activity.title')}</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">{t('partnerPortal.activity.subtitle')}</p>
        </div>
        <button type="button" onClick={onRefresh} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {t('partnerPortal.activity.refresh')}
        </button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={t('partnerPortal.activity.search')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        <select value={kind} onChange={(event) => onKind(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="all">{t('partnerPortal.activity.all')}</option>
          <option value="transaction">{t('partnerPortal.activity.transactions')}</option>
          <option value="request_update">{t('partnerPortal.activity.updates')}</option>
          <option value="webhook">{t('partnerPortal.activity.webhooks')}</option>
          <option value="api_key">{t('partnerPortal.activity.apiKeys')}</option>
        </select>
      </div>
      {activity.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{t('partnerPortal.activity.empty')}</p> : (
        <div className="mt-4 divide-y divide-slate-100">
          {activity.map((item) => {
            const positive = ['success', 'delivered', 'active', 'created'].some((value) => item.status.includes(value));
            const negative = ['failed', 'reversed', 'revoked', 'declined'].some((value) => item.status.includes(value));
            return (
              <div key={`${item.kind}-${item.id}`} className="flex gap-3 py-3">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${positive ? 'bg-emerald-500' : negative ? 'bg-rose-500' : 'bg-amber-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                    <time className="text-xs text-slate-400">{new Date(item.occurred_at).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="uppercase tracking-wide">{item.event.replaceAll('_', ' ')}</span>
                    {item.provider ? ` · ${item.provider}` : ''}
                    {item.reference ? ` · ${item.reference}` : ''}
                  </p>
                  {item.details && <p className="mt-1 break-all text-xs text-slate-600">{item.details}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await portalFetch<{ data: { access_token: string; refresh_token: string; partner: Partner } }>('/login', {
        method: 'POST',
        body: { email, password }
      });
      onSuccess(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('partnerPortal.auth.genericError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[30rem] w-[30rem] rounded-full bg-blue-600/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[.06]" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.4) 1px, transparent 1px)', backgroundSize: '42px 42px' }} />

      <header className="relative z-10 border-b border-white/10 bg-slate-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/enterprise-api" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950"><ShieldCheck size={21} /></span>
            <span><strong className="block text-sm tracking-wide">{t('partnerPortal.header.appName')}</strong><small className="text-xs text-slate-400">{t('partnerPortal.header.tagline')}</small></span>
          </Link>
          <div className="flex items-center gap-3"><LanguageSwitcher /><Link to="/enterprise-api" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10 sm:block">{t('partnerPortal.auth.backToEnterprise')}</Link></div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1fr_460px] lg:items-center lg:py-20">
        <section className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-cyan-200"><Building2 size={14} /> {t('partnerPortal.auth.loginEyebrow')}</span>
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-6xl">{t('partnerPortal.auth.loginTitle')}</h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">{t('partnerPortal.auth.loginBody')}</p>
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            {[t('partnerPortal.auth.loginFeatureSecurity'), t('partnerPortal.auth.loginFeatureKeys'), t('partnerPortal.auth.loginFeatureMonitoring')].map((feature) => <div key={feature} className="rounded-2xl border border-white/10 bg-white/[.05] p-4 text-sm font-semibold text-slate-200"><CheckCircle2 size={17} className="mb-3 text-cyan-300" />{feature}</div>)}
          </div>
          <p className="mt-8 text-sm text-slate-500"><Link to="/partner-docs" className="font-semibold text-cyan-300 hover:text-cyan-200">{t('partnerPortal.auth.viewDocumentation')}</Link> <span className="mx-2">·</span> {t('partnerPortal.auth.loginSecurityNote')}</p>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[.08] p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl sm:p-8">
          <div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-cyan-300">{t('partnerPortal.auth.loginEyebrow')}</p><h2 className="mt-3 text-2xl font-bold">{t('partnerPortal.auth.login')}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{t('partnerPortal.auth.loginPrompt')}</p></div>
          <form onSubmit={submit} className="space-y-5">
            <div><label className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Mail size={16} className="text-cyan-300" />{t('partnerPortal.auth.email')}</label><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('partnerPortal.auth.emailPlaceholder')} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900/80 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300" /></div>
            <div><label className="flex items-center gap-2 text-sm font-semibold text-slate-200"><Lock size={16} className="text-cyan-300" />{t('partnerPortal.auth.password')}</label><div className="mt-2 flex rounded-xl border border-white/15 bg-slate-900/80 focus-within:border-cyan-300"><input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none" /><button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="px-3 text-slate-400 hover:text-white">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></div>
            {error && <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3.5 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">{busy ? <LoaderCircle size={18} className="animate-spin" /> : <ShieldCheck size={18} />}{t('partnerPortal.auth.loginCta')}</button>
          </form>
          <div className="mt-7 border-t border-white/10 pt-6 text-center text-sm text-slate-400"><span>{t('partnerPortal.auth.newPartner')} </span><Link to="/partner-register" className="font-bold text-cyan-300 hover:text-cyan-200">{t('partnerPortal.auth.startOnboarding')}</Link></div>
        </section>
      </div>
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
