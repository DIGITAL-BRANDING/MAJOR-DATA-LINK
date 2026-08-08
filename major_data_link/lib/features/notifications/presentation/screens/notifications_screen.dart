import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../providers/notification_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          notifAsync.whenData((notifications) {
            final hasUnread = notifications.any((n) => !n.isRead);
            if (!hasUnread) return const SizedBox.shrink();
            return TextButton(
              onPressed: () => ref
                  .read(notificationsProvider.notifier)
                  .markAllRead(),
              child: Text(
                'Mark all read',
                style: TextStyle(
                  color: context.colors.primary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
            );
          }).value ??
              const SizedBox.shrink(),
        ],
      ),
      body: SafeArea(
        top: false,
        child: notifAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(AppDimensions.screenPaddingH),
            child: ListItemShimmer(count: 6),
          ),
          error: (e, _) => KDErrorState(
            message: 'Could not load notifications',
            onRetry: () =>
                ref.read(notificationsProvider.notifier).refresh(),
          ),
          data: (notifications) {
            if (notifications.isEmpty) {
              return const KDEmptyState(
                title: 'No notifications',
                message:
                    'Your transaction alerts and updates will appear here.',
                icon: Icons.notifications_none_rounded,
              );
            }

            return RefreshIndicator(
              onRefresh: () =>
                  ref.read(notificationsProvider.notifier).refresh(),
              child: ListView.separated(
                itemCount: notifications.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 72),
                itemBuilder: (context, index) {
                  final notif = notifications[index];
                  return _NotificationTile(notification: notif);
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification});
  final AppNotification notification;

  IconData get _icon {
    switch (notification.type) {
      case 'transaction':
        return Icons.receipt_long_rounded;
      case 'wallet':
        return Icons.account_balance_wallet_rounded;
      case 'kyc':
        return Icons.verified_user_rounded;
      case 'promo':
        return Icons.local_offer_rounded;
      default:
        return Icons.notifications_rounded;
    }
  }

  Color get _iconColor {
    switch (notification.type) {
      case 'transaction':
        return AppColors.primary500;
      case 'wallet':
        return AppColors.success500;
      case 'kyc':
        return AppColors.secondary500;
      case 'promo':
        return AppColors.accent500;
      default:
        return AppColors.neutral500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isUnread = !notification.isRead;

    return Container(
      color: isUnread
          ? (isDark
              ? AppColors.primary900.withValues(alpha: 0.15)
              : AppColors.primary50.withValues(alpha: 0.5))
          : null,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.screenPaddingH,
          vertical: 14,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Icon ─────────────────────────────────────
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _iconColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(_icon, color: _iconColor, size: 20),
            ),
            const SizedBox(width: 12),

            // ── Content ───────────────────────────────────
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: TextStyle(
                            fontWeight: isUnread
                                ? FontWeight.w700
                                : FontWeight.w600,
                            fontSize: 14,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (isUnread) ...[
                        const SizedBox(width: 8),
                        Container(
                          width: 8,
                          height: 8,
                          decoration: BoxDecoration(
                            color: context.colors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.body,
                    style: context.textTheme.bodySmall?.copyWith(
                      color: AppColors.neutral500,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    AppFormatters.formatRelativeDate(notification.date),
                    style: context.textTheme.labelSmall?.copyWith(
                      color: AppColors.neutral400,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
