import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ChevronDown, Fingerprint, IdCard, LayoutDashboard, LogOut, Menu, ReceiptText, Smartphone, WalletCards, Wifi, X } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../lib/auth';
import MajorAssistant from './MajorAssistant';
import NotificationPopup from './NotificationPopup';

type LinkItem = { label: string; to: string; icon: typeof LayoutDashboard };
const primary: LinkItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Fund Wallet', to: '/fund-wallet', icon: WalletCards },
];
const serviceGroups = [
  { label: 'VTU Services', icon: Wifi, items: [{ label: 'Buy Data', to: '/buy-data' }, { label: 'Buy Airtime', to: '/buy-airtime' }] },
  { label: 'NIN Services', icon: IdCard, items: [{ label: 'All NIN Services', to: '/nin-services' }, { label: 'NIN Verification', to: '/verification/nin/by-nin' }, { label: 'NIN Modification', to: '/verification/nin-validation' }] },
  { label: 'BVN Services', icon: Fingerprint, items: [{ label: 'All BVN Services', to: '/bvn-services' }, { label: 'BVN Verification', to: '/verification/bvn/slip' }, { label: 'BVN Retrieval', to: '/verification/bvn-retrieval' }] },
  { label: 'Result Checker', icon: ReceiptText, items: [{ label: 'WAEC', to: '/result-pins/waec' }, { label: 'NECO', to: '/result-pins/neco' }, { label: 'NABTEB', to: '/result-pins/nabteb' }] },
];
function Sidebar({ close }: { close?: () => void }) {
  const { logout } = useAuth(); const navigate = useNavigate(); const [open, setOpen] = useState<string | null>('VTU Services');
  const go = (to: string) => { close?.(); navigate(to); };
  return <aside className="flex h-full w-64 flex-col border-r border-slate-200 bg-white px-3 py-5 shadow-sm">
    <Link to="/dashboard" onClick={close} className="mb-8 px-3"><Logo /></Link>
    <nav className="flex-1 space-y-1">
      {primary.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={close} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-brand-700'}`}><Icon size={18} />{label}</NavLink>)}
      {serviceGroups.map(({ label, icon: Icon, items }) => <div key={label}><button onClick={() => setOpen(open === label ? null : label)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-brand-700"><Icon size={18} /><span className="flex-1 text-left">{label}</span><ChevronDown size={16} className={`transition-transform ${open === label ? 'rotate-180' : ''}`} /></button>{open === label && <div className="ml-6 border-l border-slate-200 py-1 pl-3">{items.map(item => <button key={item.to} onClick={() => go(item.to)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 hover:bg-brand-50 hover:text-brand-700">{item.label}</button>)}</div>}</div>)}
    </nav>
    <div className="border-t border-slate-100 pt-3"><button onClick={() => { logout(); close?.(); navigate('/login'); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"><LogOut size={18} />Logout</button></div>
  </aside>;
}
export default function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth(); const [mobileOpen, setMobileOpen] = useState(false);
  return <div className="min-h-screen bg-[#f5f7fb]"><div className="fixed inset-y-0 left-0 z-30 hidden lg:block"><Sidebar /></div><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur lg:ml-64"><div className="flex h-16 items-center justify-between px-5"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-brand-700 hover:bg-brand-50 lg:hidden"><Menu /></button><span className="hidden text-sm text-slate-500 sm:block">Welcome back, {user?.full_name?.split(' ')[0] ?? 'User'}</span><Link to="/dashboard" className="lg:hidden"><Logo /></Link><span className="flex items-center gap-2 text-sm font-medium text-slate-600"><Smartphone size={17} className="text-brand-600" /><span className="hidden sm:inline">Secure services</span></span></div></header>{mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-slate-950/35" /><div className="relative h-full"><button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 z-10 rounded-lg p-2 text-slate-600 hover:bg-slate-100"><X /></button><Sidebar close={() => setMobileOpen(false)} /></div></div>}<main className="px-5 py-7 lg:ml-64 lg:px-8">{children}</main><NotificationPopup /><MajorAssistant /></div>;
}
