import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Smartphone, Wifi, Copy, Check } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';

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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get<WalletBalance>('/wallet/balance').then(setWallet).catch(() => {});
    api
      .get<{ status: boolean; data: Transaction[] }>('/transactions')
      .then((res) => setTransactions((res.data ?? []).slice(0, 5)))
      .catch(() => {});
  }, []);

  function copyAccount() {
    if (!wallet?.virtual_account_number) return;
    navigator.clipboard.writeText(wallet.virtual_account_number);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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

        {wallet?.virtual_account_number && (
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
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ActionCard to="/buy-airtime" icon={Smartphone} label="Buy Airtime" />
        <ActionCard to="/buy-data" icon={Wifi} label="Buy Data" />
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

function ActionCard({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof Smartphone;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-2 rounded-xl border border-parchment-line bg-parchment py-5 transition hover:border-gold-500/60"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-gold-500">
        <Icon size={18} />
      </div>
      <span className="font-body text-xs font-medium text-ink">{label}</span>
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
