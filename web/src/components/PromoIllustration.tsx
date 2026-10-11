import { BellRing, Flame, Gift, Megaphone, PartyPopper, Rocket, Sparkles, Tag, type LucideIcon } from 'lucide-react';

/**
 * Keys match PROMO_ILLUSTRATIONS in the backend (notification.service.ts).
 * Keep this list in sync with the backend and with the Flutter enum
 * PromoIllustration in lib/shared/widgets/promo_illustration.dart.
 */
export const PROMO_ILLUSTRATION_KEYS = ['megaphone', 'discount', 'party', 'gift', 'rocket', 'bell'] as const;
export type PromoIllustrationKey = (typeof PROMO_ILLUSTRATION_KEYS)[number];

const MAIN_ICON: Record<PromoIllustrationKey, LucideIcon> = {
  megaphone: Megaphone,
  discount: Tag,
  party: PartyPopper,
  gift: Gift,
  rocket: Rocket,
  bell: BellRing,
};

const ACCENT_ICON: Record<PromoIllustrationKey, LucideIcon> = {
  megaphone: Sparkles,
  discount: Flame,
  party: Sparkles,
  gift: Sparkles,
  rocket: Sparkles,
  bell: Sparkles,
};

export function isPromoIllustrationKey(key: string | null | undefined): key is PromoIllustrationKey {
  return !!key && (PROMO_ILLUSTRATION_KEYS as readonly string[]).includes(key);
}

function Sparkle({ className, Icon, size }: { className: string; Icon: LucideIcon; size: number }) {
  return (
    <span
      className={`${className} flex items-center justify-center rounded-full border-2 border-white`}
      style={{ background: '#FF6B35', padding: 5 }}
    >
      <Icon size={size} color="#fff" />
    </span>
  );
}

/** Same badge as the app's PromoIllustrationBadge: gold gradient disc, icon, two sparkles. */
export default function PromoIllustrationBadge({ illustration }: { illustration: PromoIllustrationKey }) {
  const Main = MAIN_ICON[illustration];
  return (
    <div className="relative mx-auto" style={{ height: 132, width: 132 }} aria-hidden="true">
      <div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          height: 116,
          width: 116,
          background: 'linear-gradient(135deg, #F7C948, #A67C1B)',
          boxShadow: '0 10px 24px rgba(212, 175, 55, 0.35)',
        }}
      >
        <Main size={56} color="#fff" strokeWidth={2} />
      </div>
      <Sparkle className="absolute right-2 top-1" Icon={ACCENT_ICON[illustration]} size={22} />
      <Sparkle className="absolute bottom-2.5 left-0.5" Icon={Sparkles} size={14} />
    </div>
  );
}
