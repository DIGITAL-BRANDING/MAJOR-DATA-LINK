import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE } from '../lib/api';
import { enableChatNotificationSound, playChatNotificationSound } from '../lib/chat-notification-sound';

type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_type: 'USER' | 'ADMIN';
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
};

type LiveChatWidgetProps = {
  /** Not rendered at all when false - lets each caller gate on its own auth state. */
  active: boolean;
  /** The signed-in owner's access token (customer OR partner - whichever this instance is for). */
  token: string | null;
  /** Changing this (e.g. a customer id or partner id) forces a fresh socket connection. */
  ownerKey: string;
  headerLabel?: string;
};

/**
 * K-Tech Live Chat - self-hosted replacement for the old Tawk.to widget.
 * Talks directly to the Socket.IO server attached in
 * major_data_link_backend/src/realtime/chat-socket.ts - no third-party
 * chat service involved. This component is deliberately auth-agnostic
 * (just takes a bare token): src/components/ChatWidget.tsx supplies the
 * customer's `mdl_access_token`, and PartnerDashboardPage supplies the
 * partner portal's own separate `mdl_partner_portal_access_token`. The
 * backend resolves which table the token belongs to itself (see
 * resolveOwnerToken() in chat-socket.ts).
 */
export default function LiveChatWidget({ active, token, ownerKey, headerLabel }: LiveChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationStatus, setConversationStatus] = useState<'OPEN' | 'CLOSED'>('OPEN');
  const [draft, setDraft] = useState('');
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => enableChatNotificationSound(), []);

  useEffect(() => {
    if (!active || !token) return;

    const socket = io(API_BASE || undefined, {
      path: '/socket.io',
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:history', (data: { conversation_id: string; status: 'OPEN' | 'CLOSED'; messages: ChatMessage[] }) => {
      setMessages(data.messages);
      setConversationStatus(data.status);
    });

    socket.on('chat:message', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      if (message.sender_type === 'ADMIN') {
        // This is an incoming reply, never the user's own echoed message.
        // The chime is intentionally allowed while the panel is open too so
        // a customer notices a support reply while reading another tab.
        playChatNotificationSound();
        setUnread((prev) => (openRef.current ? prev : prev + 1));
      }
    });

    socket.on('chat:closed', () => setConversationStatus('CLOSED'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // Re-run only when the signed-in owner or token changes - `open` is
    // read via a functional update above so it doesn't need to be a
    // dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, token, ownerKey]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [open, messages]);

  if (!active || !token) return null;

  function send() {
    const body = draft.trim();
    if (!body || !socketRef.current) return;
    socketRef.current.emit('chat:send', { body });
    setDraft('');
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[480px] w-[340px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-parchment-line bg-cream shadow-2xl">
          <div className="flex items-center justify-between bg-gold-500 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-ink">{headerLabel ?? 'K-Tech Live Chat'}</p>
              <p className="text-[11px] text-ink-soft">{connected ? 'Support is online' : 'Connecting…'}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-ink hover:bg-gold-600/30"
              aria-label="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-xs text-ink-soft">
                Send us a message and a K-Tech Solutions support agent will reply here.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_type === 'USER' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-[13px] leading-snug ${
                    m.sender_type === 'USER' ? 'bg-gold-500 text-ink' : 'border border-parchment-line bg-white text-ink'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-parchment-line bg-white p-2">
            {conversationStatus === 'CLOSED' ? (
              <p className="px-2 py-2 text-center text-[12px] text-ink-soft">
                This conversation was closed. Send a new message to start another.
              </p>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-center gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                maxLength={4000}
                className="flex-1 rounded-full border border-parchment-line bg-cream px-3 py-2 text-[13px] outline-none focus:border-gold-500"
              />
              <button
                type="submit"
                disabled={!draft.trim() || !connected}
                className="rounded-full bg-gold-600 p-2 text-white disabled:opacity-40"
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 text-ink shadow-xl hover:bg-gold-400"
        aria-label="Open live chat"
      >
        <MessageCircle size={24} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ember-500 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
