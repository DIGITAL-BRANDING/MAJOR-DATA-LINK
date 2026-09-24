import { getAccessToken } from '../lib/api';
import { useAuth } from '../lib/auth';
import LiveChatWidget from './LiveChatWidget';

/** Mounted once near the root of the customer app (see App.tsx). Renders nothing until signed in. */
export default function ChatWidget() {
  const { user } = useAuth();
  return <LiveChatWidget active={!!user} token={user ? getAccessToken() : null} ownerKey={user?.id ?? ''} />;
}
