import React, { useEffect, useRef, useState } from 'react';
import { Box, Text } from '@adminjs/design-system';
import { io } from 'socket.io-client';

const ADMIN_ROOT_PATH = '/admin';

/**
 * Same two-tone chime as admin/live-chat.ts's playIncomingChime(), kept as a
 * separate copy rather than a shared import: that file is a
 * server-rendered plain HTML page with its own inline <script> (a
 * completely different runtime from this AdminJS React bundle), so there is
 * nothing to actually share it with - see the file-level comment below for
 * the fuller reasoning.
 */
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [0, 0.15].forEach((offset, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = index === 0 ? 740 : 988;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now + offset);
    oscillator.stop(now + offset + 0.14);
  });
}

// Title flash is module-level (not per-mount state) for the same reason as
// admin/live-chat.ts's copy and web/src/lib/support-notify.ts on the
// customer side: a single shared "the tab title is lying to get your
// attention" flag, not one per component instance.
const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : '';
let titleFlashTimer: number | undefined;
let titleFlashOn = false;
function startTitleFlash() {
  if (titleFlashTimer !== undefined) return;
  titleFlashTimer = window.setInterval(() => {
    titleFlashOn = !titleFlashOn;
    document.title = titleFlashOn ? `🔴 New message — ${ORIGINAL_TITLE}` : ORIGINAL_TITLE;
  }, 1200);
}
function stopTitleFlash() {
  if (titleFlashTimer !== undefined) {
    window.clearInterval(titleFlashTimer);
    titleFlashTimer = undefined;
  }
  document.title = ORIGINAL_TITLE;
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) stopTitleFlash();
  });
  window.addEventListener('focus', stopTitleFlash);
}

type QueueRow = { unread_by_admin?: number };

/**
 * Rings, alerts and shows a dismissible pill for a new (or newly-unread)
 * customer/partner chat, on every AdminJS page - not only
 * /admin/live-chat, which an admin might well not have open while working a
 * different queue. Mounted once via the TopBar override (see
 * topbar-with-chat-alert.tsx), which AdminJS renders outside the
 * page-specific routes, so it survives navigation between resources
 * instead of being torn down and reconnecting a socket on every click.
 *
 * Deliberately its own Socket.IO connection rather than something shared
 * with admin/live-chat.ts: that page is a separate, non-React,
 * server-rendered document (its own <script> tag, not part of this bundle),
 * so there is no connection or module to actually share even if we wanted
 * to - and the two are never open in the same tab at once, so there is no
 * risk of the same message alerting twice.
 *
 * Uses the aggregate 'chat:queue' event (broadcast to every connected admin
 * whenever ANY conversation's unread count changes - see chat-socket.ts)
 * rather than 'chat:message': the server only delivers 'chat:message' to
 * sockets that joined that specific conversation's room, so it can never
 * tell this component about a customer it hasn't opened yet. 'chat:queue'
 * is the one signal that actually reaches every admin regardless of what
 * they're looking at.
 */
export default function GlobalChatAlert() {
  const [pill, setPill] = useState<{ count: number } | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const lastTotal = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioUnlocked = useRef(false);

  // Web Audio requires a user gesture before it can produce sound - unlock
  // it on the first click/keypress anywhere in the admin panel, same
  // approach as admin/live-chat.ts, so the very first alert of the session
  // isn't silently swallowed just because the admin hasn't touched the
  // chat page specifically.
  useEffect(() => {
    function unlock() {
      if (audioUnlocked.current) return;
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      audioCtx.current = new Ctor();
      audioUnlocked.current = true;
    }
    document.addEventListener('pointerdown', unlock, { once: true, passive: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const socket = io({ withCredentials: true });

    socket.on('chat:queue', (rows: QueueRow[]) => {
      const total = rows.reduce((sum, row) => sum + (row.unread_by_admin ?? 0), 0);
      if (lastTotal.current !== null && total > lastTotal.current) {
        setPill({ count: total });
        if (document.hidden) startTitleFlash();
        if (audioCtx.current && audioCtx.current.state === 'running') playChime(audioCtx.current);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          try {
            const n = new Notification('New support message', {
              body: total === 1 ? 'A customer sent a new message.' : `${total} conversations are waiting for a reply.`,
              tag: 'live-chat-alert'
            });
            n.onclick = () => {
              window.focus();
              window.location.href = `${ADMIN_ROOT_PATH}/live-chat`;
            };
          } catch {
            // Some browsers can still throw even when permission reads
            // "granted" (focus/user-activation quirks) - the title flash
            // and pill below still carry the alert either way.
          }
        }
      } else if (total === 0) {
        setPill(null);
      }
      lastTotal.current = total;
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (pill) {
    return (
      <Box
        style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 2100, width: 280, cursor: 'pointer' }}
        variant="white"
        boxShadow="card"
        p="lg"
        onClick={() => {
          window.location.href = `${ADMIN_ROOT_PATH}/live-chat`;
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Text fontWeight="bold">
            {pill.count} unread chat{pill.count === 1 ? '' : 's'}
          </Text>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPill(null);
            }}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </Box>
        <Text fontSize="sm" mt="default">
          Click to open Live Chat
        </Text>
      </Box>
    );
  }

  // No unread message right now, but the admin has never granted (or
  // denied) desktop-alert permission - offer it here too, not only on
  // /admin/live-chat, so they can opt in from wherever they land first.
  // Dismissible per session (not persisted) rather than gone forever: a
  // "maybe later" click shouldn't quietly disable the offer on every future
  // login.
  if (notifPermission === 'default' && !dismissedPrompt) {
    return (
      <Box style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 2100, width: 260 }} variant="white" boxShadow="card" p="default">
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Text fontSize="sm" fontWeight="bold">
            Enable chat alerts?
          </Text>
          <button
            type="button"
            onClick={() => setDismissedPrompt(true)}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </Box>
        <Text fontSize="sm" mt="default" mb="default">
          Get a desktop notification when a customer sends a support message, even from other admin pages.
        </Text>
        <button
          type="button"
          onClick={() => Notification.requestPermission().then((p) => setNotifPermission(p))}
          style={{ width: '100%', border: 'none', borderRadius: 6, background: '#2563eb', color: '#fff', fontWeight: 700, padding: '8px 0', cursor: 'pointer' }}
        >
          Enable alerts
        </button>
      </Box>
    );
  }

  return null;
}
