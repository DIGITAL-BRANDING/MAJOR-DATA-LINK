import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';

/// Matches the backend's PROMO_ILLUSTRATIONS keys in notification.service.ts
/// exactly - keep the two lists in sync if either changes. Rendered as a
/// composed icon badge rather than a raster/SVG asset: no image hosting or
/// bundling needed, nothing that can fail to load, and it inherits the
/// app's gold branding automatically instead of needing separately
/// re-themed artwork.
enum PromoIllustration {
  megaphone,
  discount,
  party,
  gift,
  rocket,
  bell;

  static PromoIllustration? fromKey(String? key) {
    if (key == null) return null;
    for (final value in PromoIllustration.values) {
      if (value.name == key) return value;
    }
    return null;
  }

  IconData get _icon => switch (this) {
        PromoIllustration.megaphone => Icons.campaign_rounded,
        PromoIllustration.discount => Icons.sell_rounded,
        PromoIllustration.party => Icons.celebration_rounded,
        PromoIllustration.gift => Icons.card_giftcard_rounded,
        PromoIllustration.rocket => Icons.rocket_launch_rounded,
        PromoIllustration.bell => Icons.notifications_active_rounded,
      };

  IconData get _accentIcon => switch (this) {
        PromoIllustration.megaphone => Icons.auto_awesome,
        PromoIllustration.discount => Icons.local_fire_department_rounded,
        PromoIllustration.party => Icons.auto_awesome,
        PromoIllustration.gift => Icons.auto_awesome,
        PromoIllustration.rocket => Icons.auto_awesome,
        PromoIllustration.bell => Icons.auto_awesome,
      };
}

/// A large decorative badge for the top of [PromoPopupDialog] - gold
/// gradient disc, the illustration's main icon centered, a couple of small
/// sparkle/accent icons scattered around it for the "promotional" energy of
/// the screenshot this was modeled on.
class PromoIllustrationBadge extends StatelessWidget {
  const PromoIllustrationBadge({super.key, required this.illustration});

  final PromoIllustration illustration;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 132,
      width: 132,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            height: 116,
            width: 116,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.primary400, AppColors.secondary600],
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary500.withValues(alpha: 0.35),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Icon(illustration._icon, color: Colors.white, size: 56),
          ),
          Positioned(
            top: 4,
            right: 8,
            child: _Sparkle(icon: illustration._accentIcon, size: 22),
          ),
          Positioned(
            bottom: 10,
            left: 2,
            child: _Sparkle(icon: Icons.auto_awesome, size: 14),
          ),
        ],
      ),
    );
  }
}

class _Sparkle extends StatelessWidget {
  const _Sparkle({required this.icon, required this.size});
  final IconData icon;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(5),
      decoration: BoxDecoration(
        color: AppColors.accent500,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
      ),
      child: Icon(icon, color: Colors.white, size: size),
    );
  }
}
