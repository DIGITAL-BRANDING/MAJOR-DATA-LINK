import { useEffect, useMemo, useState } from 'react';
import {
  Baby,
  CreditCard,
  Eye,
  ExternalLink,
  FileText,
  Fingerprint,
  Folder,
  GraduationCap,
  IdCard,
  Loader2,
  MessageSquareText,
  Newspaper,
  Printer,
  Search,
  ShieldCheck,
  Tv,
  UserCog,
  Users,
  Wallet,
  Wifi,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import { api } from '../lib/api';

type Transaction = {
  id: string;
  reference: string;
  type: string;
  /** Specific VerificationServiceKey (e.g. "NIN_SLIP_PREMIUM", "IPE_CLEARANCE")
   *  for the identity-verification types that share one generic
   *  TransactionType - see the /transactions/services route. Absent for
   *  every other service, which is already 1:1 with its own type. */
  service?: string;
  status: string;
  amount: number;
  description: string;
  created_at: string;
  document_available?: boolean;
  holder_name?: string;
  identifier?: string;
  slip_type?: string;
  expires_at?: string;
};

const label = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const serviceName = (item: Transaction) => item.description || label(item.type);
const statusClass = (status: string) =>
  status === 'success'
    ? 'bg-emerald-100 text-emerald-700'
    : status === 'failed' || status === 'reversed'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-700';

const dateTime = (value: string) => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

function expiryLabel(value?: string) {
  if (!value) return null;
  const remaining = Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (remaining < 0) return `Expired ${new Date(value).toLocaleDateString('en-NG', { dateStyle: 'medium' })}`;
  return `${remaining}d ${remaining === 1 ? 'left' : 'left'} — Expires ${new Date(value).toLocaleDateString('en-NG', { dateStyle: 'medium' })}`;
}

/**
 * Each folder's `match` is the single source of truth for "does this
 * transaction belong here" - both the overview grid's counts and the
 * detail list's filter call the exact same function, so what a customer
 * sees inside a folder is always exactly what its count promised.
 *
 * Matching is on tx.type (and, only where one TransactionType is shared by
 * several distinct services - see the `service` field above - a prefix
 * check on tx.service) rather than substring-matching free text like the
 * previous version did, which could both miss real entries (unusual
 * description wording) and wrongly include unrelated ones (e.g. any
 * description that happened to contain "cac").
 */
type Group = { id: string; label: string; icon: LucideIcon; match: (item: Transaction) => boolean };

const GROUPS: Group[] = [
  { id: 'NIN_VERIFICATION', label: 'NIN Verification', icon: IdCard, match: (i) => i.type === 'nin_verification' },
  { id: 'BVN_VERIFICATION', label: 'BVN Verification', icon: Fingerprint, match: (i) => i.type === 'bvn_verification' },
  { id: 'NIN_VALIDATION', label: 'NIN Validation', icon: ShieldCheck, match: (i) => i.type === 'identity_service_request' && !!i.service?.startsWith('NIN_VALIDATION') },
  { id: 'IPE_CLEARANCE', label: 'IPE Clearance', icon: ShieldCheck, match: (i) => i.type === 'identity_service_request' && i.service === 'IPE_CLEARANCE' },
  { id: 'NIN_PERSONALIZATION', label: 'NIN Personalization', icon: UserCog, match: (i) => i.type === 'identity_service_request' && i.service === 'NIN_PERSONALIZATION' },
  { id: 'NIN_DELINKING', label: 'NIN Delinking', icon: UserCog, match: (i) => i.type === 'identity_service_request' && i.service === 'NIN_DELINKING' },
  { id: 'BVN_RETRIEVAL', label: 'BVN Retrieval', icon: Fingerprint, match: (i) => i.type === 'identity_service_request' && i.service === 'BVN_RETRIEVAL' },
  { id: 'NIN_MODIFICATION', label: 'NIN Modification', icon: IdCard, match: (i) => i.type === 'nin_modification' },
  { id: 'BVN_MODIFICATION', label: 'BVN Modification', icon: Fingerprint, match: (i) => i.type === 'bvn_modification' },
  { id: 'BVN_LICENSE_ONBOARDING', label: 'BVN License Onboarding', icon: Fingerprint, match: (i) => i.type === 'bvn_license_onboarding' },
  { id: 'BVN_CRM', label: 'BVN CRM', icon: Users, match: (i) => i.type === 'bvn_crm' },
  { id: 'CAC', label: 'CAC Registration', icon: FileText, match: (i) => i.type === 'cac_service_request' },
  { id: 'BIRTH_ATTESTATION', label: 'Birth Attestation', icon: Baby, match: (i) => i.type === 'birth_attestation' },
  { id: 'NEWSPAPER_PUBLICATION', label: 'Newspaper Publication', icon: Newspaper, match: (i) => i.type === 'newspaper_publication' },
  { id: 'JAMB', label: 'JAMB Services', icon: GraduationCap, match: (i) => i.type === 'jamb_service_request' },
  { id: 'DATA', label: 'Data', icon: Wifi, match: (i) => i.type === 'data_purchase' },
  { id: 'AIRTIME', label: 'Airtime', icon: CreditCard, match: (i) => i.type === 'airtime_purchase' },
  { id: 'CABLE', label: 'Cable TV', icon: Tv, match: (i) => i.type === 'cable_purchase' },
  { id: 'ELECTRICITY', label: 'Electricity', icon: Zap, match: (i) => i.type === 'electricity_purchase' },
  { id: 'RESULT_PIN', label: 'Result Checker PIN', icon: FileText, match: (i) => i.type === 'result_pin' },
  { id: 'SMS', label: 'Bulk SMS', icon: MessageSquareText, match: (i) => i.type === 'sms' },
];

function groupFor(item: Transaction): Group | undefined {
  return GROUPS.find((g) => g.match(item));
}

export default function ServiceHistoryPage() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);
  const [params] = useSearchParams();
  const groupId = params.get('group') ?? '';
  const activeGroup = GROUPS.find((g) => g.id === groupId);

  useEffect(() => {
    api
      .get<{ status: boolean; data: Transaction[] }>('/transactions/services')
      .then((response) => setItems(response.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // One folder per GROUPS entry that actually has at least one transaction,
  // in the order the customer is most likely to care about (most recent
  // activity first) rather than the fixed GROUPS declaration order.
  const folders = useMemo(() => {
    const counts = new Map<string, { group: Group; count: number; latest: string }>();
    for (const item of items) {
      const g = groupFor(item);
      if (!g) continue;
      const existing = counts.get(g.id);
      if (existing) {
        existing.count += 1;
        if (item.created_at > existing.latest) existing.latest = item.created_at;
      } else {
        counts.set(g.id, { group: g, count: 1, latest: item.created_at });
      }
    }
    return [...counts.values()].sort((a, b) => (a.latest < b.latest ? 1 : -1));
  }, [items]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (activeGroup && !activeGroup.match(item)) return false;
        const text = `${item.type} ${item.description} ${item.reference}`.toLowerCase();
        return text.includes(search.toLowerCase());
      }),
    [items, activeGroup, search]
  );

  useEffect(() => () => { if (documentUrl) URL.revokeObjectURL(documentUrl); }, [documentUrl]);

  async function getDocument(item: Transaction) {
    setDocumentError('');
    setDocumentLoading(item.id);
    try {
      const blob = await api.getFile(`/transactions/${item.id}/service-document`);
      const url = URL.createObjectURL(blob);
      setDocumentUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; });
      setDocumentTitle(`${serviceName(item)} — ${item.reference}`);
      return url;
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Could not open this service document.');
      return null;
    } finally {
      setDocumentLoading(null);
    }
  }

  async function previewDocument(item: Transaction) {
    const url = await getDocument(item);
    if (url) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function openDocument(item: Transaction) {
    // Open first so mobile browsers do not classify the later Blob navigation
    // as an unsolicited popup.
    const tab = window.open('', '_blank');
    if (tab) tab.opener = null;
    const url = await getDocument(item);
    if (url) {
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener');
    } else tab?.close();
  }

  async function downloadDocument(item: Transaction) {
    const url = await getDocument(item);
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${item.reference}-service-document.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const showFolders = !groupId && !search;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl pb-8">
        <div className="mb-5 text-center">
          <p className="font-body text-sm font-semibold text-gold-700">Service history</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">
            {activeGroup ? `${activeGroup.label} History` : 'Service History'}
          </h1>
          {activeGroup && (
            <Link to="/verifications" className="mt-1 inline-block font-body text-sm font-semibold text-gold-700">
              ← All services
            </Link>
          )}
        </div>

        <label className="relative block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-500" size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, NIN, BVN or type…"
            className="w-full rounded-2xl border border-parchment-line bg-white py-4 pl-12 pr-4 font-body text-sm text-ink shadow-sm outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
          />
        </label>

        {documentError && (
          <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-center font-body text-sm font-semibold text-rose-700">
            {documentError}
          </p>
        )}
        {documentUrl && (
          <section className="mt-5 overflow-hidden rounded-3xl border border-parchment-line bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-parchment-line px-5 py-4">
              <div className="min-w-0">
                <p className="font-body text-xs font-semibold uppercase tracking-wide text-gold-700">Service document preview</p>
                <h2 className="truncate font-display text-lg font-bold text-ink">{documentTitle}</h2>
              </div>
              <button onClick={() => setDocumentUrl(null)} aria-label="Close document preview" className="rounded-lg p-2 text-ink-600 hover:bg-cream">
                <X size={19} />
              </button>
            </div>
            <iframe title={documentTitle} src={documentUrl} className="h-[70vh] w-full bg-slate-100" />
          </section>
        )}

        {loading ? (
          <Loader2 className="mx-auto my-12 animate-spin text-gold-500" />
        ) : showFolders ? (
          folders.length ? (
            <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {folders.map(({ group, count, latest }) => (
                <Link
                  key={group.id}
                  to={`/verifications?group=${group.id}`}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-parchment-line bg-white px-4 py-6 text-center shadow-sm transition hover:border-gold-400 hover:shadow-md"
                >
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-700">
                    <Folder size={22} className="opacity-40" />
                    <group.icon size={20} className="absolute" />
                  </div>
                  <p className="font-body text-sm font-semibold text-ink">{group.label}</p>
                  <p className="font-body text-xs text-ink-500">
                    {count} {count === 1 ? 'entry' : 'entries'}
                  </p>
                  <p className="font-body text-[11px] text-ink-400">{new Date(latest).toLocaleDateString('en-NG', { dateStyle: 'medium' })}</p>
                </Link>
              ))}
            </section>
          ) : (
            <p className="mt-6 rounded-2xl border border-dashed border-parchment-line bg-white p-10 text-center font-body text-sm text-ink-600">
              No service history yet.
            </p>
          )
        ) : (
          <section className="mt-6 space-y-5">
            {visible.length ? (
              visible.map((item) => {
                const group = groupFor(item);
                const isIdentity = group?.id === 'NIN_VERIFICATION' || group?.id === 'BVN_VERIFICATION';
                const IdentityIcon = group?.id === 'NIN_VERIFICATION' ? IdCard : group?.id === 'BVN_VERIFICATION' ? Fingerprint : Wallet;
                const expiry = isIdentity ? expiryLabel(item.expires_at) : null;
                return (
                  <article key={item.id} className={`rounded-3xl border border-parchment-line bg-white px-5 py-5 shadow-sm ${isIdentity ? 'sm:flex sm:items-center sm:gap-5' : 'text-center sm:px-10'}`}>
                    {group && (
                      <div className={`${isIdentity ? 'mx-auto sm:mx-0' : 'mx-auto'} flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-gold-500 bg-cream text-gold-700`}>
                        <IdentityIcon size={31} />
                      </div>
                    )}
                    <div className={`${group && !isIdentity ? 'mt-4' : ''} min-w-0 flex-1 ${isIdentity ? 'mt-4 sm:mt-0' : ''}`}>
                      <div className={`flex flex-wrap items-center gap-2 ${isIdentity ? 'justify-center sm:justify-start' : 'justify-center'}`}>
                        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-ink">{isIdentity ? (item.holder_name ?? serviceName(item)) : serviceName(item)}</h2>
                        {isIdentity && (
                          <span className="rounded-md bg-sky-700 px-2.5 py-1 text-xs font-bold text-white">
                            {group?.id === 'NIN_VERIFICATION' ? 'NIN' : 'BVN'}
                          </span>
                        )}
                      </div>
                      {isIdentity ? (
                        <>
                          <p className="mt-2 text-center font-body text-sm text-ink-600 sm:text-left">ID: {item.identifier ?? item.reference} &nbsp; Type: {item.slip_type ?? label(item.type)} &nbsp; Date: {dateTime(item.created_at)}</p>
                          {expiry && <span className={`mt-2 inline-block rounded-md px-3 py-1 font-body text-xs font-bold ${expiry.startsWith('Expired') ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{expiry}</span>}
                        </>
                      ) : (
                        <>
                          <p className="mt-3 font-body text-base text-ink-600">ID: {item.reference}</p>
                          <p className="mt-2 font-body text-base text-ink-600">Type: {label(item.type)}</p>
                          <p className="mt-2 font-body text-base text-ink-600">Date: {dateTime(item.created_at)}</p>
                          <span className={`mt-4 inline-block rounded-lg px-4 py-2 text-sm font-bold capitalize ${statusClass(item.status)}`}>{item.status}</span>
                        </>
                      )}
                    </div>
                    <div className={`${isIdentity ? 'mt-4 sm:mt-0 sm:flex-col sm:items-stretch' : 'mt-6'} flex flex-wrap justify-center gap-3`}>
                      {item.document_available && (
                        <>
                          <button
                            disabled={documentLoading === item.id}
                            onClick={() => void previewDocument(item)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gold-500 px-5 py-3 font-body text-sm font-bold text-ink shadow-sm transition hover:bg-gold-400 disabled:opacity-60"
                          >
                            <Eye size={18} /> {documentLoading === item.id ? 'Loading slip…' : 'Details'}
                          </button>
                          <button
                            disabled={documentLoading === item.id}
                            onClick={() => void openDocument(item)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-parchment-line bg-white px-5 py-3 font-body text-sm font-semibold text-ink shadow-sm transition hover:border-gold-400 hover:bg-cream disabled:opacity-60"
                          >
                            <ExternalLink size={18} /> Open slip
                          </button>
                          {isIdentity && <button disabled={documentLoading === item.id} onClick={() => void downloadDocument(item)} className="inline-flex items-center gap-2 rounded-2xl border border-parchment-line bg-white px-5 py-3 font-body text-sm font-semibold text-ink shadow-sm transition hover:border-gold-400 hover:bg-cream disabled:opacity-60"><Printer size={18} /> Reprint</button>}
                        </>
                      )}
                      {!isIdentity && <><Link to={`/receipt/${item.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-parchment-line bg-white px-5 py-3 font-body text-sm font-semibold text-ink shadow-sm transition hover:border-gold-400 hover:bg-cream"><Printer size={18} /> Receipt</Link><Link to={`/receipt/${item.id}`} className="inline-flex items-center gap-2 rounded-2xl border border-parchment-line bg-white px-5 py-3 font-body text-sm font-semibold text-ink shadow-sm transition hover:border-gold-400 hover:bg-cream"><Eye size={18} /> Details</Link></>}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="rounded-2xl border border-dashed border-parchment-line bg-white p-10 text-center font-body text-sm text-ink-600">
                No matching service history found.
              </p>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
