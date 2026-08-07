import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';

/// A consistent bottom sheet container with drag handle, title, and
/// optional close button. Wrap any bottom sheet content in this.
class KDBottomSheet extends StatelessWidget {
  const KDBottomSheet({
    super.key,
    required this.child,
    this.title,
    this.showHandle = true,
    this.showClose = false,
    this.padding,
  });

  final Widget child;
  final String? title;
  final bool showHandle;
  final bool showClose;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      // SafeArea + SingleChildScrollView: every screen hands arbitrary
      // content through `child`, so this shared shell has no way to know in
      // advance whether it'll fit the available height (varies by device,
      // by keyboard state, and by how much content the caller passes in).
      // Scrolling instead of hard-overflowing is what makes this safe to
      // reuse everywhere.
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Container(
            padding: padding ??
                const EdgeInsets.fromLTRB(
                    AppDimensions.screenPaddingH,
                    8,
                    AppDimensions.screenPaddingH,
                    32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            if (showHandle)
              Center(
                child: Container(
                  width: AppDimensions.dragHandleWidth,
                  height: AppDimensions.dragHandleHeight,
                  decoration: BoxDecoration(
                    color: AppColors.neutral300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            if (title != null) ...[
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      title!,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (showClose)
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppColors.neutral100,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close_rounded,
                            size: 16, color: AppColors.neutral600),
                      ),
                    ),
                ],
              ),
            ] else
              const SizedBox(height: 12),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Helper to show a KDBottomSheet modally
Future<T?> showKDBottomSheet<T>({
  required BuildContext context,
  required Widget child,
  String? title,
  bool isScrollControlled = true,
  bool isDismissible = true,
  bool showClose = false,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: isScrollControlled,
    isDismissible: isDismissible,
    useSafeArea: true,
    builder: (_) => KDBottomSheet(
      title: title,
      showClose: showClose,
      child: child,
    ),
  );
}
