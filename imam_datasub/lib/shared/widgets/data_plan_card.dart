import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/formatters.dart';
import '../../features/buy_data/domain/entities/data_plan_entity.dart';

class DataPlanCard extends StatelessWidget {
  const DataPlanCard({
    super.key,
    required this.plan,
    required this.isSelected,
    required this.onTap,
  });

  final DataPlanEntity plan;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scheme = Theme.of(context).colorScheme;

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isSelected
              ? scheme.primary.withValues(alpha: 0.08)
              : (isDark
                    ? AppColors.darkCardSurface
                    : AppColors.lightCardSurface),
          borderRadius: BorderRadius.circular(AppDimensions.radiusLG),
          border: Border.all(
            color: isSelected
                ? scheme.primary
                : (isDark ? AppColors.darkDivider : AppColors.neutral200),
            width: isSelected ? 1.5 : 0.5,
          ),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Text(
                  plan.size,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: isSelected
                        ? scheme.primary
                        : (isDark
                              ? AppColors.neutral100
                              : AppColors.neutral900),
                  ),
                ),
                if (plan.hasDiscount) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 5,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.error50,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      '-${plan.discountPercent.toStringAsFixed(0)}%',
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color: AppColors.error600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 4),
            Text(
              plan.description == null || plan.description == plan.validity
                  ? plan.validity
                  : '${plan.description} - ${plan.validity}',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? AppColors.neutral500 : AppColors.neutral500,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  AppFormatters.formatAmount(plan.price),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: scheme.primary,
                  ),
                ),
                if (plan.hasDiscount) ...[
                  const SizedBox(width: 6),
                  Text(
                    AppFormatters.formatAmount(plan.originalPrice!),
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.neutral400,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}
