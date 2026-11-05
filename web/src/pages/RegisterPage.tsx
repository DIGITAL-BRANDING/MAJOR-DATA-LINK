import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  Wallet,
  Wifi,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { CONTACT } from '../lib/contact';
import { Spinner } from './LoginPage';
import './LoginPage.css';
import './RegisterPage.css';

const REGISTER_FEATURES = [
  { label: 'Identity services in one place', icon: Fingerprint },
  { label: 'Wallet for everyday payments', icon: Wallet },
  { label: 'A simpler way to manage essentials', icon: Wifi },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        full_name: fullName,
        email,
        phone,
        password,
        referral_code: params.get('ref') || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page register-page">
      <section className="login-story" aria-label="About K-Tech Solutions">
        <div className="login-story-glow login-story-glow-one" />
        <div className="login-story-glow login-story-glow-two" />
        <div className="login-story-grid" />

        <div className="login-story-content">
          <Link to="/" className="login-brand" aria-label="K-Tech Solutions home">
            <Logo dark />
          </Link>

          <div className="login-story-copy">
            <span className="login-eyebrow"><Sparkles size={15} /> YOUR EVERYDAY SERVICES, SIMPLIFIED</span>
            <h1>Make room for simpler everyday services.</h1>
            <p>
              Create your account to manage your wallet, request identity services, and take care of essential payments in one place.
            </p>
          </div>

          <div className="login-feature-list">
            {REGISTER_FEATURES.map(({ label, icon: Icon }) => (
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
              <strong>Your details stay protected</strong>
              <span>Your account information is handled securely.</span>
            </div>
            <div className="login-trust-dots" aria-hidden="true"><i /><i /><i /></div>
          </div>
        </div>

        <footer className="login-story-footer">
          <span>© {new Date().getFullYear()} K-Tech Solutions</span>
          <a href={`mailto:${CONTACT.email}`}>Need help?</a>
        </footer>
      </section>

      <section className="login-form-side register-form-side">
        <div className="login-mobile-brand">
          <Link to="/" aria-label="K-Tech Solutions home"><Logo /></Link>
          <span className="login-mobile-secure"><ShieldCheck size={14} /> Secure registration</span>
        </div>

        <div className="login-form-wrap register-form-wrap">
          <Link to="/" className="login-back-link"><ArrowLeft size={16} /> Back to home</Link>

          <div className="login-heading">
            <span className="login-form-eyebrow">GET STARTED</span>
            <h2>Create your account</h2>
            <p>Set up your K-Tech account. It only takes a moment.</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form register-form">
            <RegisterField
              label="Full name"
              value={fullName}
              onChange={setFullName}
              icon={UserRound}
              autoComplete="name"
              autoFocus
            />
            <RegisterField
              label="Email address"
              value={email}
              onChange={setEmail}
              icon={Mail}
              type="email"
              autoComplete="email"
            />
            <RegisterField
              label="Phone number"
              value={phone}
              onChange={setPhone}
              icon={Phone}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
            />
            <RegisterField
              label="Password"
              value={password}
              onChange={setPassword}
              icon={LockKeyhole}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              hint="Use at least 8 characters."
              trailing={(
                <button
                  type="button"
                  className="login-input-action"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              )}
            />

            {params.get('ref') && (
              <div className="register-referral-note">
                <Check size={15} /> Referral code applied to your signup.
              </div>
            )}

            {error && <p className="login-error" role="alert">{error}</p>}

            <button
              type="submit"
              className="login-submit"
              disabled={isLoading || !fullName.trim() || !email.trim() || !phone.trim() || !password}
            >
              {isLoading ? <Spinner /> : <>Create account <ArrowRight size={17} /></>}
            </button>
          </form>

          <div className="login-divider"><span>your account, one place</span></div>
          <div className="login-security-note"><LockKeyhole size={15} /> Your information is encrypted and securely handled.</div>

          <p className="login-signup-prompt register-login-prompt">
            Already have an account? <Link to="/login">Sign in <ArrowRight size={14} /></Link>
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

function RegisterField({
  label,
  value,
  onChange,
  icon: Icon,
  type = 'text',
  autoFocus,
  autoComplete,
  inputMode,
  hint,
  trailing,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: typeof UserRound;
  type?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: 'tel' | 'email' | 'text';
  hint?: string;
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
          autoComplete={autoComplete}
          inputMode={inputMode}
          required
          aria-label={label}
          minLength={type === 'password' ? 8 : undefined}
        />
        {trailing}
      </span>
      {hint && <span className="register-field-hint">{hint}</span>}
    </label>
  );
}
