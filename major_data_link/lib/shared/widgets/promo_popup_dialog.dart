import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import 'kd_button.dart';
import 'promo_illustration.dart';

/// The auto-popup promotional style requested for admin broadcasts (see the
/// "Notification popup" feature: admin picks a preset illustration and
/// toggles "show as popup" in NotificationBroadcast). Shown once per
/// notification, right after the app opens - see the caller in
/// home_screen.dart's initState for the "check for unread popups, show the
/// newest one" logic.
class PromoPopupDialog extends StatelessWidget {
  const PromoPopupDialog({
    super.key,
    required this.title,
    required this.body,
    this.illustration,
    required this.onDismiss,
  });

  final String title;
  final String body;
  final PromoIllustration? illustration;
  final VoidCallback onDismiss;

  /// Shows the dialog as a non-dismissible-by-tapping-outside modal (matches
  /// the screenshot - a promo like this shouldn't disappear from an
  /// accidental tap on the backdrop) and calls [onRead] once, right before
  /// it's shown, so the caller can mark it read immediately rather than
  /// risk it re-appearing if the user backgrounds the app mid-read.
  static Future<void> show(
    BuildContext context, {
    required String title,
    required String body,
    PromoIllustration? illustration,
    required VoidCallback onRead,
  }) async {
    onRead();
    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: AppColors.neutral900.withValues(alpha: 0.6),
      builder: (dialogContext) => PromoPopupDialog(
        title: title,
        body: body,
        illustration: illustration,
        onDismiss: () => Navigator.of(dialogContext).pop(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 28),
      child: Container(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
        decoration: BoxDecoration(
          color: AppColors.lightSurface,
          borderRadius: BorderRadius.circular(AppDimensions.radiusLG),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (illustration != null) ...[
              PromoIllustrationBadge(illustration: illustration!),
              const SizedBox(height: 20),
            ],
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 19,
                fontWeight: FontWeight.w800,
                color: AppColors.neutral900,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w400,
                color: AppColors.neutral600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 24),
            KDButton(label: 'Okay', onPressed: onDismiss),
          ],
        ),
      ),
    );
  }
}
