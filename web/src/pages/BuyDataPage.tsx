import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ReceiptText } from 'lucide-react';
import AppShell from '../components/AppShell';
import { api, ApiError } from '../lib/api';
import { findLatestTransactionId } from '../lib/receipt';
import { PinConfirmDialog } from '../components/PinConfirmDialog';

const NETWORKS = [
  { code: 'MTN', label: 'MTN', bg: 'bg-[#FFCC00]', text: 'text-ink' },
  { code: 'GLO', label: 'Glo', bg: 'bg-[#00A651]', text: 'text-white' },
  { code: 'AIRTEL', label: 'Airtel', bg: 'bg-[#ED1C24]', text: 'text-white' },
  { code: '9MOBILE', label: '9mobile', bg: 'bg-[#00A99D]', text: 'text-white' },
];

type Category = { category: string; planCount: number };
type Plan = { id: string; name: string; amount: number; validity: string; planType?: string };

export default function BuyDataPage() {
  const navigate = useNavigate();
  const [network, setNetwork] = useState('MTN');
  const [phone, setPhone] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);

  // Reload categories whenever network changes
  useEffect(() => {
    setCategory(null);
    setPlans([]);
    setPlanId(null);
    setLoadingCategories(true);
    api
      .get<{ status: boolean; data: Category[] }>(`/data/plans/${network}/categories`)
      .then((res) => setCategories(res.data ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingCategories(false));
  }, [network]);

  // Reload plans whenever category changes
  useEffect(() => {
    if (!category) return;
    setPlanId(null);
    setLoadingPlans(true);
    api
      .get<{ status: boolean; data: Plan[] }>(
        `/data/plans/${network}?category=${encodeURIComponent(category)}`
      )
      .then((res) => setPlans(res.data ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, [network, category]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (planId) setShowPin(true);
  }

  async function purchase(pin: string) {
    if (!planId) return;
    setShowPin(false);
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post<{ status: boolean; message: string }>('/data/purchase', { network, plan_id: planId, phone, pin });
      if (res.status) {
        setSuccess(res.message || 'Data delivered successfully');
        findLatestTransactionId().then(setReceiptId);
      } else setError(res.message || 'Purchase failed');
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'); } finally { setIsSubmitting(false); }
  }

  const selectedPlan = plans.find((p) => p.id === planId);

  if (success) {
    return (
      <AppShell>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-parchment-line bg-parchment px-6 py-14 text-center">
          <CheckCircle2 size={44} className="text-success-500" />
          <h1 className="font-display text-xl font-bold text-ink">Data delivered</h1>
          <p className="max-w-xs font-body text-sm text-ink-600">{success}</p>
          <div className="mt-2 flex gap-3">
            {receiptId && (
              <Link
                to={`/receipt/${receiptId}`}
                className="flex items-center gap-1.5 rounded-lg border border-gold-500/50 px-5 py-2.5 font-body text-sm font-semibold text-gold-700 transition hover:bg-gold-50"
              >
                <ReceiptText size={15} /> View receipt
              </Link>
            )}
            <button
              onClick={() => {
                setSuccess(null);
                setReceiptId(null);
                setPhone('');
                setPlanId(null);
              }}
              className="rounded-lg bg-gold-500 px-5 py-2.5 font-display text-sm font-semibold text-ink transition hover:bg-gold-400"
            >
              Buy again
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-lg border border-parchment-line px-5 py-2.5 font-body text-sm text-ink-600"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={purchase} /></AppShell>
    );
  }

  return (
    <AppShell>
      <button
        onClick={() => navigate('/dashboard')}
        className="mb-4 flex items-center gap-1.5 font-body text-sm text-ink-600 hover:text-ink"
      >
        <ArrowLeft size={15} /> Back
      </button>
      <h1 className="font-display text-2xl font-bold text-ink">Buy Data</h1>

      <form onSubmit={handleSubmit} className="mt-6 max-w-md space-y-6">
        <div>
          <span className="mb-2 block font-body text-xs font-medium text-ink-600">Network</span>
          <div className="grid grid-cols-4 gap-2">
            {NETWORKS.map((n) => (
              <button
                key={n.code}
                type="button"
                onClick={() => setNetwork(n.code)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 transition ${
                  network === n.code ? 'border-gold-500' : 'border-transparent'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-full font-display text-[10px] font-bold ${n.bg} ${n.text}`}>
                  {n.label.slice(0, 3).toUpperCase()}
                </span>
                <span className="font-body text-[11px] text-ink-600">{n.label}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block font-body text-xs font-medium text-ink-600">
            Phone number
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="080..."
            required
            className="w-full rounded-lg border border-parchment-line bg-parchment px-3.5 py-2.5 font-body text-sm text-ink outline-none focus:border-gold-500"
          />
        </label>

        <div>
          <span className="mb-2 block font-body text-xs font-medium text-ink-600">Data type</span>
          {loadingCategories ? (
            <SkeletonRow />
          ) : categories.length === 0 ? (
            <p className="font-body text-sm text-ink-600">No plans available for this network right now.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => setCategory(c.category)}
                  className={`rounded-full border px-3.5 py-1.5 font-body text-xs font-medium transition ${
                    category === c.category
                      ? 'border-gold-500 bg-gold-500/10 text-gold-700'
                      : 'border-parchment-line text-ink-600'
                  }`}
                >
                  {c.category}
                </button>
              ))}
            </div>
          )}
        </div>

        {category && (
          <div>
            <span className="mb-2 block font-body text-xs font-medium text-ink-600">Plan</span>
            {loadingPlans ? (
              <SkeletonRow />
            ) : (
              <div className="space-y-2">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlanId(p.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition ${
                      planId === p.id
                        ? 'border-gold-500 bg-gold-500/10'
                        : 'border-parchment-line bg-parchment'
                    }`}
                  >
                    <span>
                      <span className="block font-body text-sm font-medium text-ink">{p.name}</span>
                      <span className="block font-mono text-[11px] text-ink-600">{p.validity}</span>
                    </span>
                    <span className="font-mono text-sm font-semibold text-gold-700">
                      ₦{p.amount.toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-ember-500/10 px-3 py-2 font-body text-sm text-ember-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !phone || !planId}
          className="flex w-full items-center justify-center rounded-lg bg-gold-500 py-3 font-display text-sm font-semibold text-ink transition hover:bg-gold-400 disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />
          ) : selectedPlan ? (
            `Buy data — ₦${selectedPlan.amount.toLocaleString()}`
          ) : (
            'Select a plan'
          )}
        </button>
      </form>
    <PinConfirmDialog open={showPin} onClose={() => setShowPin(false)} onVerified={purchase} /></AppShell>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-parchment-line" />
      ))}
    </div>
  );
}
