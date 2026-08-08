import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../constants/app_colors.dart';
import 'color_scheme.dart';
import 'text_theme.dart';

class AppTheme {
  AppTheme._();

  // ── Light Theme ───────────────────────────────────────────
  static ThemeData get light => ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        colorScheme: KDColorScheme.light,
        textTheme: KDTextTheme.lightTextTheme,
        scaffoldBackgroundColor: AppColors.lightBackground,

        // ── AppBar ──────────────────────────────────────────
        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.lightSurface,
          foregroundColor: AppColors.neutral900,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          shadowColor: AppColors.neutral200,
          centerTitle: false,
          titleTextStyle: KDTextTheme.lightTextTheme.titleLarge!.copyWith(
            color: AppColors.neutral900,
          ),
          systemOverlayStyle: const SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.dark,
            statusBarBrightness: Brightness.light,
            systemNavigationBarColor: AppColors.lightSurface,
            systemNavigationBarIconBrightness: Brightness.dark,
          ),
          iconTheme: const IconThemeData(
            color: AppColors.neutral800,
            size: 24,
          ),
          actionsIconTheme: const IconThemeData(
            color: AppColors.neutral700,
            size: 24,
          ),
        ),

        // ── Bottom Navigation Bar ────────────────────────────
        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: AppColors.lightSurface,
          selectedItemColor: AppColors.primary500,
          unselectedItemColor: AppColors.neutral400,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
          showSelectedLabels: true,
          showUnselectedLabels: true,
        ),

        // ── Navigation Bar (Material 3) ──────────────────────
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.lightSurface,
          indicatorColor: AppColors.primary100,
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: AppColors.primary600, size: 24);
            }
            return const IconThemeData(color: AppColors.neutral400, size: 24);
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return KDTextTheme.lightTextTheme.labelSmall!.copyWith(
                color: AppColors.primary600,
                fontWeight: FontWeight.w600,
              );
            }
            return KDTextTheme.lightTextTheme.labelSmall!.copyWith(
              color: AppColors.neutral400,
            );
          }),
          elevation: 0,
          height: 65,
          surfaceTintColor: Colors.transparent,
        ),

        // ── Card ─────────────────────────────────────────────
        cardTheme: CardThemeData(
          color: AppColors.lightCardSurface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AppColors.neutral200, width: 0.5),
          ),
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
        ),

        // ── Elevated Button ───────────────────────────────────
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary500,
            foregroundColor: AppColors.neutral0,
            disabledBackgroundColor: AppColors.primary200,
            disabledForegroundColor: AppColors.neutral0,
            elevation: 0,
            shadowColor: Colors.transparent,
            minimumSize: const Size(double.infinity, 56),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            textStyle: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),

        // ── Outlined Button ───────────────────────────────────
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primary500,
            side: const BorderSide(color: AppColors.primary500, width: 1.5),
            minimumSize: const Size(double.infinity, 56),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            textStyle: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),

        // ── Text Button ───────────────────────────────────────
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            foregroundColor: AppColors.primary500,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            textStyle: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),

        // ── Input Decoration ──────────────────────────────────
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.lightSurfaceVariant,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.neutral200, width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.primary500, width: 1.5),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.error500, width: 1),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: AppColors.error500, width: 1.5),
          ),
          hintStyle: KDTextTheme.lightTextTheme.bodyMedium!.copyWith(
            color: AppColors.neutral400,
          ),
          labelStyle: KDTextTheme.lightTextTheme.bodyMedium!.copyWith(
            color: AppColors.neutral600,
          ),
          floatingLabelStyle: KDTextTheme.lightTextTheme.labelMedium!.copyWith(
            color: AppColors.primary500,
          ),
          prefixIconColor: AppColors.neutral500,
          suffixIconColor: AppColors.neutral500,
          errorStyle: KDTextTheme.lightTextTheme.bodySmall!.copyWith(
            color: AppColors.error600,
          ),
        ),

        // ── Chip ──────────────────────────────────────────────
        chipTheme: ChipThemeData(
          backgroundColor: AppColors.primary50,
          selectedColor: AppColors.primary500,
          disabledColor: AppColors.neutral100,
          labelStyle: KDTextTheme.lightTextTheme.labelMedium!,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          side: BorderSide.none,
        ),

        // ── Dialog ────────────────────────────────────────────
        dialogTheme: DialogThemeData(
          backgroundColor: AppColors.lightSurface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          titleTextStyle: KDTextTheme.lightTextTheme.headlineSmall,
          contentTextStyle: KDTextTheme.lightTextTheme.bodyMedium,
        ),

        // ── Bottom Sheet ──────────────────────────────────────
        bottomSheetTheme: const BottomSheetThemeData(
          backgroundColor: AppColors.lightSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          elevation: 0,
          dragHandleSize: Size(40, 4),
          dragHandleColor: AppColors.neutral300,
          showDragHandle: true,
        ),

        // ── Divider ───────────────────────────────────────────
        dividerTheme: const DividerThemeData(
          color: AppColors.neutral200,
          thickness: 0.5,
          space: 0,
        ),

        // ── List Tile ─────────────────────────────────────────
        listTileTheme: ListTileThemeData(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          titleTextStyle: KDTextTheme.lightTextTheme.titleSmall,
          subtitleTextStyle: KDTextTheme.lightTextTheme.bodySmall,
          iconColor: AppColors.neutral600,
        ),

        // ── Switch ────────────────────────────────────────────
        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.neutral0;
            }
            return AppColors.neutral400;
          }),
          trackColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primary500;
            }
            return AppColors.neutral200;
          }),
          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
        ),

        // ── Checkbox ─────────────────────────────────────────
        checkboxTheme: CheckboxThemeData(
          fillColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primary500;
            }
            return Colors.transparent;
          }),
          checkColor: WidgetStateProperty.all(AppColors.neutral0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(4),
          ),
          side: const BorderSide(color: AppColors.neutral300, width: 1.5),
        ),

        // ── Floating Action Button ────────────────────────────
        floatingActionButtonTheme: const FloatingActionButtonThemeData(
          backgroundColor: AppColors.primary500,
          foregroundColor: AppColors.neutral0,
          elevation: 4,
          shape: CircleBorder(),
        ),

        // ── Snack Bar ─────────────────────────────────────────
        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppColors.neutral900,
          contentTextStyle: KDTextTheme.lightTextTheme.bodyMedium!.copyWith(
            color: AppColors.neutral0,
          ),
          actionTextColor: AppColors.primary300,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 4,
        ),

        // ── Progress Indicator ────────────────────────────────
        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: AppColors.primary500,
          circularTrackColor: AppColors.primary100,
          linearTrackColor: AppColors.primary100,
        ),

        // ── Tab Bar ───────────────────────────────────────────
        tabBarTheme: TabBarThemeData(
          labelColor: AppColors.primary500,
          unselectedLabelColor: AppColors.neutral500,
          indicator: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: AppColors.primary500,
                width: 2,
              ),
            ),
          ),
          labelStyle: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
            fontSize: 14,
          ),
          unselectedLabelStyle: KDTextTheme.lightTextTheme.labelLarge!.copyWith(
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          dividerColor: AppColors.neutral200,
        ),

        // ── Icon ─────────────────────────────────────────────
        iconTheme: const IconThemeData(
          color: AppColors.neutral700,
          size: 24,
        ),

        // ── Popup Menu ─────────────────────────────────────────
        popupMenuTheme: PopupMenuThemeData(
          color: AppColors.lightSurface,
          elevation: 8,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: KDTextTheme.lightTextTheme.bodyMedium,
          shadowColor: const Color(0x1A000000),
        ),

        // ── Page Transitions ─────────────────────────────────
        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            TargetPlatform.android: ZoomPageTransitionsBuilder(),
            TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          },
        ),
      );

  // ── Dark Theme ────────────────────────────────────────────
  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: KDColorScheme.dark,
        textTheme: KDTextTheme.darkTextTheme,
        scaffoldBackgroundColor: AppColors.darkBackground,

        appBarTheme: AppBarTheme(
          backgroundColor: AppColors.darkBackground,
          foregroundColor: AppColors.neutral0,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          shadowColor: AppColors.neutral900,
          centerTitle: false,
          titleTextStyle: KDTextTheme.darkTextTheme.titleLarge!.copyWith(
            color: AppColors.neutral0,
          ),
          systemOverlayStyle: const SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: Brightness.light,
            statusBarBrightness: Brightness.dark,
            systemNavigationBarColor: AppColors.darkNavBar,
            systemNavigationBarIconBrightness: Brightness.light,
          ),
          iconTheme: const IconThemeData(color: AppColors.neutral200, size: 24),
          actionsIconTheme:
              const IconThemeData(color: AppColors.neutral300, size: 24),
        ),

        bottomNavigationBarTheme: const BottomNavigationBarThemeData(
          backgroundColor: AppColors.darkNavBar,
          selectedItemColor: AppColors.primary400,
          unselectedItemColor: AppColors.neutral600,
          elevation: 0,
          type: BottomNavigationBarType.fixed,
        ),

        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: AppColors.darkNavBar,
          indicatorColor: AppColors.primary800,
          iconTheme: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return const IconThemeData(color: AppColors.primary300, size: 24);
            }
            return const IconThemeData(color: AppColors.neutral600, size: 24);
          }),
          labelTextStyle: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return KDTextTheme.darkTextTheme.labelSmall!.copyWith(
                color: AppColors.primary300,
                fontWeight: FontWeight.w600,
              );
            }
            return KDTextTheme.darkTextTheme.labelSmall!.copyWith(
              color: AppColors.neutral600,
            );
          }),
          elevation: 0,
          height: 65,
          surfaceTintColor: Colors.transparent,
        ),

        cardTheme: CardThemeData(
          color: AppColors.darkCardSurface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AppColors.darkDivider, width: 0.5),
          ),
          margin: EdgeInsets.zero,
          clipBehavior: Clip.antiAlias,
        ),

        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary400,
            foregroundColor: AppColors.neutral0,
            disabledBackgroundColor: AppColors.primary800,
            elevation: 0,
            shadowColor: Colors.transparent,
            minimumSize: const Size(double.infinity, 56),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            textStyle: KDTextTheme.darkTextTheme.labelLarge!.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),

        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.primary300,
            side: const BorderSide(color: AppColors.primary400, width: 1.5),
            minimumSize: const Size(double.infinity, 56),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),

        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.darkSurfaceVariant,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.darkDivider, width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.primary400, width: 1.5),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide:
                const BorderSide(color: AppColors.error400, width: 1),
          ),
          hintStyle: KDTextTheme.darkTextTheme.bodyMedium!.copyWith(
            color: AppColors.neutral600,
          ),
          labelStyle: KDTextTheme.darkTextTheme.bodyMedium!.copyWith(
            color: AppColors.neutral400,
          ),
          prefixIconColor: AppColors.neutral500,
          suffixIconColor: AppColors.neutral500,
        ),

        chipTheme: ChipThemeData(
          backgroundColor: AppColors.darkSurfaceVariant,
          selectedColor: AppColors.primary700,
          labelStyle: KDTextTheme.darkTextTheme.labelMedium!,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          side: BorderSide.none,
        ),

        dialogTheme: DialogThemeData(
          backgroundColor: AppColors.darkSurface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(24),
          ),
          titleTextStyle: KDTextTheme.darkTextTheme.headlineSmall,
          contentTextStyle: KDTextTheme.darkTextTheme.bodyMedium,
        ),

        bottomSheetTheme: const BottomSheetThemeData(
          backgroundColor: AppColors.darkSurface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          ),
          elevation: 0,
          dragHandleColor: AppColors.neutral700,
          showDragHandle: true,
        ),

        dividerTheme: const DividerThemeData(
          color: AppColors.darkDivider,
          thickness: 0.5,
          space: 0,
        ),

        switchTheme: SwitchThemeData(
          thumbColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.neutral0;
            }
            return AppColors.neutral600;
          }),
          trackColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected)) {
              return AppColors.primary400;
            }
            return AppColors.neutral700;
          }),
          trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
        ),

        snackBarTheme: SnackBarThemeData(
          backgroundColor: AppColors.neutral800,
          contentTextStyle: KDTextTheme.darkTextTheme.bodyMedium!.copyWith(
            color: AppColors.neutral0,
          ),
          actionTextColor: AppColors.primary300,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),

        progressIndicatorTheme: const ProgressIndicatorThemeData(
          color: AppColors.primary400,
          circularTrackColor: AppColors.primary800,
        ),

        iconTheme: const IconThemeData(
          color: AppColors.neutral300,
          size: 24,
        ),

        pageTransitionsTheme: const PageTransitionsTheme(
          builders: {
            TargetPlatform.android: ZoomPageTransitionsBuilder(),
            TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          },
        ),
      );
}

