import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  Eye,
  EyeOff,
  History,
  Landmark,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import NotificationPopup from '../components/NotificationPopup';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { SERVICES, TINT_CLASSES } from '../lib/services';
import { supportWhatsappLink } from '../lib/contact';
import WhatsAppIcon from '../components/WhatsAppIcon';

const SERVICE_IMAGES: Record<string, string> = {
  'Buy Data': '/branding/logo.png',
  'Buy Airtime': '/branding/logo.png',
  'Airtime to Cash': '/branding/logo.png',
  'Cable TV': '/branding/logo.png',
  Electricity: '/branding/logo.png',
  'NIN Phone Verification': '/branding/NIN_Phone_Verification.png',
  'Phone Multiple': '/branding/Phone Multiple.png',
  'CAC Services': '/branding/CAC Services.png',
  'BVN Verification': '/branding/BVN Verifications.png',
  'IPE Clearance (Instant)': '/branding/IPE Clearance.png',
  Validation: '/branding/Validation.png',
  Personalization: '/branding/Personalization.png',
  'BVN Retrieval': '/branding/BVN Retrieval.png',
  'Self Service Unlink': '/branding/Self Service Unlink.png',
  'NIN Modifications': '/branding/NIN Modification.png',
  'Birth Attestation': '/branding/Birth Attestation.png',
  'TIN Certificate': '/branding/TIN Certificate.png',
  'Newspaper Publication': '/branding/Demographic Serach.png',
  'Demographic Search': '/branding/Demographic Serach.png',
  'BVN Licence Creation': '/branding/BVN Verifications.png',
  'BVN Modification': '/branding/BVN Modification.png',
  'BVN CRM': '/branding/BVN CRM.png',
  'Result Checkers': '/branding/results.png',
  'JAMB Services': '/branding/Jamb.jpg',
  'School Website': '/branding/logo.png',
  'Bulk SMS': '/branding/logo.png',
  'NIN Services': '/branding/Validation.png',
  'BVN Services': '/branding/BVN Verifications.png',
  'SCUML Registration': '/branding/CAC Services.png',
};

const BALANCE_HIDDEN_KEY = 'wallet_balance_hidden';
function readBalanceHidden() {
  try { return localStorage.getItem(BALANCE_HIDDEN_KEY) === '1'; } catch { return false; }
}

function providerLabel(provider?: string | null) {
  switch (provider) {
    case 'zenithpay': return 'ZenithPay (Primary)';
    case 'katpay': return 'Katpay (Alternative)';
    case 'paystack': return 'Paystack';
    default: return 'Account Number';
  }
}

type WalletBalance = {
  balance: number;
  currency: string;
  virtual_account_number: string | null;
  virtual_account_bank: string | null;
  virtual_account_name?: string | null;
  virtual_account_provider?: string | null;
  virtual_account_funding_paused?: boolean;
};

