import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Copy, Gift, Mail, Pencil, Phone, Share2, ShieldAlert, Users, Wallet, X } from 'lucide-react';
import AppShell from '../components/AppShell';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../lib/auth';

type FundingSummary = { total_funded: number; funding_count: number; last_funded_at: string | null };
type ReferralStats = { referral_code: string; total_referrals: number; total_earned: number; pending_commission: number; commission_rate: number };

const naira = (amount: number) => `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
const card = 'rounded-2xl border border-parchment-line bg-parchment p-5';
const input = 'mt-1 w-full rounded-xl border border-parchment-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-gold-500';

function Chip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
      {ok ? <BadgeCheck size={12} /> : <ShieldAlert size={12} />}
      {label}
    </span>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [summary, setSummary] = useState<FundingSummary | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', pin: '' });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    api.get<{ data: FundingSummary }>('/user/profile/summary').then((r) => setSummary(r.data)).catch(() => setSummaryFailed(true));
    api.get<{ data: ReferralStats }>('/referral/stats').then((r) => setStats(r.data)).catch(() => undefined);
  }, []);

  if (!user) return <AppShell><p className="text-sm text-ink-600">Loading your profile…</p></AppShell>;

  const referralCode = stats?.referral_code ?? (typeof user.referral_code === 'string' ? user.referral_code : '');
  const referralLink = referralCode ? `${window.location.origin}/register?ref=${referralCode}` : '';
  const emailVerified = user.email_verified === true;
  const phoneVerified = user.phone_verified === true;
  const walletBalance = typeof user.wallet_balance === 'number' ? user.wallet_balance : 0;
  const kyc = typeof user.kyc_status === 'string' ? user.kyc_status.replace(/_/g, ' ') : 'unverified';
  // Older cached auth payloads can omit contact fields even though current API responses include them.
  // Normalize them once so the profile route cannot crash while checking whether a PIN is needed.
  const originalEmail = typeof user.email === 'string' ? user.email : '';
  const originalPhone = typeof user.phone === 'string' ? user.phone : '';
  const originalFullName = typeof user.full_name === 'string' ? user.full_name : '';
  const contactChanged = form.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase() || form.phone.trim() !== originalPhone.trim();

  function startEditing() {
    setForm({ full_name: originalFullName, email: originalEmail, phone: originalPhone, pin: '' });
    setNotice(null);
    setEditing(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await api.post('/user/profile/update', {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        ...(contactChanged ? { pin: form.pin } : {})
      });
      await refreshUser();
      setEditing(false);
      setNotice({ kind: 'ok', text: contactChanged ? 'Details updated. Please verify your new email/phone number.' : 'Details updated.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error instanceof ApiError ? error.message : 'Could not update your details. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setNotice({ kind: 'error', text: 'Copy is not available in this browser. Select the text and copy it manually.' });
    }
  }

  const shareText = `Join me on K-TECH Solutions for NIN, BVN and other services. Sign up with my link: ${referralLink}`;

  return (
    <AppShell>
      <div className="max-w-4xl space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">My profile</h1>
          <p className="mt-1 text-sm text-ink-600">Your account details, wallet funding and referral code.</p>
        </div>

        {notice && <p className={`rounded-xl border px-4 py-3 text-sm ${notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-ember-500/40 bg-red-50 text-red-700'}`}>{notice.text}</p>}

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-parchment-line bg-parchment p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-600"><Wallet size={14} />Wallet balance</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{naira(walletBalance)}</p>
          </div>
          <div className="rounded-xl border border-gold-500/60 bg-gold-50 p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-600"><Wallet size={14} />Total funded</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{summary ? naira(summary.total_funded) : summaryFailed ? 'Unavailable' : '…'}</p>
            <p className="mt-0.5 text-[11px] text-ink-600">
              {summary ? (summary.funding_count > 0 ? `${summary.funding_count} funding${summary.funding_count === 1 ? '' : 's'} · last ${formatDate(summary.last_funded_at)}` : 'No wallet funding yet') : ' '}
            </p>
          </div>
          <div className="rounded-xl border border-parchment-line bg-parchment p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-600"><Users size={14} />Referrals</p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{stats ? stats.total_referrals : '…'}</p>
            <p className="mt-0.5 text-[11px] text-ink-600">{stats ? `${naira(stats.total_earned)} earned` : ' '}</p>
          </div>
        </section>

        <section className={card}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-ink">Account details</h2>
            {!editing && (
              <button type="button" onClick={startEditing} className="flex items-center gap-1.5 rounded-lg border border-parchment-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-gold-50">
                <Pencil size={14} />Edit details
              </button>
            )}
          </div>

          {!editing ? (
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-ink-600">Full name</dt><dd className="mt-0.5 font-semibold text-ink">{originalFullName || '—'}</dd></div>
              <div><dt className="text-xs text-ink-600">Member since</dt><dd className="mt-0.5 font-semibold text-ink">{formatDate(typeof user.created_at === 'string' ? user.created_at : null)}</dd></div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-ink-600"><Mail size={12} />Email</dt>
                <dd className="mt-0.5 break-all font-semibold text-ink">{originalEmail || '—'} <Chip ok={emailVerified} label={emailVerified ? 'Verified' : 'Not verified'} /></dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-ink-600"><Phone size={12} />Phone</dt>
                <dd className="mt-0.5 font-semibold text-ink">{originalPhone || '—'} <Chip ok={phoneVerified} label={phoneVerified ? 'Verified' : 'Not verified'} /></dd>
              </div>
              <div><dt className="text-xs text-ink-600">KYC status</dt><dd className="mt-0.5 font-semibold capitalize text-ink">{kyc}</dd></div>
              {(!emailVerified || !phoneVerified) && (
                <div className="flex items-end"><Link to="/verify-account" className="text-sm font-bold text-gold-700 underline">Verify my account</Link></div>
              )}
            </dl>
          ) : (
            <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-ink sm:col-span-2">Full name
                <input className={input} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} minLength={2} maxLength={120} required />
              </label>
              <label className="text-sm font-semibold text-ink">Email
                <input className={input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </label>
              <label className="text-sm font-semibold text-ink">Phone number
                <input className={input} type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} minLength={6} maxLength={20} required />
              </label>
              {contactChanged && (
                <label className="text-sm font-semibold text-ink sm:col-span-2">Transaction PIN
                  <input className={input} type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })} placeholder="Enter your PIN to confirm" required />
                  <span className="mt-1 block text-xs font-normal text-ink-600">Changing your email or phone number needs your transaction PIN. The new contact will have to be verified again.</span>
                </label>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={saving} className="rounded-xl bg-gold-400 px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
                <button type="button" onClick={() => setEditing(false)} disabled={saving} className="flex items-center gap-1.5 rounded-xl border border-parchment-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"><X size={14} />Cancel</button>
              </div>
            </form>
          )}
        </section>

        <section className="rounded-2xl bg-ink p-5 text-cream">
          <div className="flex items-center gap-3"><Gift className="text-gold-400" /><h2 className="font-display text-lg font-bold">Refer and earn</h2></div>
          <p className="mt-1 text-sm text-cream/80">Share your code. You earn {((stats?.commission_rate ?? 0.01) * 100).toFixed(2)}% whenever someone you refer completes a purchase.</p>
          <p className="mt-4 text-xs uppercase tracking-widest text-gold-400">Your referral code</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="rounded-lg bg-white/10 px-4 py-2 font-mono text-lg font-bold tracking-wider">{referralCode || '—'}</span>
            <button type="button" disabled={!referralCode} onClick={() => copy(referralCode, 'code')} className="flex items-center gap-1.5 rounded-lg bg-gold-400 px-3 py-2 text-sm font-bold text-ink disabled:opacity-50"><Copy size={14} />{copied === 'code' ? 'Copied' : 'Copy code'}</button>
          </div>
          <p className="mt-4 text-xs uppercase tracking-widest text-gold-400">Your referral link</p>
          <p className="mt-1 break-all font-mono text-xs text-cream/90">{referralLink || '—'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!referralLink} onClick={() => copy(referralLink, 'link')} className="flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold disabled:opacity-50"><Copy size={14} />{copied === 'link' ? 'Copied' : 'Copy link'}</button>
            <a aria-disabled={!referralLink} href={referralLink ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : undefined} target="_blank" rel="noreferrer" className={`flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold ${referralLink ? '' : 'pointer-events-none opacity-50'}`}><Share2 size={14} />Share on WhatsApp</a>
            <Link to="/referrals" className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-gold-400 underline">Earnings & withdrawals</Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
