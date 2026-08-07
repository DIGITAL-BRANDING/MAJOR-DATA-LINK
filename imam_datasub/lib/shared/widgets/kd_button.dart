import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/theme/text_theme.dart';

// ── Primary Button ─────────────────────────────────────────
class KDButton extends StatelessWidget {
  const KDButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.isDisabled = false,
    this.icon,
    this.height = AppDimensions.buttonHeightLG,
    this.width = double.infinity,
    this.borderRadius = AppDimensions.radiusMD,
    this.gradient,
    this.backgroundColor,
    this.foregroundColor,
    this.fontSize = 16,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isDisabled;
  final IconData? icon;
  final double height;
  final double? width;
  final double borderRadius;
  final LinearGradient? gradient;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isEnabled = !isDisabled && !isLoading && onPressed != null;

    return AnimatedOpacity(
      opacity: isEnabled ? 1.0 : 0.6,
      duration: const Duration(milliseconds: 200),
      child: SizedBox(
        width: width,
        height: height,
        child: gradient != null
            ? _GradientButton(
                label: label,
                onPressed: isEnabled ? onPressed : null,
                isLoading: isLoading,
                icon: icon,
                gradient: gradient!,
                foregroundColor: foregroundColor ?? AppColors.neutral0,
                borderRadius: borderRadius,
                fontSize: fontSize,
              )
            : ElevatedButton(
                onPressed: isEnabled ? onPressed : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: backgroundColor ?? scheme.primary,
                  foregroundColor: foregroundColor ?? AppColors.neutral0,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(borderRadius),
                  ),
                  padding: EdgeInsets.zero,
                ),
                child: _ButtonContent(
                  label: label,
                  isLoading: isLoading,
                  icon: icon,
                  foregroundColor: foregroundColor ?? AppColors.neutral0,
                  fontSize: fontSize,
                ),
              ),
      ),
    ).animate().scale(
          begin: const Offset(1, 1),
          duration: 100.ms,
          curve: Curves.easeOut,
        );
  }
}

class _GradientButton extends StatelessWidget {
  const _GradientButton({
    required this.label,
    required this.onPressed,
    required this.isLoading,
    required this.gradient,
    required this.foregroundColor,
    required this.borderRadius,
    required this.fontSize,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final LinearGradient gradient;
  final Color foregroundColor;
  final double borderRadius;
  final double fontSize;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Material(
      borderRadius: BorderRadius.circular(borderRadius),
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(borderRadius),
        child: Ink(
          decoration: BoxDecoration(
            gradient: onPressed != null ? gradient : null,
            color: onPressed == null ? AppColors.neutral300 : null,
            borderRadius: BorderRadius.circular(borderRadius),
          ),
          child: _ButtonContent(
            label: label,
            isLoading: isLoading,
            icon: icon,
            foregroundColor: foregroundColor,
            fontSize: fontSize,
          ),
        ),
      ),
    );
  }
}

class _ButtonContent extends StatelessWidget {
  const _ButtonContent({
    required this.label,
    required this.isLoading,
    required this.foregroundColor,
    required this.fontSize,
    this.icon,
  });

  final String label;
  final bool isLoading;
  final Color foregroundColor;
  final double fontSize;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return Center(
        child: SizedBox(
          width: 22,
          height: 22,
          child: CircularProgressIndicator(
            strokeWidth: 2.5,
            valueColor: AlwaysStoppedAnimation(foregroundColor),
          ),
        ),
      );
    }

    if (icon != null) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20, color: foregroundColor),
          const SizedBox(width: 8),
          Text(
            label,
            style: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
              color: foregroundColor,
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      );
    }

    return Center(
      child: Text(
        label,
        style: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
          color: foregroundColor,
          fontSize: fontSize,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

// ── Outlined Button ───────────────────────────────────────
class KDOutlinedButton extends StatelessWidget {
  const KDOutlinedButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.isLoading = false,
    this.icon,
    this.height = AppDimensions.buttonHeightLG,
    this.width = double.infinity,
    this.color,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;
  final double height;
  final double? width;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final btnColor = color ?? scheme.primary;

    return SizedBox(
      width: width,
      height: height,
      child: OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: btnColor,
          side: BorderSide(color: btnColor, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDimensions.radiusMD),
          ),
        ),
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation(btnColor),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 18),
                    const SizedBox(width: 8),
                  ],
                  Text(label,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                ],
              ),
      ),
    );
  }
}

// ── Small button ──────────────────────────────────────────
class KDSmallButton extends StatelessWidget {
  const KDSmallButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.backgroundColor,
    this.foregroundColor,
    this.borderRadius = AppDimensions.radiusSM,
    this.padding,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final Color? backgroundColor;
  final Color? foregroundColor;
  final double borderRadius;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: backgroundColor ?? scheme.primaryContainer,
        foregroundColor: foregroundColor ?? scheme.primary,
        elevation: 0,
        padding: padding ??
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(borderRadius),
        ),
        textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14),
            const SizedBox(width: 4),
          ],
          Text(label),
        ],
      ),
    );
  }
}

// ── Icon button with background ───────────────────────────
class KDIconButton extends StatelessWidget {
  const KDIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.size = 44,
    this.iconSize = 20,
    this.backgroundColor,
    this.iconColor,
    this.borderRadius = AppDimensions.radiusSM,
    this.tooltip,
    this.badge,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final double size;
  final double iconSize;
  final Color? backgroundColor;
  final Color? iconColor;
  final double borderRadius;
  final String? tooltip;
  final int? badge;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final bg = backgroundColor ?? scheme.surfaceContainerHighest;
    final ic = iconColor ?? scheme.onSurface;

    Widget button = Material(
      color: bg,
      borderRadius: BorderRadius.circular(borderRadius),
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(borderRadius),
        child: SizedBox(
          width: size,
          height: size,
          child: Center(child: Icon(icon, size: iconSize, color: ic)),
        ),
      ),
    );

    if (badge != null && badge! > 0) {
      button = Stack(
        clipBehavior: Clip.none,
        children: [
          button,
          Positioned(
            top: -4,
            right: -4,
            child: Container(
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
              decoration: BoxDecoration(
                color: scheme.error,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  badge! > 99 ? '99+' : badge.toString(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: scheme.onError,
                  ),
                ),
              ),
            ),
          ),
        ],
      );
    }

    if (tooltip != null) {
      return Tooltip(message: tooltip!, child: button);
    }

    return button;
  }
}
