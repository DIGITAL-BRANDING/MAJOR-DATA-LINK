import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class KDTextTheme {
  KDTextTheme._();

  // ── Light Text Theme ──────────────────────────────────────
  static TextTheme get lightTextTheme => TextTheme(
        // Display — very large, used for hero numbers (wallet balance)
        displayLarge: GoogleFonts.plusJakartaSans(
          fontSize: 57,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.25,
          color: AppColors.neutral900,
          height: 1.12,
        ),
        displayMedium: GoogleFonts.plusJakartaSans(
          fontSize: 45,
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
          color: AppColors.neutral900,
          height: 1.16,
        ),
        displaySmall: GoogleFonts.plusJakartaSans(
          fontSize: 36,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: AppColors.neutral900,
          height: 1.22,
        ),

        // Headline — section headers, screen titles
        headlineLarge: GoogleFonts.plusJakartaSans(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: AppColors.neutral900,
          height: 1.25,
        ),
        headlineMedium: GoogleFonts.plusJakartaSans(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.25,
          color: AppColors.neutral900,
          height: 1.29,
        ),
        headlineSmall: GoogleFonts.plusJakartaSans(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: AppColors.neutral900,
          height: 1.33,
        ),

        // Title — card headers, list item titles
        titleLarge: GoogleFonts.plusJakartaSans(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: AppColors.neutral900,
          height: 1.27,
        ),
        titleMedium: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.15,
          color: AppColors.neutral900,
          height: 1.5,
        ),
        titleSmall: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
          color: AppColors.neutral800,
          height: 1.43,
        ),

        // Label — buttons, chips, form labels
        labelLarge: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
          color: AppColors.neutral900,
          height: 1.43,
        ),
        labelMedium: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: AppColors.neutral700,
          height: 1.33,
        ),
        labelSmall: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: AppColors.neutral600,
          height: 1.45,
        ),

        // Body — general readable content
        bodyLarge: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          letterSpacing: 0.5,
          color: AppColors.neutral800,
          height: 1.5,
        ),
        bodyMedium: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          letterSpacing: 0.25,
          color: AppColors.neutral700,
          height: 1.43,
        ),
        bodySmall: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          letterSpacing: 0.4,
          color: AppColors.neutral500,
          height: 1.33,
        ),
      );

  // ── Dark Text Theme ───────────────────────────────────────
  static TextTheme get darkTextTheme => TextTheme(
        displayLarge: GoogleFonts.plusJakartaSans(
          fontSize: 57,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.25,
          color: AppColors.neutral0,
          height: 1.12,
        ),
        displayMedium: GoogleFonts.plusJakartaSans(
          fontSize: 45,
          fontWeight: FontWeight.w700,
          letterSpacing: 0,
          color: AppColors.neutral0,
          height: 1.16,
        ),
        displaySmall: GoogleFonts.plusJakartaSans(
          fontSize: 36,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: AppColors.neutral0,
          height: 1.22,
        ),
        headlineLarge: GoogleFonts.plusJakartaSans(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: AppColors.neutral0,
          height: 1.25,
        ),
        headlineMedium: GoogleFonts.plusJakartaSans(
          fontSize: 28,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.25,
          color: AppColors.neutral0,
          height: 1.29,
        ),
        headlineSmall: GoogleFonts.plusJakartaSans(
          fontSize: 24,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: AppColors.neutral0,
          height: 1.33,
        ),
        titleLarge: GoogleFonts.plusJakartaSans(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: 0,
          color: AppColors.neutral0,
          height: 1.27,
        ),
        titleMedium: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.15,
          color: AppColors.neutral100,
          height: 1.5,
        ),
        titleSmall: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
          color: AppColors.neutral200,
          height: 1.43,
        ),
        labelLarge: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
          color: AppColors.neutral100,
          height: 1.43,
        ),
        labelMedium: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: AppColors.neutral300,
          height: 1.33,
        ),
        labelSmall: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
          color: AppColors.neutral400,
          height: 1.45,
        ),
        bodyLarge: GoogleFonts.plusJakartaSans(
          fontSize: 16,
          fontWeight: FontWeight.w400,
          letterSpacing: 0.5,
          color: AppColors.neutral200,
          height: 1.5,
        ),
        bodyMedium: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w400,
          letterSpacing: 0.25,
          color: AppColors.neutral300,
          height: 1.43,
        ),
        bodySmall: GoogleFonts.plusJakartaSans(
          fontSize: 12,
          fontWeight: FontWeight.w400,
          letterSpacing: 0.4,
          color: AppColors.neutral400,
          height: 1.33,
        ),
      );

  // ── Wallet balance style (numeric, large) ─────────────────
  static TextStyle walletBalance({bool isDark = false}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
        color: AppColors.neutral0,
        height: 1.1,
      );

  // ── Amount / numeric display ──────────────────────────────
  static TextStyle amountLarge({Color? color}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.25,
        color: color ?? AppColors.neutral900,
      );

  // ── Transaction amount ────────────────────────────────────
  static TextStyle txAmount({required bool isCredit}) =>
      GoogleFonts.plusJakartaSans(
        fontSize: 15,
        fontWeight: FontWeight.w700,
        color: isCredit ? AppColors.success600 : AppColors.error600,
      );
}
