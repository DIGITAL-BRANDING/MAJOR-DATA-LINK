import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';

class TierSelector<T> extends StatelessWidget {
  const TierSelector({
    super.key,
    required this.tiers,
    required this.selected,
    required this.labelOf,
    required this.onChanged,
  });

  final List<T> tiers;
  final T selected;
  final String Function(T) labelOf;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: tiers.map((tier) {
        final isSelected = tier == selected;
        return ChoiceChip(
          label: Text(labelOf(tier)),
          selected: isSelected,
          onSelected: (_) => onChanged(tier),
          selectedColor: context.colors.primary,
          labelStyle: TextStyle(
            color: isSelected ? Colors.white : null,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
          backgroundColor: context.isDark
              ? AppColors.darkSurfaceVariant
              : AppColors.lightSurfaceVariant,
          side: BorderSide.none,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        );
      }).toList(),
    );
  }
}
