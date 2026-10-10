import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { OPEN_LIVECHAT_EVENT } from '../lib/live-chat-events';
import LiveChatWidget from './LiveChatWidget';
import './GuestChatWidget.css';

const STORAGE_KEY = 'mdl_guest_chat';

type GuestSession = { token: string; guestId: string; displayName: string };

function readSession(): GuestSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuestSession) : null;
  } catch {
    return null;
  }
}

/**
 * Live chat for visitors who are not signed in. The first time, the visitor
 * gives a name and an email or phone so the team can follow up. After that the
 * chat session is remembered on this device and opens straight away.
 */
export default function GuestChatWidget() {
  const { pathname } = useLocation();
  const [session, setSession] = useState<GuestSession | null>(readSession);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const open = () => setFormOpen(true);
    window.addEventListener(OPEN_LIVECHAT_EVENT, open);
    return () => window.removeEventListener(OPEN_LIVECHAT_EVENT, open);
  }, []);

  // Partner pages have their own live chat with their own token.
  if (pathname.startsWith('/partner')) return null;

  if (session) {
    return (
      <LiveChatWidget
        active
        token={session.token}
        ownerKey={session.guestId}
        headerLabel="K-Tech Live Chat"
        pushEnabled={false}
      />
    );
  }

  async function start(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await api.post<{ data: { guest_token: string; guest_id: string; display_name: string } }>(
        '/chat/guest/session',
        { name: name.trim(), contact: contact.trim() },
        false,
      );
      const next: GuestSession = {
        token: result.data.guest_token,
        guestId: result.data.guest_id,
        displayName: result.data.display_name,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the chat. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="gc-launcher" aria-label="Open live chat" onClick={() => setFormOpen(true)}>
        <MessageCircle size={22} aria-hidden="true" />
      </button>
      {formOpen && (
        <div className="gc-panel" role="dialog" aria-label="Start a live chat">
          <div className="gc-head">
            <p>Chat with K-Tech support</p>
            <button type="button" aria-label="Close" onClick={() => setFormOpen(false)}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <form className="gc-form" onSubmit={start}>
            <label>
              Your name
              <input required minLength={2} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email or phone
              <input
                required
                maxLength={120}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="So our team can follow up"
              />
            </label>
            <p className="gc-note">We only use these details to follow up on your chat.</p>
            {error && <p className="gc-error" role="alert">{error}</p>}
            <button type="submit" className="gc-submit" disabled={busy}>
              {busy ? 'Starting…' : 'Start chat'}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
