import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

class KDShimmer extends StatelessWidget {
  const KDShimmer({
    super.key,
    required this.child,
    this.enabled = true,
  });

  final Widget child;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    if (!enabled) return child;

    return Shimmer.fromColors(
      baseColor: isDark ? AppColors.shimmerBaseDark : AppColors.shimmerBase,
      highlightColor:
          isDark ? AppColors.shimmerHighlightDark : AppColors.shimmerHighlight,
      child: child,
    );
  }
}

// ── Base shimmer block ────────────────────────────────────
class ShimmerBox extends StatelessWidget {
  const ShimmerBox({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = AppDimensions.shimmerRadius,
  });

  final double width;
  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(borderRadius),
      ),
    );
  }
}

class ShimmerCircle extends StatelessWidget {
  const ShimmerCircle({super.key, required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
      ),
    );
  }
}

// ── Wallet card shimmer ───────────────────────────────────
class WalletCardShimmer extends StatelessWidget {
  const WalletCardShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return KDShimmer(
      child: Container(
        height: AppDimensions.walletCardHeight,
        margin: const EdgeInsets.symmetric(
          horizontal: AppDimensions.screenPaddingH,
        ),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppDimensions.walletCardRadius),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const ShimmerBox(width: 80, height: 14),
                const Spacer(),
                ShimmerCircle(size: 36),
              ],
            ),
            const Spacer(),
            const ShimmerBox(width: 160, height: 36),
            const SizedBox(height: 8),
            const ShimmerBox(width: 100, height: 12),
            const Spacer(),
            Row(
              children: const [
                ShimmerBox(width: 80, height: 12),
                Spacer(),
                ShimmerBox(width: 80, height: 12),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Transaction list shimmer ──────────────────────────────
class TransactionListShimmer extends StatelessWidget {
  const TransactionListShimmer({super.key, this.itemCount = 6});
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return KDShimmer(
      child: Column(
        children: List.generate(
          itemCount,
          (i) => Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.screenPaddingH,
              vertical: 8,
            ),
            child: Row(
              children: [
                const ShimmerCircle(size: 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      ShimmerBox(width: double.infinity, height: 14),
                      SizedBox(height: 6),
                      ShimmerBox(width: 120, height: 12),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    ShimmerBox(width: 70, height: 14),
                    SizedBox(height: 6),
                    ShimmerBox(width: 50, height: 12),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Quick actions shimmer ─────────────────────────────────
class QuickActionsShimmer extends StatelessWidget {
  const QuickActionsShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return KDShimmer(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: List.generate(
          4,
          (_) => Column(
            children: const [
              ShimmerCircle(size: AppDimensions.quickActionContainerSize),
              SizedBox(height: 8),
              ShimmerBox(width: 52, height: 11),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Data plan card shimmer ────────────────────────────────
class DataPlanShimmer extends StatelessWidget {
  const DataPlanShimmer({super.key, this.itemCount = 6});
  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return KDShimmer(
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.6,
        ),
        itemCount: itemCount,
        itemBuilder: (_, __) => Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppDimensions.radiusLG),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: const [
              ShimmerBox(width: 60, height: 18),
              SizedBox(height: 8),
              ShimmerBox(width: 100, height: 13),
              SizedBox(height: 4),
              ShimmerBox(width: 80, height: 12),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Profile shimmer ───────────────────────────────────────
class ProfileShimmer extends StatelessWidget {
  const ProfileShimmer({super.key});

  @override
  Widget build(BuildContext context) {
    return KDShimmer(
      child: Padding(
        padding:
            const EdgeInsets.symmetric(horizontal: AppDimensions.screenPaddingH),
        child: Column(
          children: [
            const SizedBox(height: 24),
            const Center(child: ShimmerCircle(size: 88)),
            const SizedBox(height: 16),
            const Center(child: ShimmerBox(width: 140, height: 20)),
            const SizedBox(height: 8),
            const Center(child: ShimmerBox(width: 100, height: 14)),
            const SizedBox(height: 32),
            ...List.generate(
              5,
              (_) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Container(
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius:
                        BorderRadius.circular(AppDimensions.radiusMD),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Generic list item shimmer ─────────────────────────────
class ListItemShimmer extends StatelessWidget {
  const ListItemShimmer({super.key, this.count = 5});
  final int count;

  @override
  Widget build(BuildContext context) {
    return KDShimmer(
      child: Column(
        children: List.generate(
          count,
          (_) => Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: AppDimensions.screenPaddingH, vertical: 8),
            child: Container(
              height: AppDimensions.listItemHeight,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppDimensions.radiusMD),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
