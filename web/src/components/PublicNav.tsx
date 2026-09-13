import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../lib/auth';

const NAV_LINKS = [
  { to: '/partner-dashboard', label: 'API Portal', isRoute: true },
  { to: '#result-checkers', label: 'Results', isRoute: false },
  { to: '#how-it-works', label: 'How it works', isRoute: false },
  { to: '#download', label: 'Get the app', isRoute: false }
];

export default function PublicNav() {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink-line bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
        <Link to="/" className="min-w-0 shrink" onClick={() => setMobileOpen(false)}>
          <Logo dark />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) =>
            link.isRoute ? (
              <Link key={link.to} to={link.to} className="font-body text-sm text-gold-200 transition hover:text-cream">
                {link.label}
              </Link>
            ) : (
              <a key={link.to} href={link.to} className="font-body text-sm text-cream/70 transition hover:text-cream">
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {user ? (
            <Link
              to="/dashboard"
              className="rounded-lg bg-gold-500 px-3 py-2 font-display text-xs font-semibold text-ink transition hover:bg-gold-400 sm:px-4 sm:text-sm"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden font-body text-sm text-cream/80 transition hover:text-cream sm:block"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-gold-500 px-3 py-2 font-display text-xs font-semibold text-ink transition hover:bg-gold-400 sm:px-4 sm:text-sm"
              >
                Create Account
              </Link>
            </>
          )}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            className="rounded-lg p-2 text-cream md:hidden"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="border-t border-ink-line bg-ink px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) =>
              link.isRoute ? (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 font-body text-sm font-medium text-gold-200 hover:bg-ink-soft"
                >
                  {link.label}
                </Link>
              ) : (
                <a
                  key={link.to}
                  href={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 font-body text-sm font-medium text-cream/80 hover:bg-ink-soft"
                >
                  {link.label}
                </a>
              )
            )}
            {!user && (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 font-body text-sm font-medium text-cream/80 hover:bg-ink-soft sm:hidden"
              >
                Sign in
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
