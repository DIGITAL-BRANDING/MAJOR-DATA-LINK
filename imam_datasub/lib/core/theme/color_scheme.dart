import 'package:flutter/material.dart';
import '../constants/app_colors.dart';

class KDColorScheme {
  KDColorScheme._();

  static const ColorScheme light = ColorScheme(
    brightness: Brightness.light,

    // Primary — Purple
    primary: AppColors.primary500,
    onPrimary: AppColors.neutral0,
    primaryContainer: AppColors.primary100,
    onPrimaryContainer: AppColors.primary900,

    // Secondary — Indigo
    secondary: AppColors.secondary500,
    onSecondary: AppColors.neutral0,
    secondaryContainer: AppColors.secondary100,
    onSecondaryContainer: AppColors.secondary900,

    // Tertiary — Orange accent
    tertiary: AppColors.accent500,
    onTertiary: AppColors.neutral0,
    tertiaryContainer: AppColors.accent100,
    onTertiaryContainer: AppColors.accent900,

    // Error
    error: AppColors.error600,
    onError: AppColors.neutral0,
    errorContainer: AppColors.error100,
    onErrorContainer: AppColors.error700,

    // Background
    surface: AppColors.lightBackground,
    onSurface: AppColors.neutral900,
    surfaceContainerHighest: AppColors.lightSurfaceVariant,
    onSurfaceVariant: AppColors.neutral700,

    // Outline
    outline: AppColors.neutral300,
    outlineVariant: AppColors.neutral200,

    // Inverse
    inverseSurface: AppColors.neutral900,
    onInverseSurface: AppColors.neutral50,
    inversePrimary: AppColors.primary200,

    // Shadow
    shadow: Color(0x1A000000),
    scrim: Color(0x80000000),

    // Surface tint
    surfaceTint: AppColors.primary500,
  );

  static const ColorScheme dark = ColorScheme(
    brightness: Brightness.dark,

    // Primary
    primary: AppColors.primary400,
    onPrimary: AppColors.primary900,
    primaryContainer: AppColors.primary800,
    onPrimaryContainer: AppColors.primary100,

    // Secondary
    secondary: AppColors.secondary400,
    onSecondary: AppColors.secondary900,
    secondaryContainer: AppColors.secondary800,
    onSecondaryContainer: AppColors.secondary100,

    // Tertiary — Accent
    tertiary: AppColors.accent400,
    onTertiary: AppColors.accent900,
    tertiaryContainer: AppColors.accent800,
    onTertiaryContainer: AppColors.accent100,

    // Error
    error: AppColors.error400,
    onError: AppColors.error900,
    errorContainer: AppColors.error700,
    onErrorContainer: AppColors.error100,

    // Background
    surface: AppColors.darkBackground,
    onSurface: AppColors.neutral100,
    surfaceContainerHighest: AppColors.darkSurfaceVariant,
    onSurfaceVariant: AppColors.neutral400,

    // Outline
    outline: AppColors.neutral700,
    outlineVariant: AppColors.neutral800,

    // Inverse
    inverseSurface: AppColors.neutral100,
    onInverseSurface: AppColors.neutral900,
    inversePrimary: AppColors.primary600,

    // Shadow
    shadow: Color(0x40000000),
    scrim: Color(0x99000000),

    // Surface tint
    surfaceTint: AppColors.primary400,
  );
}
