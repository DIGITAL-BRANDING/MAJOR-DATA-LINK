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

  Future<void> _openNotification(
    BuildContext context,
    WidgetRef ref,
    AppNotification notification,
  ) async {
    if (!notification.isRead) {
      await ref.read(notificationsProvider.notifier).markRead([
        notification.id,
      ]);
    }
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppDimensions.screenPaddingH,
            8,
            AppDimensions.screenPaddingH,
            MediaQuery.viewInsetsOf(sheetContext).bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  notification.title,
                  style: Theme.of(
                    sheetContext,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  AppFormatters.formatRelativeDate(notification.date),
                  style: Theme.of(sheetContext).textTheme.labelMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                ),
                const Divider(height: 28),
                SelectableText(
                  notification.body,
                  style: Theme.of(
                    sheetContext,
                  ).textTheme.bodyMedium?.copyWith(height: 1.6),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          notifAsync.whenData((notifications) {
                if (!notifications.any((n) => !n.isRead))
                  return const SizedBox.shrink();
                return TextButton(
                  onPressed: () =>
                      ref.read(notificationsProvider.notifier).markAllRead(),
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
            onRetry: () => ref.read(notificationsProvider.notifier).refresh(),
          ),
          data: (notifications) {
            if (notifications.isEmpty)
              return const KDEmptyState(
                title: 'No notifications',
                message:
                    'Your transaction alerts and updates will appear here.',
                icon: Icons.notifications_none_rounded,
              );
            return RefreshIndicator(
              onRefresh: () =>
                  ref.read(notificationsProvider.notifier).refresh(),
              child: ListView.separated(
                itemCount: notifications.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 72),
                itemBuilder: (context, index) => _NotificationTile(
                  notification: notifications[index],
                  onTap: () =>
                      _openNotification(context, ref, notifications[index]),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});
  final AppNotification notification;
  final VoidCallback onTap;
  IconData get _icon => switch (notification.type) {
    'transaction' => Icons.receipt_long_rounded,
    'wallet' => Icons.account_balance_wallet_rounded,
    'kyc' => Icons.verified_user_rounded,
    'promo' => Icons.local_offer_rounded,
    _ => Icons.notifications_rounded,
  };
  Color get _iconColor => switch (notification.type) {
    'transaction' => AppColors.primary500,
    'wallet' => AppColors.success500,
    'kyc' => AppColors.secondary500,
    'promo' => AppColors.accent500,
    _ => AppColors.neutral500,
  };
  @override
  Widget build(BuildContext context) {
    final isUnread = !notification.isRead;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isUnread
          ? (isDark
                ? AppColors.primary900.withValues(alpha: 0.15)
                : AppColors.primary50.withValues(alpha: 0.5))
          : Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
            vertical: 14,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
      ),
    );
  }
}