type Transaction = {
  id: string;
  type: string;
  description: string;
  amount: number;
  status: string;
  created_at: string;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadedTransactions, setLoadedTransactions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(readBalanceHidden);
  // null = "haven't heard back yet" - every tile renders as available
  // until proven otherwise, so a slow/failed request never falsely marks
  // working services as down.
  const [inactiveServiceKeys, setInactiveServiceKeys] = useState<Set<string> | null>(null);

  useEffect(() => {
    api.get<WalletBalance>('/wallet/balance').then(setWallet).catch(() => {});
    api
      .get<{ status: boolean; data: Transaction[] }>('/transactions')
      .then((res) => setTransactions((res.data ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadedTransactions(true));
    api
      .get<{ status: boolean; data: Array<{ service: string; is_active: boolean }> }>('/public/service-status', false)
      .then((res) => setInactiveServiceKeys(new Set((res.data ?? []).filter((row) => !row.is_active).map((row) => row.service))))
      .catch(() => {});
  }, []);

  function toggleBalanceHidden() {
    setBalanceHidden((hidden) => {
      try { localStorage.setItem(BALANCE_HIDDEN_KEY, hidden ? '0' : '1'); } catch { /* private mode: just don't remember it */ }
      return !hidden;
    });
  }

  function copyAccount() {
    if (!wallet?.virtual_account_number) return;
    navigator.clipboard.writeText(wallet.virtual_account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Shown only to first-timers (no transactions yet) — once someone has
  // actually bought something, they know how the site works and this just
  // becomes clutter above their real activity.
  const isFirstTimeUser = loadedTransactions && transactions.length === 0;
  // Keep the more useful day-to-day purchases first. NIN Phone Verification
  // remains in the catalog and route for future use, but is intentionally
  // hidden here because NIN Services already covers that workflow.
  const dashboardServices = SERVICES
    .filter((service) => service.label !== 'CAC Registration' && service.label !== 'NIN Phone Verification')
    .slice()
    .sort((a, b) => {
      const order = ['Buy Data', 'Buy Airtime', 'NIN Services'];
      const aIndex = order.indexOf(a.label);
      const bIndex = order.indexOf(b.label);
      return (aIndex === -1 ? order.length : aIndex) - (bIndex === -1 ? order.length : bIndex);
    });

  return (
    <AppShell>
      <NotificationPopup />
      <h1 className="font-display text-2xl font-bold text-ink-900">
        Hi, {user?.full_name?.split(' ')[0]}
      </h1>

      {/* Balance card */}
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b6130] via-[#07491f] to-[#053b1a] p-5 text-white shadow-xl shadow-emerald-950/20 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Wallet size={17} className="text-emerald-100" />
              <span className="font-body text-sm font-semibold text-emerald-50">Wallet Balance</span>
            </div>
            <button
              type="button"
              onClick={toggleBalanceHidden}
              aria-label={balanceHidden ? 'Show balance' : 'Hide balance'}
              title={balanceHidden ? 'Show balance' : 'Hide balance'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              {balanceHidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <div className="mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {wallet ? (balanceHidden ? '₦ ••••••' : `₦${wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : '···'}
          </div>
          <p className="mt-1 font-body text-sm text-emerald-100/90">User Wallet</p>
          <p className="mt-0.5 font-body text-[11px] text-emerald-100/60">Transaction fee: 2%</p>

          <div className="my-4 border-t border-white/15" />

          {wallet?.virtual_account_number ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex items-center gap-2">
                  <Landmark size={17} className="text-emerald-100" />
                  <span className="font-display text-base font-bold">Virtual Account</span>
                </div>
                <span className="font-body text-xs font-bold text-emerald-50 sm:text-sm">ZenithPay (Primary) / Katpay (Alternative)</span>
              </div>

              <div className="relative mt-3 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                <button
                  type="button"
                  onClick={copyAccount}
                  aria-label="Copy account number"
                  title={copied ? 'Copied' : 'Copy account number'}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-emerald-50 transition hover:bg-white/15"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <dl className="space-y-2.5 pr-8 font-body text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-4">
                    <dt className="w-28 shrink-0 text-emerald-50/90">{providerLabel(wallet.virtual_account_provider)}</dt>
                    <dd className="font-mono text-base font-bold tracking-wide">{wallet.virtual_account_number}</dd>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-x-4">
                    <dt className="w-28 shrink-0 text-emerald-50/90">Bank</dt>
                    <dd className="font-bold uppercase">{wallet.virtual_account_bank}</dd>
                  </div>
                  {wallet.virtual_account_name && (
                    <div className="flex flex-wrap items-baseline gap-x-4">
                      <dt className="w-28 shrink-0 text-emerald-50/90">Account Name</dt>
                      <dd className="min-w-0 break-words font-bold">{wallet.virtual_account_name}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wallet size={15} className="shrink-0 text-emerald-100" />
                <span className="font-body text-xs text-emerald-50">
                  {wallet?.virtual_account_funding_paused
                    ? 'Click the button below to continue funding your wallet using Exact Transfer/Card'
                    : "You don't have a permanent account number yet — verify your BVN once to get one."}
                </span>
              </div>
              {!wallet?.virtual_account_funding_paused && (
                <Link
                  to="/verify-account"
                  className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-gold-500 py-2 font-display text-xs font-bold text-ink transition hover:bg-gold-600"
                >
                  <ShieldCheck size={14} /> Generate Permanent Account Number
                </Link>
              )}
            </div>
          )}

          <Link
            to="/fund-wallet"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-display text-sm font-bold text-[#07491f] transition hover:bg-emerald-50"
          >
            <PlusCircle size={17} /> Fund Wallet
          </Link>
          <Link
            to="/wallet-history"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3.5 font-display text-sm font-bold text-ink-900 transition hover:bg-slate-200"
          >
            <History size={17} /> Funding History
          </Link>

          {/* Developer API: customers who want to integrate our services into their own app */}
          <Link
            to="/partner-dashboard"
            className="group mt-3 flex items-center gap-3 rounded-xl border border-white/15 bg-black/20 p-3.5 transition hover:bg-black/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200">
              <Code2 size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-sm font-bold">Developer API</span>
              <span className="block font-body text-xs text-emerald-100/80">
                Integrate NIN, BVN, Data &amp; Airtime into your own app
              </span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-emerald-100 transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

      {/* WhatsApp support */}
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-4 text-white shadow-md shadow-emerald-900/10">
        <WhatsAppIcon size={24} className="shrink-0" />
        <p className="min-w-0 flex-1 text-center font-body text-sm font-bold">
          Need help? Chat with our WhatsApp Support
        </p>
        <a
          href={supportWhatsappLink('Hello, I need help with my account.')}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-full bg-white/20 px-4 py-2 font-body text-xs font-bold transition hover:bg-white/30"
        >
          Chat now →
        </a>
      </div>

      {/* First-time helper: how this whole thing works, in three steps */}
      {isFirstTimeUser && (
        <div className="mt-6 rounded-2xl border border-gold-500/30 bg-gold-50 p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold-600" />
            <h2 className="font-display text-sm font-bold text-ink-900">
              New here? Here's how it works
            </h2>
          </div>
          <ol className="mt-4 space-y-3">
            <HowItWorksStep
              number={1}
              title="Fund your wallet"
              detail="Transfer any amount to the account number above — it lands in your wallet in seconds."
            />
            <HowItWorksStep
              number={2}
              title="Pick a service below"
              detail="Buy Data and Buy Airtime are ready now; more services are on the way."
            />
            <HowItWorksStep
              number={3}
              title="Confirm and you're done"
              detail="Enter the details, confirm — delivery is instant, and it shows up in Recent activity."
            />
          </ol>
        </div>
      )}

      {/* All services */}
      <div className="mt-8">
        <h2 className="font-display text-base font-semibold text-ink-900">Services</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {dashboardServices.map((service) => (
            <ServiceTile key={service.route} {...service} inactive={isServiceInactive(service.statusKey, inactiveServiceKeys)} />
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="mt-10">
        <h2 className="font-display text-base font-semibold text-ink-900">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center font-body text-sm text-slate-500">
            No transactions yet — your top-ups will show up here.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {transactions.map((t) => (
              <Link
                key={t.id}
                to={`/receipt/${t.id}`}
                className="flex items-center justify-between px-4 py-3 transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-body text-sm font-medium text-ink-900">{t.description}</p>
                  <p className="font-mono text-xs text-slate-500">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-ink-900">
                    ₦{t.amount.toLocaleString()}
                  </p>
                  <StatusBadge status={t.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function HowItWorksStep({
  number,
  title,
  detail,
}: {
  number: number;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-600 font-mono text-[11px] font-bold text-white">
        {number}
      </span>
      <div>
        <p className="font-body text-sm font-semibold text-ink-900">{title}</p>
        <p className="font-body text-xs text-slate-600">{detail}</p>
      </div>
    </li>
  );
}

/**
 * A tile with no statusKey is never marked inactive (multi-sub-type
 * services like CAC/NIN Modification - the backend still enforces those
 * per sub-type on submit, this just isn't the right place to show it).
 * `null` inactiveKeys means the /public/service-status fetch hasn't
 * resolved (or failed) yet - default to available rather than flashing
 * an incorrect "Unavailable" badge for a moment.
 */
function isServiceInactive(statusKey: string | string[] | undefined, inactiveKeys: Set<string> | null): boolean {
  if (!statusKey || !inactiveKeys) return false;
  const keys = Array.isArray(statusKey) ? statusKey : [statusKey];
  return keys.every((key) => inactiveKeys.has(key));
}

function ServiceTile({
  label,
  icon: Icon,
  route,
  tint,
  implemented,
  inactive,
}: (typeof SERVICES)[number] & { inactive: boolean }) {
  const colors = TINT_CLASSES[tint];
  return (
    <Link
      to={route}
      className="tile-premium group relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-2xl p-4 text-center transition duration-200 hover:-translate-y-1"
    >
      {!implemented && (
        <span className="tile-premium-badge absolute right-2 top-2 z-10 rounded-full px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-wide">
          Soon
        </span>
      )}
      {implemented && inactive && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-ember-500 px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-wide text-white">
          Unavailable
        </span>
      )}
      <div className={`relative z-10 h-16 w-16 overflow-hidden rounded-2xl border-2 border-white shadow-sm ${colors.bg} ${inactive ? 'opacity-50 grayscale' : ''}`}>
        {SERVICE_IMAGES[label] ? <img src={SERVICE_IMAGES[label]} alt="" className="h-full w-full object-contain p-1 transition duration-200 group-hover:scale-110" /> : <span className={`absolute inset-0 flex items-center justify-center ${colors.text}`}><Icon size={24} /></span>}
      </div>
      <span className="tile-premium-label relative z-10 mt-3 font-body text-sm font-bold leading-tight">{label}</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'text-emerald-600',
    pending: 'text-amber-600',
    failed: 'text-rose-600',
  };
  return (
    <span className={`font-mono text-[10px] uppercase ${styles[status] ?? 'text-slate-500'}`}>
      {status}
    </span>
  );
}
