import { type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../lib/auth';

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link to="/dashboard">
            <Logo />
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden font-body text-sm text-ink-600 sm:inline">
              {user?.full_name}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-parchment-line px-3 py-1.5 font-body text-xs font-medium text-ink-600 transition hover:border-ember-500 hover:text-ember-600"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
