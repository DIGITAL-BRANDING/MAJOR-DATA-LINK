import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/formatters.dart';

enum TransactionStatus { success, pending, failed }

enum TransactionType {
  data,
  airtime,
  cable,
  electricity,
  fund,
  transfer,
  referral,
  recharge,
  waec,
  neco,
  jamb,
  sms,
}

class TransactionTile extends StatelessWidget {
  const TransactionTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.date,
    required this.status,
    required this.type,
    required this.isCredit,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final double amount;
  final DateTime date;
  final TransactionStatus status;
  final TransactionType type;
  final bool isCredit;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppDimensions.radiusMD),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.screenPaddingH,
          vertical: 10,
        ),
        child: Row(
          children: [
            // ── Icon ─────────────────────────────────────
            _TxIcon(type: type, status: status),
            const SizedBox(width: 12),

            // ── Info ──────────────────────────────────────
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: isDark
                              ? AppColors.neutral500
                              : AppColors.neutral400,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),

            // ── Amount + time ─────────────────────────────
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${isCredit ? '+' : '-'}${AppFormatters.formatAmount(amount)}',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: isCredit
                        ? AppColors.success600
                        : isDark
                            ? AppColors.neutral100
                            : AppColors.neutral900,
                  ),
                ),
                const SizedBox(height: 3),
                _StatusChip(status: status),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _TxIcon extends StatelessWidget {
  const _TxIcon({required this.type, required this.status});

  final TransactionType type;
  final TransactionStatus status;

  @override
  Widget build(BuildContext context) {
    final iconData = _iconFor(type);
    final colors = _colorsFor(type);

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(AppDimensions.radiusSM),
      ),
      child: Center(
        child: Icon(iconData, color: colors.$2, size: 20),
      ),
    );
  }

  IconData _iconFor(TransactionType type) {
    switch (type) {
      case TransactionType.data:
        return Icons.wifi_rounded;
      case TransactionType.airtime:
        return Icons.phone_android_rounded;
      case TransactionType.cable:
        return Icons.tv_rounded;
      case TransactionType.electricity:
        return Icons.flash_on_rounded;
      case TransactionType.fund:
        return Icons.add_circle_outline_rounded;
      case TransactionType.transfer:
        return Icons.swap_horiz_rounded;
      case TransactionType.referral:
        return Icons.card_giftcard_rounded;
      case TransactionType.recharge:
        return Icons.sim_card_rounded;
      case TransactionType.waec:
      case TransactionType.neco:
      case TransactionType.jamb:
        return Icons.school_rounded;
      case TransactionType.sms:
        return Icons.sms_rounded;
    }
  }

  (Color, Color) _colorsFor(TransactionType type) {
    switch (type) {
      case TransactionType.data:
        return (AppColors.primary100, AppColors.primary600);
      case TransactionType.airtime:
        return (AppColors.secondary100, AppColors.secondary600);
      case TransactionType.cable:
        return (AppColors.accent100, AppColors.accent600);
      case TransactionType.electricity:
        return (AppColors.warning100, AppColors.warning600);
      case TransactionType.fund:
        return (AppColors.success100, AppColors.success600);
      case TransactionType.transfer:
        return (AppColors.primary100, AppColors.primary700);
      case TransactionType.referral:
        return (AppColors.success100, AppColors.success700);
      default:
        return (AppColors.neutral100, AppColors.neutral600);
    }
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final TransactionStatus status;

  @override
  Widget build(BuildContext context) {
    final (bg, text, label) = switch (status) {
      TransactionStatus.success => (
          AppColors.txSuccessBg,
          AppColors.txSuccessText,
          'Success'
        ),
      TransactionStatus.pending => (
          AppColors.txPendingBg,
          AppColors.txPendingText,
          'Pending'
        ),
      TransactionStatus.failed => (
          AppColors.txFailedBg,
          AppColors.txFailedText,
          'Failed'
        ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: text,
        ),
      ),
    );
  }
}
