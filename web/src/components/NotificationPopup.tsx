import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { api } from '../lib/api';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type?: string;
  is_read?: boolean;
  broadcast_id?: string | null;
  show_as_popup?: boolean;
  created_at?: string;
};

/**
 * Mounted only on DashboardPage - not in AppShell - so it's evaluated once
 * per dashboard visit (right after login, or whenever the user taps
 * "Dashboard" in the sidebar), instead of remounting fresh on every single
 * page navigation the way it did while living in AppShell. That remounting
 * was the actual cause of a dismissed broadcast reappearing on every page:
 * each page is its own <AppShell> instance, so this component's local
 * state reset on every navigation no matter what it tracked client-side.
 *
 * Eligibility for the popup is just `show_as_popup && !is_read` - an admin
 * opts a broadcast into popup treatment when sending it (see
 * notification-broadcast.resource.ts's showAsPopup field), and dismissing
 * marks that one notification read on the server (see the '/read' call in
 * close() below). Because each recipient gets their own independent
 * Notification row per broadcast (fanOutBroadcast in
 * notification.service.ts), that "read" persists across devices, browser
 * refreshes and future logins - the popup simply never has anything left
 * to show for it again, and it already sits in the NotificationBell
 * dropdown ("notification tab") like any other notification. Sending a
 * newer broadcast creates a fresh, unread row, which naturally becomes the
 * next thing this picks up.
 */
export default function NotificationPopup() {
  const [notice, setNotice] = useState<NotificationItem | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const load = () => {
      api
        .get<{ data?: NotificationItem[] }>('/notifications?limit=20')
        .then((response) => {
          if (!active) return;
          const items = response.data ?? [];
          const next = items.find((item) => item.show_as_popup && !item.is_read && !hiddenIds.includes(item.id));
          setNotice(next ?? null);
        })
        .catch(() => {
          // Notifications are optional; never block access to the services.
        });
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [hiddenIds]);

  const close = async () => {
    if (!notice) return;
    const id = notice.id;
    setNotice(null);
    setHiddenIds((ids) => [...ids, id]);
    try { await api.post('/notifications/read', { ids: [id] }); } catch { /* best effort - it'll be marked read next time it's fetched and re-dismissed */ }
  };

  if (!notice) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="notification-title">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-brand-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-700 px-5 py-4 text-white">
          <div className="flex items-center gap-3"><span className="rounded-full bg-white/15 p-2"><Bell size={20} /></span><h2 id="notification-title" className="text-base font-bold">{notice.title}</h2></div>
          <button onClick={close} aria-label="Close notification" className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white"><X size={19} /></button>
        </div>
        <div className="px-5 py-6"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{notice.body}</p></div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4"><button onClick={close} className="rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-200">OK / Continue</button></div>
      </div>
    </div>
  );
}
