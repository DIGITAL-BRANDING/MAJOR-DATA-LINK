import { useEffect, useMemo, useState } from 'react';
import { Eye, Fingerprint, IdCard, Loader2, Printer, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

type Transaction = { id: string; reference: string; type: string; status: string; amount: number; description: string; created_at: string };
const label = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const serviceName = (item: Transaction) => item.description || label(item.type);
const isNin = (item: Transaction) => /nin/.test(`${item.type} ${item.description}`.toLowerCase());
const isBvn = (item: Transaction) => /bvn/.test(`${item.type} ${item.description}`.toLowerCase());
const statusClass = (status: string) => status === 'success' ? 'bg-emerald-100 text-emerald-700' : status === 'failed' || status === 'reversed' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';

export default function ServiceHistoryPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [params] = useSearchParams();
  const group = params.get('group') ?? '';

  useEffect(() => {
    api
      .get<{ status: boolean; data: Transaction[] }>('/transactions/services')
      .then((response) => setItems(response.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => items.filter((item) => {
    const text = `${item.type} ${item.description} ${item.reference}`.toLowerCase();
    const target = group.toLowerCase().replace(/_/g, ' ');
    const matchesGroup = !group || (group === 'OTHER' ? !/(nin|bvn|cac|ipe)/.test(text) : text.includes(target) || text.includes(group.toLowerCase()));
    return matchesGroup && text.includes(search.toLowerCase());
  }), [items, group, search]);

  return <AppShell><div className="mx-auto max-w-4xl pb-8">
    <div className="mb-5 text-center"><p className="font-body text-sm font-semibold text-gold-700">Service history</p><h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">{group ? `${label(group)} History` : 'All Service History'}</h1></div>
    <label className="relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, NIN, BVN or type…" className="w-full rounded-2xl border border-parchment-line bg-white py-4 pl-12 pr-4 font-body text-sm text-ink shadow-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20" /></label>
    <section className="mt-6 space-y-5">{loading ? <Loader2 className="mx-auto my-12 animate-spin text-gold-500" /> : visible.length ? visible.map((item) => {
      const nin = isNin(item); const bvn = isBvn(item); const IdentityIcon = nin ? IdCard : bvn ? Fingerprint : null;
      return <article key={item.id} className="rounded-3xl border border-parchment-line bg-white px-5 py-6 text-center shadow-sm sm:px-10">
        {IdentityIcon && <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold-500 bg-cream text-gold-700"><IdentityIcon size={31} /></div>}
        <div className={IdentityIcon ? 'mt-4' : ''}><div className="flex flex-wrap items-center justify-center gap-2"><h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink">{serviceName(item)}</h2>{(nin || bvn) && <span className="rounded-md bg-sky-700 px-2.5 py-1 text-xs font-bold text-white">{nin ? 'NIN' : 'BVN'}</span>}</div><p className="mt-3 font-body text-base text-ink-600">ID: {item.reference}</p><p className="mt-2 font-body text-base text-ink-600">Type: {label(item.type)}</p><p className="mt-2 font-body text-base text-ink-600">Date: {new Date(item.created_at).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</p><span className={`mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold capitalize ${statusClass(item.status)}`}>{item.status}</span></div>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link to={`/receipt/${item.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-parchment-line bg-white px-5 py-3 font-body text-sm font-semibold text-ink shadow-sm transition hover:border-gold-400 hover:bg-cream"><Printer size={18} /> Reprint</Link><Link to={`/receipt/${item.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-parchment-line bg-white px-5 py-3 font-body text-sm font-semibold text-ink shadow-sm transition hover:border-gold-400 hover:bg-cream"><Eye size={18} /> Details</Link></div>
      </article>;
    }) : <p className="rounded-2xl border border-dashed border-parchment-line bg-white p-10 text-center font-body text-sm text-ink-600">No matching service history found.</p>}</section>
  </div></AppShell>;
}
