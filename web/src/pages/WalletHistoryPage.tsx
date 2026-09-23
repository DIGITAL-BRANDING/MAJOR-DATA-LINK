import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Loader2, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

type Transaction = { id: string; reference: string; type: string; status: string; amount: number; balance_after: number; description: string; created_at: string };

const CREDIT_TYPES = new Set(['wallet_funding', 'wallet_transfer', 'refund', 'referral_commission', 'coupon_redemption']);
const displayType = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function WalletHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'credit' | 'debit'>('all');

  useEffect(() => {
    api.get<{ status: boolean; data: Transaction[] }>('/transactions')
      .then((result) => setTransactions(result.data ?? []))
      .catch(() => setError('Unable to load wallet history. Please refresh and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => transactions.filter((transaction) => {
    if (filter === 'all') return true;
    const isCredit = CREDIT_TYPES.has(transaction.type);
    return filter === 'credit' ? isCredit : !isCredit;
  }), [filter, transactions]);

  return <AppShell><div className="mx-auto max-w-3xl pb-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-body text-sm font-semibold text-gold-700">Wallet activity</p><h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Wallet History</h1><p className="mt-2 font-body text-sm text-ink-600">Every wallet credit, purchase, fee and refund in one place.</p></div><Link to="/fund-wallet" className="inline-flex items-center gap-2 rounded-xl bg-gold-500 px-4 py-3 font-body text-sm font-bold text-ink"><WalletCards size={17} /> Fund wallet</Link></div>
    <div className="mt-6 flex gap-2 rounded-xl border border-parchment-line bg-white p-1.5">{(['all', 'credit', 'debit'] as const).map((option) => <button key={option} onClick={() => setFilter(option)} className={`flex-1 rounded-lg px-3 py-2 font-body text-sm font-semibold capitalize transition ${filter === option ? 'bg-gold-500 text-ink' : 'text-ink-600 hover:bg-cream'}`}>{option === 'all' ? 'All activity' : option === 'credit' ? 'Money in' : 'Money out'}</button>)}</div>
    {loading ? <Loader2 className="mx-auto my-14 animate-spin text-gold-500" /> : error ? <p role="alert" className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-center font-body text-sm font-semibold text-rose-700">{error}</p> : visible.length === 0 ? <p className="mt-6 rounded-2xl border border-dashed border-parchment-line bg-white p-10 text-center font-body text-sm text-ink-600">No wallet activity yet.</p> : <section className="mt-6 overflow-hidden rounded-2xl border border-parchment-line bg-white shadow-sm">{visible.map((transaction) => { const isCredit = CREDIT_TYPES.has(transaction.type); return <Link key={transaction.id} to={`/receipt/${transaction.id}`} className="flex items-center gap-3 border-b border-parchment-line px-4 py-4 last:border-b-0 transition hover:bg-cream sm:px-5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{isCredit ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}</span><div className="min-w-0 flex-1"><p className="truncate font-body text-sm font-semibold text-ink">{transaction.description || displayType(transaction.type)}</p><p className="mt-1 font-mono text-[11px] text-ink-500">{new Date(transaction.created_at).toLocaleString('en-NG')} · {transaction.status}</p></div><div className="text-right"><p className={`font-mono text-sm font-bold ${isCredit ? 'text-emerald-700' : 'text-rose-700'}`}>{isCredit ? '+' : '−'}₦{transaction.amount.toLocaleString('en-NG')}</p><p className="mt-1 font-mono text-[11px] text-ink-500">Bal. ₦{transaction.balance_after.toLocaleString('en-NG')}</p></div></Link>; })}</section>}
  </div></AppShell>;
}
