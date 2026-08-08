import 'package:flutter/material.dart';

/// MAJOR DATA-LINK — Complete Color System
/// Primary: Gold
/// Secondary: Antique / Bronze Gold
/// Accent: Vivid Orange
/// Semantic: Success Green, Warning Amber, Error Red
abstract class AppColors {
  AppColors._();

  // ── Brand Primary (Gold) ────────────────────────────────────
  static const Color primary50 = Color(0xFFFFFBEB);
  static const Color primary100 = Color(0xFFFFF3C4);
  static const Color primary200 = Color(0xFFFCE588);
  static const Color primary300 = Color(0xFFFADB5F);
  static const Color primary400 = Color(0xFFF7C948);
  static const Color primary500 = Color(0xFFD4AF37); // ← Main brand (gold)
  static const Color primary600 = Color(0xFFB8941F);
  static const Color primary700 = Color(0xFF9C7A17);
  static const Color primary800 = Color(0xFF7D5F0F);
  static const Color primary900 = Color(0xFF5C4509);

  // ── Brand Secondary (Antique / Bronze Gold) ─────────────────
  static const Color secondary50 = Color(0xFFFFF8ED);
  static const Color secondary100 = Color(0xFFFCE9C8);
  static const Color secondary200 = Color(0xFFF7D28C);
  static const Color secondary300 = Color(0xFFF0B354);
  static const Color secondary400 = Color(0xFFE39A2E);
  static const Color secondary500 = Color(0xFFC9A227); // ← Main secondary
  static const Color secondary600 = Color(0xFFA67C1B);
  static const Color secondary700 = Color(0xFF855F16);
  static const Color secondary800 = Color(0xFF654510);
  static const Color secondary900 = Color(0xFF452F0B);

  // ── Accent (Vivid Orange) ──────────────────────────────────
  static const Color accent50 = Color(0xFFFFF3ED);
  static const Color accent100 = Color(0xFFFFE0CB);
  static const Color accent200 = Color(0xFFFFBF94);
  static const Color accent300 = Color(0xFFFF9A5C);
  static const Color accent400 = Color(0xFFFF7B33);
  static const Color accent500 = Color(0xFFFF6B35); // ← Main accent
  static const Color accent600 = Color(0xFFE55520);
  static const Color accent700 = Color(0xFFC44014);
  static const Color accent800 = Color(0xFFA32D0B);
  static const Color accent900 = Color(0xFF811D05);

  // ── Success (Green) ───────────────────────────────────────
  static const Color success50 = Color(0xFFECFDF5);
  static const Color success100 = Color(0xFFD1FAE5);
  static const Color success200 = Color(0xFFA7F3D0);
  static const Color success300 = Color(0xFF6EE7B7);
  static const Color success400 = Color(0xFF34D399);
  static const Color success500 = Color(0xFF10B981);
  static const Color success600 = Color(0xFF059669);
  static const Color success700 = Color(0xFF047857);

  // ── Warning (Amber) ───────────────────────────────────────
  static const Color warning50 = Color(0xFFFFFBEB);
  static const Color warning100 = Color(0xFFFEF3C7);
  static const Color warning300 = Color(0xFFFCD34D);
  static const Color warning400 = Color(0xFFFBBF24);
  static const Color warning500 = Color(0xFFF59E0B);
  static const Color warning600 = Color(0xFFD97706);
  static const Color warning700 = Color(0xFFB45309);

  // ── Error (Red) ───────────────────────────────────────────
  static const Color error50 = Color(0xFFFFF1F2);
  static const Color error100 = Color(0xFFFFE4E6);
  static const Color error300 = Color(0xFFFCA5A5);
  static const Color error400 = Color(0xFFF87171);
  static const Color error500 = Color(0xFFEF4444);
  static const Color error600 = Color(0xFFDC2626);
  static const Color error700 = Color(0xFFB91C1C);
  static const Color error800 = Color(0xFF991B1B);
  static const Color error900 = Color(0xFF7F1D1D);

  // ── Neutrals ──────────────────────────────────────────────
  static const Color neutral0 = Color(0xFFFFFFFF);
  static const Color neutral50 = Color(0xFFF9F9FB);
  static const Color neutral100 = Color(0xFFF2F2F7);
  static const Color neutral200 = Color(0xFFE5E5EA);
  static const Color neutral300 = Color(0xFFD1D1D6);
  static const Color neutral400 = Color(0xFFAEAEB2);
  static const Color neutral500 = Color(0xFF8E8E93);
  static const Color neutral600 = Color(0xFF636366);
  static const Color neutral700 = Color(0xFF48484A);
  static const Color neutral800 = Color(0xFF3A3A3C);
  static const Color neutral850 = Color(0xFF2C2C2E);
  static const Color neutral900 = Color(0xFF1C1C1E);
  static const Color neutral950 = Color(0xFF120E06); // Dark bg

  // ── Light Mode Surfaces ───────────────────────────────────
  static const Color lightBackground = Color(0xFFFAF7EF);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightSurfaceVariant = Color(0xFFF5F0E1);
  static const Color lightCardSurface = Color(0xFFFFFFFF);
  static const Color lightDivider = Color(0xFFE9E1C8);

  // ── Dark Mode Surfaces ────────────────────────────────────
  static const Color darkBackground = Color(0xFF1A1508);
  static const Color darkSurface = Color(0xFF241D0D);
  static const Color darkSurfaceVariant = Color(0xFF2E2610);
  static const Color darkCardSurface = Color(0xFF261F0F);
  static const Color darkDivider = Color(0xFF3A2F16);
  static const Color darkNavBar = Color(0xFF15110A);

  // ── Wallet Card Gradient ───────────────────────────────────
  static const Color walletGradientStart = Color(0xFFD4AF37);
  static const Color walletGradientMid = Color(0xFFB8941F);
  static const Color walletGradientEnd = Color(0xFF5C4509);

  // ── Network Brand Colors ───────────────────────────────────
  static const Color mtnYellow = Color(0xFFFFCC00);
  static const Color gloGreen = Color(0xFF007A4D);
  static const Color airtelRed = Color(0xFFE40000);
  static const Color nineGold = Color(0xFF007B5E);

  // ── Glassmorphism ─────────────────────────────────────────
  static const Color glassWhite = Color(0x1AFFFFFF);
  static const Color glassBorder = Color(0x33FFFFFF);
  static const Color glassDark = Color(0x1A000000);

  // ── Shimmer ───────────────────────────────────────────────
  static const Color shimmerBase = Color(0xFFE5E5EA);
  static const Color shimmerHighlight = Color(0xFFF5F5FA);
  static const Color shimmerBaseDark = Color(0xFF252240);
  static const Color shimmerHighlightDark = Color(0xFF302D50);

  // ── Transaction Status ─────────────────────────────────────
  static const Color txSuccessBg = Color(0xFFECFDF5);
  static const Color txSuccessText = Color(0xFF059669);
  static const Color txPendingBg = Color(0xFFFFFBEB);
  static const Color txPendingText = Color(0xFFD97706);
  static const Color txFailedBg = Color(0xFFFFF1F2);
  static const Color txFailedText = Color(0xFFDC2626);

  // ── Gradient definitions ───────────────────────────────────
  static const LinearGradient primaryGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primary500, secondary500],
  );

  static const LinearGradient walletGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [walletGradientStart, walletGradientMid, walletGradientEnd],
    stops: [0.0, 0.5, 1.0],
  );

  static const LinearGradient accentGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [accent400, accent600],
  );

  static const LinearGradient darkCardGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFF2E2610), Color(0xFF1A1508)],
  );
}
