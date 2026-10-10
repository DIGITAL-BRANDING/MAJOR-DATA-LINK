import { getAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import LiveChatWidget from './LiveChatWidget';
import GuestChatWidget from './GuestChatWidget';

/**
 * Mounted once near the root of the app (see App.tsx). Signed-in customers get
 * the full live chat; visitors get the guest chat, which needs no account.
 */
export default function ChatWidget() {
  const { user } = useAuth();
  if (!user) return <GuestChatWidget />;
  return <LiveChatWidget active={!!user} token={user ? getAccessToken() : null} ownerKey={user?.id ?? ''} />;
}
