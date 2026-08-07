import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../features/buy_data/domain/entities/data_plan_entity.dart';

class NetworkSelector extends StatelessWidget {
  const NetworkSelector({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  final NetworkProvider selected;
  final void Function(NetworkProvider) onChanged;

  static const _logos = {
    NetworkProvider.mtn: ('MTN', AppColors.mtnYellow, Colors.black),
    NetworkProvider.glo: ('GLO', AppColors.gloGreen, Colors.white),
    NetworkProvider.airtel: ('AIRTEL', AppColors.airtelRed, Colors.white),
    NetworkProvider.nineMobile: ('9MOBILE', AppColors.nineGold, Colors.white),
  };

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 88,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(
          horizontal: AppDimensions.screenPaddingH,
        ),
        itemCount: NetworkProvider.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final network = NetworkProvider.values[index];
          final isSelected = network == selected;
          final (label, bgColor, textColor) = _logos[network]!;

          return GestureDetector(
            onTap: () => onChanged(network),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 72,
              decoration: BoxDecoration(
                border: Border.all(
                  color: isSelected
                      ? Theme.of(context).colorScheme.primary
                      : Colors.transparent,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              padding: const EdgeInsets.all(4),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: AppDimensions.networkLogoSize,
                    height: AppDimensions.networkLogoSize,
                    decoration: BoxDecoration(
                      color: bgColor,
                      borderRadius:
                          BorderRadius.circular(AppDimensions.networkLogoRadius),
                    ),
                    child: Center(
                      child: Text(
                        label.length > 3 ? label.substring(0, 3) : label,
                        style: TextStyle(
                          color: textColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    network.label,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight:
                          isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected
                          ? Theme.of(context).colorScheme.primary
                          : AppColors.neutral500,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
