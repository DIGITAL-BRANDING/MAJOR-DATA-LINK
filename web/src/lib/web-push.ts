import { API_BASE } from './api';

/**
 * Browser Web Push for live-chat replies - what makes the alert reach a
 * person whose browser/tab is closed. The page registers /sw.js, subscribes
 * through the browser's push service, and hands the subscription to the
 * backend (routes/web-push.routes.ts); the backend pushes to it when an admin
 * replies, and the service worker shows the notification.
 *
 * Everything here fails soft: unsupported browser, permission denied, push not
 * configured on the server -> returns false and the widget's in-page alerts
 * (chime, title flash, Notification API) carry on exactly as before.
 */

let active = false;

/** True once this browser is subscribed and the server knows about it. */
export function isWebPushActive() {
  return active;
}

export function isWebPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  );
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array) {
  if (!a || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((byte, i) => byte === b[i]);
}

async function fetchPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/web-push/public-key`);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { enabled?: boolean; public_key?: string | null } };
    return json.data?.enabled && json.data.public_key ? json.data.public_key : null;
  } catch {
    return null;
  }
}

/**
 * Makes sure this browser is subscribed for `token`'s owner (customer or
 * partner - the backend works out which). `prompt` allows showing the browser's
 * permission dialog; pass true only from a click, since browsers (Safari
 * especially) ignore or penalise permission prompts that aren't user-initiated.
 * With prompt=false it only re-syncs an already-granted subscription.
 */
export async function syncWebPush(token: string, { prompt }: { prompt: boolean }): Promise<boolean> {
  try {
    if (!isWebPushSupported() || !token) return false;
    if (Notification.permission === 'denied') return false;
    if (Notification.permission === 'default') {
      if (!prompt) return false;
      const result = await Notification.requestPermission();
      if (result !== 'granted') return false;
    }

    const publicKey = await fetchPublicKey();
    if (!publicKey) return false;
    const serverKey = base64UrlToBytes(publicKey);

    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    // A subscription made under a different (rotated) VAPID key can never
    // receive our pushes - drop it and subscribe afresh.
    if (subscription && !sameKey(subscription.options.applicationServerKey, serverKey)) {
      await subscription.unsubscribe();
      subscription = null;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: serverKey
      });
    }

    const res = await fetch(`${API_BASE}/api/web-push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    active = res.ok;
    return res.ok;
  } catch {
    return false;
  }
}

/** Call on logout so a signed-out browser stops getting that account's alerts. */
export async function removeWebPushSubscription() {
  active = false;
  try {
    if (!isWebPushSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch(`${API_BASE}/api/web-push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
      keepalive: true
    });
  } catch {
    // Best effort - the backend also drops dead subscriptions on its own.
  }
}
