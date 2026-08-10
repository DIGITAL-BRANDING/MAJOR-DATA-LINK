import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Check, Wallet, Sparkles } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { SERVICES, TINT_CLASSES } from '../lib/services';

type WalletBalance = {
  balance: number;
  currency: string;
  virtual_account_number: string | null;
  virtual_account_bank: string | null;
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
      <h1 className="font-display text-2xl font-bold text-ink">
        Hi, {user?.full_name?.split(' ')[0]}
      </h1>

      {/* Balance card */}
      <div className="mt-5 rounded-2xl bg-ink p-6">
        <span className="font-mono text-xs uppercase tracking-widest text-gold-500/70">
          Wallet balance
        </span>
        <div className="mt-1 font-display text-4xl font-bold text-cream">
          {wallet ? `₦${wallet.balance.toLocaleString()}` : '···'}
        </div>

        {wallet?.virtual_account_number ? (
          <div className="mt-5 flex items-center justify-between rounded-lg border border-ink-line bg-ink-soft px-4 py-3">
            <div>
              <span className="block font-mono text-[11px] text-cream/50">
                {wallet.virtual_account_bank}
              </span>
              <span className="font-mono text-sm font-semibold text-cream">
                {wallet.virtual_account_number}
              </span>
            </div>
            <button
              onClick={copyAccount}
              className="flex items-center gap-1.5 rounded-md bg-gold-500 px-3 py-1.5 font-body text-xs font-semibold text-ink transition hover:bg-gold-400"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-ink-line bg-ink-soft px-4 py-3">
            <Wallet size={15} className="shrink-0 text-gold-500/70" />
            <span className="font-body text-xs text-cream/60">
              Your dedicated account number is being set up — check back shortly, or fund via
              card from Buy Data / Buy Airtime.
            </span>
          </div>
        )}
      </div>

      {/* First-time helper: how this whole thing works, in three steps */}
      {isFirstTimeUser && (
        <div className="mt-6 rounded-2xl border border-gold-500/30 bg-gold-50 p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-gold-600" />
            <h2 className="font-display text-sm font-bold text-ink">
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
        <h2 className="font-display text-base font-semibold text-ink">Services</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {SERVICES.map((service) => (
            <ServiceTile key={service.route} {...service} />
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="mt-10">
        <h2 className="font-display text-base font-semibold text-ink">Recent activity</h2>
        {transactions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-parchment-line px-4 py-8 text-center font-body text-sm text-ink-600">
            No transactions yet — your top-ups will show up here.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-parchment-line rounded-xl border border-parchment-line bg-parchment">
            {transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-body text-sm font-medium text-ink">{t.description}</p>
                  <p className="font-mono text-xs text-ink-600">
                    {new Date(t.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-ink">
                    ₦{t.amount.toLocaleString()}
                  </p>
                  <StatusBadge status={t.status} />
                </div>
              </div>
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-gold-500">
        {number}
      </span>
      <div>
        <p className="font-body text-sm font-semibold text-ink">{title}</p>
        <p className="font-body text-xs text-ink-600">{detail}</p>
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
      className="group relative flex flex-col items-center gap-2 rounded-xl border border-parchment-line bg-parchment px-2 py-4 text-center transition hover:border-gold-500/60 hover:shadow-sm"
    >
      {!implemented && (
        <span className="absolute right-1.5 top-1.5 rounded-full bg-ink px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wide text-gold-500">
          Soon
        </span>
      )}
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}
      >
        <Icon size={19} />
      </div>
      <span className="font-body text-[11px] font-medium leading-tight text-ink">{label}</span>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: 'text-success-600',
    pending: 'text-gold-600',
    failed: 'text-ember-600',
  };
  return (
    <span className={`font-mono text-[10px] uppercase ${styles[status] ?? 'text-ink-600'}`}>
      {status}
    </span>
  );
}