// ── Theme Extensions ──────────────────────────────────────────
// For custom properties not covered by Material 3
@immutable
class KDThemeExtension extends ThemeExtension<KDThemeExtension> {
  const KDThemeExtension({
    required this.walletCardGradient,
    required this.successColor,
    required this.warningColor,
    required this.shimmerBaseColor,
    required this.shimmerHighlightColor,
    required this.cardBorderColor,
    required this.navBarColor,
    required this.glassColor,
  });

  final LinearGradient walletCardGradient;
  final Color successColor;
  final Color warningColor;
  final Color shimmerBaseColor;
  final Color shimmerHighlightColor;
  final Color cardBorderColor;
  final Color navBarColor;
  final Color glassColor;

  static const KDThemeExtension light = KDThemeExtension(
    walletCardGradient: AppColors.walletGradient,
    successColor: AppColors.success500,
    warningColor: AppColors.warning500,
    shimmerBaseColor: AppColors.shimmerBase,
    shimmerHighlightColor: AppColors.shimmerHighlight,
    cardBorderColor: AppColors.neutral200,
    navBarColor: AppColors.lightSurface,
    glassColor: AppColors.glassWhite,
  );

  static const KDThemeExtension dark = KDThemeExtension(
    walletCardGradient: AppColors.walletGradient,
    successColor: AppColors.success400,
    warningColor: AppColors.warning400,
    shimmerBaseColor: AppColors.shimmerBaseDark,
    shimmerHighlightColor: AppColors.shimmerHighlightDark,
    cardBorderColor: AppColors.darkDivider,
    navBarColor: AppColors.darkNavBar,
    glassColor: AppColors.glassDark,
  );

