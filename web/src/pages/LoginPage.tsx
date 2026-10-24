import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  Wifi,
  Zap,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { CONTACT } from '../lib/contact';
import './LoginPage.css';

const FEATURES = [
  { label: 'Identity verification', icon: Fingerprint },
  { label: 'Data & airtime', icon: Wifi },
  { label: 'Instant bill payments', icon: Zap },
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
    <main className="login-page">
      <section className="login-story" aria-label="K-Tech services">
        <div className="login-story-glow login-story-glow-one" />
        <div className="login-story-glow login-story-glow-two" />
        <div className="login-story-grid" />

        <div className="login-story-content">
          <Link to="/" className="login-brand" aria-label="K-Tech Solutions home">
            <Logo dark />
          </Link>

          <div className="login-story-copy">
            <span className="login-eyebrow"><Sparkles size={15} /> YOUR EVERYDAY SERVICES, SIMPLIFIED</span>
            <h1>One secure place to keep life moving.</h1>
            <p>
              Verify identities, manage your wallet, and take care of essential services with a platform built around you.
            </p>
          </div>

          <div className="login-feature-list">
            {FEATURES.map(({ label, icon: Icon }) => (
              <div className="login-feature" key={label}>
                <span className="login-feature-icon"><Icon size={18} /></span>
                <span>{label}</span>
                <Check size={16} className="login-feature-check" />
              </div>
            ))}
          </div>

          <div className="login-trust-card">
            <div className="login-trust-icon"><ShieldCheck size={22} /></div>
            <div>
              <strong>Your account, protected</strong>
              <span>Secure sign-in with an extra PIN check when needed.</span>
            </div>
            <div className="login-trust-dots" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>

        <footer className="login-story-footer">
          <span>© {new Date().getFullYear()} K-Tech Solutions</span>
          <a href={`mailto:${CONTACT.email}`}>Need help?</a>
        </footer>
      </section>

      <section className="login-form-side">
        <div className="login-mobile-brand">
          <Link to="/" aria-label="K-Tech Solutions home"><Logo /></Link>
          <span className="login-mobile-secure"><ShieldCheck size={14} /> Secure sign-in</span>
        </div>

        <div className="login-form-wrap">
          <Link to="/" className="login-back-link"><ArrowLeft size={16} /> Back to home</Link>

          <div className="login-heading">
            <span className="login-form-eyebrow">{needsPin ? 'ACCOUNT SECURITY' : 'WELCOME BACK'}</span>
            <h2>{needsPin ? 'Confirm it’s you' : 'Sign in to your account'}</h2>
            <p>
              {needsPin
                ? 'Enter the 6-digit login PIN for this device to continue securely.'
                : 'Access your wallet and services by entering your account details.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {!needsPin ? (
              <>
                <LoginField
                  label="Email address or phone number"
                  value={identifier}
                  onChange={setIdentifier}
                  icon={UserRound}
                  autoComplete="username"
                  autoFocus
                />
                <LoginField
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  icon={LockKeyhole}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  trailing={(
                    <button
                      type="button"
                      className="login-input-action"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  )}
                />
              </>
            ) : (
              <LoginField
                label="6-digit login PIN"
                value={pin}
                onChange={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))}
                icon={LockKeyhole}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              />
            )}

            {error && <p className="login-error" role="alert">{error}</p>}

            {!needsPin && (
              <div className="login-options">
                <label className="login-remember">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span className="login-checkbox"><Check size={12} /></span>
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password">Forgot password?</Link>
              </div>
            )}

            <button
              type="submit"
              className="login-submit"
              disabled={isLoading || (needsPin ? pin.length !== 6 : !identifier || !password)}
            >
              {isLoading ? <Spinner /> : <>{needsPin ? 'Verify and sign in' : 'Sign in'} <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="login-divider"><span>protected access</span></div>
          <div className="login-security-note"><LockKeyhole size={15} /> Your sign-in details are encrypted and securely handled.</div>

          <p className="login-signup-prompt">
            New to K-Tech? <Link to="/register">Create an account <ArrowRight size={14} /></Link>
          </p>
        </div>

        <footer className="login-mobile-footer">
          <a href={`mailto:${CONTACT.email}`}><Mail size={14} /> Support</a>
          <a href={`https://wa.me/${CONTACT.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"><Smartphone size={14} /> WhatsApp</a>
        </footer>
      </section>
    </main>
  );
}

function LoginField({
  label,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  autoFocus,
  inputMode,
  autoComplete,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: typeof UserRound;
  type?: string;
  autoFocus?: boolean;
  inputMode?: 'numeric' | 'text';
  autoComplete?: string;
  trailing?: ReactNode;
}) {
  return (
    <label className="login-field">
      <span className="login-field-label">{label}</span>
      <span className="login-input-wrap">
        <Icon size={17} className="login-input-icon" aria-hidden="true" />
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus={autoFocus}
          inputMode={inputMode}
          autoComplete={autoComplete}
          required
          aria-label={label}
        />
        {trailing}
      </span>
    </label>
  );
}

export function Spinner() {
  return <span className="login-spinner" role="status" aria-label="Signing in" />;
}
