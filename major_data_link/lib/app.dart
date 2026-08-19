import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/di/injection.dart';
import 'features/auth/presentation/providers/auth_provider.dart';
import 'features/notifications/presentation/providers/notification_provider.dart';

// ── Theme mode provider ────────────────────────────────────
// The product default is a premium black-and-gold experience. Users may
// still switch to the light theme from Settings when they prefer it.
final themeModeProvider = StateProvider<ThemeMode>((ref) {
  final prefersDark =
      ref
          .read(hiveStorageProvider)
          .getSetting<bool>('dark_mode', defaultValue: true) ??
      true;
  return prefersDark ? ThemeMode.dark : ThemeMode.light;
});

class MajorDataLinkApp extends ConsumerStatefulWidget {
  const MajorDataLinkApp({super.key});

  @override
  ConsumerState<MajorDataLinkApp> createState() => _MajorDataLinkAppState();
}

class _MajorDataLinkAppState extends ConsumerState<MajorDataLinkApp> {
  late final ProviderSubscription<bool> _authSubscription;

  @override
  void initState() {
    super.initState();
    // Firebase tokens are owned by a signed-in user on the API. Initialising
    // before authentication makes token registration return 401 (and it was
    // previously never initialised at all), leaving broadcasts with no device
    // tokens to target. Register once whenever this app session becomes
    // authenticated, including PIN/biometric unlock after a cold start.
    _authSubscription = ref.listenManual<bool>(isAuthenticatedProvider, (
      wasAuthenticated,
      isAuthenticated,
    ) {
      if (isAuthenticated && wasAuthenticated != true) {
        unawaited(ref.read(fcmServiceProvider).initialize());
      }
    }, fireImmediately: true);
  }

  @override
  void dispose() {
    _authSubscription.close();
    super.dispose();
  }

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
          theme: AppTheme.light.copyWith(extensions: [KDThemeExtension.light]),
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
