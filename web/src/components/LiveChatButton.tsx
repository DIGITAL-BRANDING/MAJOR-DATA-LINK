import { MessageCircle } from 'lucide-react';
import { openLiveChat } from '../lib/live-chat-events';

type Props = { label: string; className?: string };

/** Opens live chat for everyone: signed-in users use their account, visitors start a guest chat. */
export default function LiveChatButton({ label, className }: Props) {
  return (
    <button type="button" className={className} onClick={() => openLiveChat()}>
      <MessageCircle size={15} aria-hidden="true" /> {label}
    </button>
  );
}
