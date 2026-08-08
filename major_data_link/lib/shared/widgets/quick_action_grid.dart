import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/constants/app_dimensions.dart';

class QuickAction {
  const QuickAction({
    required this.label,
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
    required this.onTap,
    this.badge,
  });

  final String label;
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;
  final VoidCallback onTap;
  final String? badge;
}

class QuickActionGrid extends StatelessWidget {
  const QuickActionGrid({
    super.key,
    required this.actions,
    this.crossAxisCount = 4,
  });

  final List<QuickAction> actions;
  final int crossAxisCount;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(
        horizontal: AppDimensions.screenPaddingH,
      ),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        childAspectRatio: 0.66,
        crossAxisSpacing: 8,
        mainAxisSpacing: 12,
      ),
      itemCount: actions.length,
      itemBuilder: (context, index) {
        final action = actions[index];
        return _QuickActionItem(action: action, index: index);
      },
    );
  }
}

class _QuickActionItem extends StatelessWidget {
  const _QuickActionItem({required this.action, required this.index});

  final QuickAction action;
  final int index;

  @override
  Widget build(BuildContext context) {
    return InkWell(
          onTap: action.onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.max,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: AppDimensions.quickActionContainerSize,
                      height: AppDimensions.quickActionContainerSize,
                      decoration: BoxDecoration(
                        color: action.backgroundColor,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: action.backgroundColor.withValues(
                              alpha: 0.3,
                            ),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Icon(
                          action.icon,
                          color: action.iconColor,
                          size: AppDimensions.quickActionIconSize,
                        ),
                      ),
                    ),
                    if (action.badge != null)
                      Positioned(
                        top: -4,
                        right: -4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.red,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            action.badge!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                Flexible(
                  child: Text(
                    action.label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w500,
                      height: 1.15,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        )
        .animate(delay: Duration(milliseconds: index * 50))
        .fadeIn(duration: 300.ms)
        .slideY(begin: 0.2, curve: Curves.easeOutCubic);
  }
}
