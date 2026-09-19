import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Fingerprint, Lock, ShieldCheck, User, Wifi, Zap } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { CONTACT } from '../lib/contact';

const BADGES = [
  { label: 'NIN Verification', icon: Fingerprint },
  { label: 'BVN Verification', icon: ShieldCheck },
  { label: 'Data & Airtime', icon: Wifi },
  { label: 'Bill Payments', icon: Zap },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [needsPin, setNeedsPin] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(identifier, password, needsPin ? pin : undefined, remember);
      navigate('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LOGIN_PIN_REQUIRED') {
        setNeedsPin(true);
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Promo panel — hidden below lg, this is a login SCREEN not a landing
          page, so on mobile the form alone is the whole job. */}
      <div className="relative hidden w-[44%] shrink-0 overflow-hidden bg-ink lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #d4af37, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, #ff6b35, transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#d4af37 1px, transparent 1px), linear-gradient(90deg, #d4af37 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col px-10 pt-10">
          <Logo dark />

          <div className="mt-16 max-w-sm">
            <p className="font-body text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              Verify once, top up always
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-cream">
              One wallet for every NIN, BVN, and VTU need.
            </h1>
            <p className="mt-4 font-body text-sm leading-relaxed text-cream/70">
              Sign in to fund your wallet, verify identities in minutes, and keep every data, airtime, and
              bill payment moving from one place.
            </p>
          </div>

          <div className="mt-10 flex max-w-sm flex-wrap gap-2.5">
            {BADGES.map((badge) => (
              <span
                key={badge.label}
                className="flex items-center gap-1.5 rounded-full border border-gold-500/30 bg-cream/5 px-3 py-1.5 font-body text-xs font-medium text-gold-200"
              >
                <badge.icon size={13} className="text-gold-400" />
                {badge.label}
              </span>
            ))}
          </div>

          <IdCardIllustration className="mt-auto w-full max-w-xs self-center pb-6 pt-10" />
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-cream/10 bg-black/20 px-10 py-4 font-body text-xs text-cream/60">
          <span>ktechsolutions.com.ng</span>
          <span>{CONTACT.email}</span>
          <span>{CONTACT.whatsapp}</span>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </Link>

          <h1 className="font-display text-2xl font-bold text-ink">
            {needsPin ? 'Enter your login PIN' : 'Sign In'}
          </h1>
          <p className="mt-1 font-body text-sm text-ink-600">
            {needsPin
              ? 'This account has a 6-digit PIN set for extra security.'
              : "Welcome back! Let's keep your wallet moving."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {!needsPin ? (
              <>
                <IconField
                  label="Email or phone number"
                  value={identifier}
                  onChange={setIdentifier}
                  icon={User}
                  type="text"
                  autoFocus
                />
                <IconField
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  icon={Lock}
                  type={showPassword ? 'text' : 'password'}
                  toggle={{ isVisible: showPassword, onToggle: () => setShowPassword((v) => !v) }}
                />
              </>
            ) : (
              <IconField
                label="6-digit login PIN"
                value={pin}
                onChange={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
                icon={Lock}
                type="password"
                inputMode="numeric"
                autoFocus
              />
            )}

            {error && (
              <p className="rounded-lg bg-ember-500/10 px-3 py-2 font-body text-sm text-ember-600">{error}</p>
            )}

            {!needsPin && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={remember}
                  onClick={() => setRemember((v) => !v)}
                  className="flex items-center gap-2.5"
                >
                  <span
                    className={`relative h-5 w-9 rounded-full transition ${remember ? 'bg-gold-500' : 'bg-ink-line'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-cream transition-transform ${
                        remember ? 'translate-x-4' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                  <span className="font-body text-sm text-ink-600">Remember me</span>
                </button>
                <Link to="/forgot-password" className="font-body text-sm font-medium text-gold-600 hover:text-gold-700">
                  Forgot Password?
                </Link>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || (needsPin ? pin.length !== 6 : !identifier || !password)}
              className="flex w-full items-center justify-center rounded-lg bg-gold-500 py-3 font-display text-sm font-semibold text-ink transition hover:bg-gold-400 disabled:opacity-50"
            >
              {isLoading ? <Spinner /> : needsPin ? 'Verify & sign in' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center font-body text-sm text-ink-600">
            Don't have an account yet?{' '}
            <Link to="/register" className="font-semibold text-gold-600 hover:text-gold-700">
              Sign up here
            </Link>
          </p>
          <Link
            to="/"
            className="mt-4 flex justify-center font-body text-sm font-medium text-gold-600 transition hover:text-gold-700"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function IconField({
  label,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  autoFocus,
  inputMode,
  toggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: typeof User;
  type?: string;
  autoFocus?: boolean;
  inputMode?: 'numeric' | 'text';
  toggle?: { isVisible: boolean; onToggle: () => void };
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-body text-xs font-medium text-ink-600">{label}</span>
      <div className="relative">
        <Icon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600/60" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          inputMode={inputMode}
          required
          className={`w-full rounded-lg border border-parchment-line bg-parchment px-3.5 py-2.5 pl-10 font-body text-sm text-ink outline-none focus:border-gold-500${
            toggle ? ' pr-11' : ''
          }`}
        />
        {toggle && (
          <button
            type="button"
            onClick={toggle.onToggle}
            aria-label={toggle.isVisible ? 'Hide password' : 'Show password'}
            aria-pressed={toggle.isVisible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-xs font-medium text-ink-600 transition hover:text-ink focus:outline-none focus:ring-2 focus:ring-gold-500"
          >
            {toggle.isVisible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
    </label>
  );
}

/** Stylized ID-card-with-checkmark artwork, built as plain SVG (no stock
 *  photo available) so the promo panel has a concrete visual anchor instead
 *  of empty space. */
function IdCardIllustration({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="20" width="240" height="150" rx="14" fill="#221a10" stroke="#d4af37" strokeWidth="1.5" />
      <rect x="30" y="20" width="240" height="34" rx="14" fill="#d4af37" fillOpacity="0.12" />
      <circle cx="54" cy="37" r="6" fill="#d4af37" />
      <rect x="70" y="32" width="70" height="5" rx="2.5" fill="#d4af37" fillOpacity="0.7" />
      <rect x="70" y="42" width="46" height="4" rx="2" fill="#fffaf0" fillOpacity="0.3" />

      <rect x="46" y="70" width="58" height="70" rx="8" fill="#d4af37" fillOpacity="0.14" stroke="#d4af37" strokeWidth="1" />
      <circle cx="75" cy="95" r="12" fill="#d4af37" fillOpacity="0.4" />
      <path d="M58 128c3-11 12-17 17-17s14 6 17 17" stroke="#d4af37" strokeWidth="1.4" fill="none" />

      <rect x="118" y="76" width="120" height="6" rx="3" fill="#fffaf0" fillOpacity="0.35" />
      <rect x="118" y="92" width="90" height="5" rx="2.5" fill="#fffaf0" fillOpacity="0.22" />
      <rect x="118" y="106" width="100" height="5" rx="2.5" fill="#fffaf0" fillOpacity="0.22" />
      <rect x="118" y="120" width="70" height="5" rx="2.5" fill="#fffaf0" fillOpacity="0.22" />

      <rect x="46" y="146" width="90" height="12" rx="3" fill="#d4af37" fillOpacity="0.18" />

      <circle cx="278" cy="132" r="34" fill="#15100a" stroke="#d4af37" strokeWidth="2" />
      <path d="M263 132l10 10 20-22" stroke="#d4af37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Spinner() {
  return <div className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />;
}