  @override
  KDThemeExtension copyWith({
    LinearGradient? walletCardGradient,
    Color? successColor,
    Color? warningColor,
    Color? shimmerBaseColor,
    Color? shimmerHighlightColor,
    Color? cardBorderColor,
    Color? navBarColor,
    Color? glassColor,
  }) {
    return KDThemeExtension(
      walletCardGradient: walletCardGradient ?? this.walletCardGradient,
      successColor: successColor ?? this.successColor,
      warningColor: warningColor ?? this.warningColor,
      shimmerBaseColor: shimmerBaseColor ?? this.shimmerBaseColor,
      shimmerHighlightColor:
          shimmerHighlightColor ?? this.shimmerHighlightColor,
      cardBorderColor: cardBorderColor ?? this.cardBorderColor,
      navBarColor: navBarColor ?? this.navBarColor,
      glassColor: glassColor ?? this.glassColor,
    );
  }

  @override
  KDThemeExtension lerp(KDThemeExtension? other, double t) {
    if (other == null) return this;
    return KDThemeExtension(
      walletCardGradient: walletCardGradient,
      successColor: Color.lerp(successColor, other.successColor, t)!,
      warningColor: Color.lerp(warningColor, other.warningColor, t)!,
      shimmerBaseColor:
          Color.lerp(shimmerBaseColor, other.shimmerBaseColor, t)!,
      shimmerHighlightColor:
          Color.lerp(shimmerHighlightColor, other.shimmerHighlightColor, t)!,
      cardBorderColor: Color.lerp(cardBorderColor, other.cardBorderColor, t)!,
      navBarColor: Color.lerp(navBarColor, other.navBarColor, t)!,
      glassColor: Color.lerp(glassColor, other.glassColor, t)!,
    );
  }
}