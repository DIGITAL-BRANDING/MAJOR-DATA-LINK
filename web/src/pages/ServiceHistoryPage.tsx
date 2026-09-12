import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';
type Transaction = { id: string; reference: string; type: string; status: string; amount: number; description: string; created_at: string };
const label = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
export default function ServiceHistoryPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const group = params.get('group') ?? '';

  useEffect(() => {
    api.get<{ data: Transaction[] }>('/transactions')
      .then((response) => setItems(response.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.type} ${item.description} ${item.reference}`.toLowerCase();
    const target = group.toLowerCase().replace(/_/g, ' ');
    const matchesGroup = !group || (group === 'OTHER'
      ? !/(nin|bvn|cac|ipe)/.test(text)
      : text.includes(target) || text.includes(group.toLowerCase()));
    return matchesGroup && text.includes(search.toLowerCase());
  }), [items, group, search]);

  return <AppShell><div className="mx-auto max-w-5xl"><header className="rounded-2xl border border-gold-500/40 bg-ink p-6 text-cream"><p className="text-sm font-semibold text-gold-300">Account resources</p><h1 className="mt-1 text-3xl font-bold">{group ? `${label(group)} History` : 'All Service History'}</h1><p className="mt-2 text-sm text-cream/75">Review service transactions and request status.</p></header><label className="relative mt-6 block"><Search className="absolute left-4 top-3 text-ink-500" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search service, reference or status" className="w-full rounded-xl border border-parchment-line bg-white py-3 pl-11 pr-4 text-sm"/></label><section className="mt-5 space-y-3">{loading ? <Loader2 className="mx-auto my-10 animate-spin text-gold-500"/> : visible.length ? visible.map((item) => <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-parchment-line bg-parchment p-4"><div><h2 className="font-semibold text-ink">{item.description || label(item.type)}</h2><p className="mt-1 text-xs text-ink-600">{item.reference} · {new Date(item.created_at).toLocaleString()}</p></div><div className="text-right"><b className="block text-ink">₦{item.amount.toLocaleString()}</b><span className="text-xs font-bold uppercase text-gold-700">{item.status}</span></div></article>) : <p className="rounded-xl border border-dashed border-parchment-line p-8 text-center text-ink-600">No matching service history found.</p>}</section></div></AppShell>;
}
