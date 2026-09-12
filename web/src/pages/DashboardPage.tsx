import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Copy,
  Check,
  Wallet,
  Sparkles,
  PlusCircle,
  MessageCircle,
  Headset,
} from 'lucide-react';
import AppShell from '../components/AppShell';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { SERVICES, TINT_CLASSES } from '../lib/services';
import { CONTACT, whatsappLink } from '../lib/contact';

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
  'Bulk SMS': '/branding/logo.png',
  'NIN Services': '/branding/Validation.png',
  'BVN Services': '/branding/BVN Verifications.png',
  'CAC Registration': '/branding/CAC Registration.png',
  'SCUML Registration': '/branding/CAC Services.png',
  'TIN Registration': '/branding/TIN Certificate.png',
};

type WalletBalance = {
  balance: number;
  currency: string;
  virtual_account_number: string | null;
  virtual_account_bank: string | null;
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

  // Scoped opt-out of the site-wide dark/gold card skin (see the
  // "body.dashboard-page" rules in index.css) - the dashboard is the page
  // people land on most often, so it gets a plain, high-contrast light
  // layout that's easy to read for everyone, while the rest of the app
  // keeps its existing look until asked to change too.
  useEffect(() => {
    document.body.classList.add('dashboard-page');
    return () => document.body.classList.remove('dashboard-page');
  }, []);

  useEffect(() => {
    api.get<WalletBalance>('/wallet/balance').then(setWallet).catch(() => {});
    api
      .get<{ status: boolean; data: Transaction[] }>('/transactions')
      .then((res) => setTransactions((res.data ?? []).slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadedTransactions(true));
  }, []);

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

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold text-ink-900">
        Hi, {user?.full_name?.split(' ')[0]}
      </h1>

      {/* Balance card */}
      <div className="relative mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
          <a
            href={CONTACT.whatsappChannelUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Join our WhatsApp group"
            title="Join WhatsApp group"
            className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700"
          >
            <MessageCircle size={13} />
            <span>Join group</span>
          </a>
          <a
            href={whatsappLink('Hello K-Tech Solutions, I need support.')}
            target="_blank"
            rel="noreferrer"
            aria-label="Contact support"
            title="Contact support"
            className="flex h-9 items-center gap-1.5 rounded-full bg-brand-700 px-3 text-xs font-bold text-white transition hover:bg-brand-800"
          >
            <Headset size={13} />
            <span>Support</span>
          </a>
        </div>
        <span className="block font-mono text-xs uppercase tracking-widest text-slate-500">
          Wallet balance
        </span>
        <div className="mt-1 font-display text-4xl font-bold text-ink-900">
          {wallet ? `₦${wallet.balance.toLocaleString()}` : '···'}
        </div>
        <p className="mt-1 font-body text-[11px] text-slate-500">Transaction fee: 2%</p>

        {wallet?.virtual_account_number ? (
          <div className="mt-5 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <span className="block font-mono text-[11px] text-slate-500">
                {wallet.virtual_account_bank}
              </span>
              <span className="font-mono text-sm font-semibold text-ink-900">
                {wallet.virtual_account_number}
              </span>
            </div>
            <button
              onClick={copyAccount}
              className="flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 font-body text-xs font-semibold text-white transition hover:bg-brand-800"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <Wallet size={15} className="shrink-0 text-slate-400" />
            <span className="font-body text-xs text-slate-600">
              {wallet?.virtual_account_funding_paused
                ? 'Click the button below to continue funding your wallet using Exact Transfer/Card'
                : 'Your dedicated account number is being set up — check back shortly, or fund via card from Buy Data / Buy Airtime.'}
            </span>
          </div>
        )}

        <Link
          to="/fund-wallet"
          className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-brand-700 py-2.5 font-display text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          <PlusCircle size={16} /> Fund Wallet
        </Link>
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
          {SERVICES.map((service) => (
            <ServiceTile key={service.route} {...service} />
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

function ServiceTile({
  label,
  icon: Icon,
  route,
  tint,
  implemented,
}: (typeof SERVICES)[number]) {
  const colors = TINT_CLASSES[tint];
  return (
    <Link
      to={route}
      className="group relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-md"
    >
      {!implemented && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-slate-100 px-2 py-1 font-body text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Soon
        </span>
      )}
      <div className={`relative z-10 h-16 w-16 overflow-hidden rounded-2xl border-2 border-white shadow-sm ${colors.bg}`}>
        {SERVICE_IMAGES[label] ? <img src={SERVICE_IMAGES[label]} alt="" className="h-full w-full object-contain p-1 transition duration-200 group-hover:scale-110" /> : <span className={`absolute inset-0 flex items-center justify-center ${colors.text}`}><Icon size={24} /></span>}
      </div>
      <span className="relative z-10 mt-3 font-body text-sm font-bold leading-tight text-ink-900">{label}</span>
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
