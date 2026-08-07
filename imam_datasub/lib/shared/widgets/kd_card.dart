import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class KDCard extends StatelessWidget {
  const KDCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.borderRadius = AppDimensions.radiusXL,
    this.backgroundColor,
    this.elevation = 0,
    this.border,
  });

  final Widget child;
  final EdgeInsets? padding;
  final EdgeInsets? margin;
  final VoidCallback? onTap;
  final double borderRadius;
  final Color? backgroundColor;
  final double elevation;
  final BoxBorder? border;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = backgroundColor ??
        (isDark ? AppColors.darkCardSurface : AppColors.lightCardSurface);

    final card = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border ??
            Border.all(
              color: isDark ? AppColors.darkDivider : AppColors.neutral200,
              width: 0.5,
            ),
        boxShadow: elevation > 0
            ? [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.04),
                  blurRadius: elevation * 4,
                  offset: Offset(0, elevation),
                ),
              ]
            : null,
      ),
      child: Padding(
        padding: padding ??
            const EdgeInsets.symmetric(
              horizontal: AppDimensions.cardPaddingH,
              vertical: AppDimensions.cardPaddingV,
            ),
        child: child,
      ),
    );

    if (onTap == null) return card;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(borderRadius),
        child: card,
      ),
    );
  }
}

// ── Stat card (used in referral / dashboard summaries) ────
class KDStatCard extends StatelessWidget {
  const KDStatCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.iconColor,
    this.trend,
    this.isPositiveTrend = true,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Color? iconColor;
  final String? trend;
  final bool isPositiveTrend;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return KDCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18, color: iconColor ?? scheme.primary),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          if (trend != null) ...[
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  isPositiveTrend
                      ? Icons.trending_up_rounded
                      : Icons.trending_down_rounded,
                  size: 14,
                  color: isPositiveTrend
                      ? AppColors.success600
                      : AppColors.error600,
                ),
                const SizedBox(width: 2),
                Text(
                  trend!,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isPositiveTrend
                        ? AppColors.success600
                        : AppColors.error600,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

// ── Section header used across screens ────────────────────
class KDSectionHeader extends StatelessWidget {
  const KDSectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onActionTap,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onActionTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.screenPaddingH,
        vertical: 8,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          if (actionLabel != null)
            GestureDetector(
              onTap: onActionTap,
              child: Text(
                actionLabel!,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Empty state widget ─────────────────────────────────────
class KDEmptyState extends StatelessWidget {
  const KDEmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
    this.action,
  });

  final String title;
  final String message;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurfaceVariant
                  : AppColors.neutral100,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 32, color: AppColors.neutral400),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppColors.neutral500,
                ),
            textAlign: TextAlign.center,
          ),
          if (action != null) ...[
            const SizedBox(height: 20),
            action!,
          ],
        ],
      ),
    );
  }
}

// ── Error state widget ─────────────────────────────────────
class KDErrorState extends StatelessWidget {
  const KDErrorState({
    super.key,
    required this.message,
    required this.onRetry,
  });

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.error50,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.wifi_off_rounded,
              size: 32,
              color: AppColors.error500,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            message,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}
