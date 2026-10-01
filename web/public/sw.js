/* K-Tech service worker - exists for one job: show a live-chat reply as an
 * OS notification when the site is NOT open in front of the person (tab in
 * the background, browser minimised, or closed entirely). It deliberately
 * does no caching and no fetch interception, so it can never serve a stale
 * page or break the site. Served with Cache-Control: no-cache (see app.ts). */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'K-Tech Support';
  const options = {
    body: data.body || 'You have a new message from support.',
    icon: '/branding/favicon.png',
    badge: '/branding/favicon.png',
    // Same tag => a newer reply replaces the previous one instead of stacking.
    tag: data.tag || 'support-chat-alert',
    renotify: true,
    data: { url: data.url || '/dashboard?livechat=1' }
  };

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // If the person is looking at the site right now, the open page already
      // plays its chime and shows the message live - a second OS popup on top
      // would just be noise. Anything else (other tab, other app, closed)
      // gets the notification.
      const lookingAtSite = windows.some((c) => c.visibilityState === 'visible' && c.focused);
      if (lookingAtSite) return;
      await self.registration.showNotification(title, options);
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/dashboard?livechat=1', self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const samePage = windows.find((c) => {
        try {
          return new URL(c.url).pathname === target.pathname;
        } catch (_e) {
          return false;
        }
      });
      if (samePage) {
        await samePage.focus();
        samePage.postMessage({ type: 'mdl:open-livechat' });
        return;
      }
      await self.clients.openWindow(target.href);
    })()
  );
});
