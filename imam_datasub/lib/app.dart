import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

// ── Theme mode provider ────────────────────────────────────
final themeModeProvider = StateProvider<ThemeMode>((_) => ThemeMode.system);

class ImamDatasubApp extends ConsumerWidget {
  const ImamDatasubApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    return ScreenUtilInit(
      designSize: const Size(390, 844), // iPhone 14 Pro design base
      minTextAdapt: true,
      splitScreenMode: true,
      builder: (context, child) {
        return MaterialApp.router(
          title: 'MAJOR DATA-LINK',
          debugShowCheckedModeBanner: false,

          // ── Themes ────────────────────────────────────────
          theme: AppTheme.light.copyWith(
            extensions: [KDThemeExtension.light],
          ),
          darkTheme: AppTheme.dark.copyWith(
            extensions: [KDThemeExtension.dark],
          ),
          themeMode: themeMode,

          // ── Router ────────────────────────────────────────
          routerConfig: router,

          // ── Locale ───────────────────────────────────────
          locale: const Locale('en', 'NG'),

          // ── Builder for global overlays ───────────────────
          builder: (context, child) {
            // Enforce text scale factor limits for accessibility
            final mediaQuery = MediaQuery.of(context);
            return MediaQuery(
              data: mediaQuery.copyWith(
                textScaler: TextScaler.linear(
                  mediaQuery.textScaler.scale(1.0).clamp(0.8, 1.3),
                ),
              ),
              child: child ?? const SizedBox.shrink(),
            );
          },
        );
      },
    );
  }
}
