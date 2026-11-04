import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import PromoIllustrationBadge, { isPromoIllustrationKey } from './PromoIllustration';
import NotificationMessage from './NotificationMessage';
import { X } from 'lucide-react';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type?: string;
  is_read?: boolean;
  broadcast_id?: string | null;
  is_persistent_broadcast?: boolean;
  show_as_popup?: boolean;
  image_key?: string | null;
  created_at?: string;
};

/**
 * Mounted only on DashboardPage - not in AppShell - so it's evaluated once
 * per dashboard visit (right after login, or whenever the user taps
 * "Dashboard" in the sidebar), instead of remounting fresh on every single
 * page navigation the way it did while living in AppShell. That remounting
 * was the actual cause of a dismissed broadcast reappearing on every OTHER
 * page too, which is the part that needed fixing - reappearing specifically
 * on login, on returning to the dashboard, and on refreshing it is the
 * intended behaviour, by design (see below), not a bug.
 *
 * Eligibility is the single newest admin broadcast. It stays the active
 * popup, reappearing on every fresh mount of
 * this component (login, dashboard visit, dashboard refresh) REGARDLESS of
 * is_read or whether it was dismissed on a previous visit - dismissing only
 * hides it for the rest of THIS mount (so it doesn't immediately pop back
 * up from the 30s poll below while they're still looking at the page), via
 * local hiddenIds state that resets on the next mount. It stops being the
 * active announcement only when an admin sends a further broadcast, at which
 * point that
 * one takes over here and this one is left sitting in the NotificationBell
 * dropdown ("notification tab") - which shows every notification
 * regardless of is_read, so it's still visible there. Nothing is ever
 * marked read on dismiss; see notification.routes.ts's '/read' route,
 * which deliberately excludes broadcastId rows for the same reason.
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
          const broadcasts = items
            .filter((item) => Boolean(item.broadcast_id || item.is_persistent_broadcast))
            .sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''));
          const newestBroadcast = broadcasts[0];

          // Never fall through from a dismissed/latest broadcast to an older
          // one. Older broadcasts stay in the notification list, but are not
          // allowed to create a sequence of stale popups.
          const next = newestBroadcast
            ? (hiddenIds.includes(newestBroadcast.id) ? undefined : newestBroadcast)
            : items.find((item) => item.show_as_popup && !hiddenIds.includes(item.id));
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

  const close = () => {
    if (!notice) return;
    setHiddenIds((ids) => [...ids, notice.id]);
    setNotice(null);
  };

  if (!notice) return null;
  const illustration = isPromoIllustrationKey(notice.image_key) ? notice.image_key : null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center p-3 sm:justify-end sm:p-5" role="presentation">
      <section className="pointer-events-auto flex max-h-[min(82dvh,46rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="false" aria-labelledby="notification-title">
        <header className="flex shrink-0 items-start gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          {illustration && <div className="shrink-0"><PromoIllustrationBadge illustration={illustration} /></div>}
          <h2 id="notification-title" className="min-w-0 flex-1 pt-1 text-left text-lg font-extrabold leading-6 text-slate-900">{notice.title}</h2>
          <button type="button" onClick={close} aria-label="Close notification" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400">
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 sm:px-6"><NotificationMessage body={notice.body} /></div>
        <footer className="shrink-0 border-t border-slate-100 px-5 py-3 sm:px-6">
          <button type="button" onClick={close} className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-bold text-white shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#F7C948] sm:w-auto sm:min-w-32">
            Okay
          </button>
        </footer>
      </section>
    </div>
  );
}
