import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../../core/config/app_endpoints.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/di/injection.dart';
import '../../../core/router/auth_status.dart';
import '../../../core/router/route_names.dart';
import '../../../core/utils/version_compare.dart';
import '../../auth/presentation/providers/auth_provider.dart';
import 'force_update_screen.dart';

class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  /// Returns true (and navigates to ForceUpdateScreen) if this build is
  /// below the backend's minimum required version. Returns false - meaning
  /// "proceed normally" - both when the version check passes AND whenever
  /// the check itself couldn't be completed (see _bootstrap's comment on
  /// why this fails open).
  Future<bool> _isBelowMinimumVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      final dio = ref.read(dioClientProvider);
      final response = await dio.get(AppEndpoints.appConfig);
      final data = response.data['data'] as Map<String, dynamic>;

      final minVersion = data['min_android_version'] as String?;
      if (minVersion == null) return false;

      if (!isBelowMinimumVersion(packageInfo.version, minVersion)) {
        return false;
      }

      if (!mounted) return true;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ForceUpdateScreen(
            downloadUrl: data['android_download_url'] as String? ??
                'https://github.com/DIGITAL-BRANDING/MAJOR-DATA-LINK/releases/latest/download/MajorDataLink.apk',
            latestVersion: data['latest_android_version'] as String?,
            message: data['update_message'] as String?,
          ),
        ),
      );
      return true;
    } catch (_) {
      // No internet, backend unreachable, unexpected response shape - fail
      // open, see _bootstrap's comment above this call.
      return false;
    }
  }

  Future<void> _bootstrap() async {
    // Allow splash to display for branding purposes
    await Future.delayed(const Duration(milliseconds: 1800));
    if (!mounted) return;

    // Force-update check runs first, before anything else touches auth or
    // onboarding state - an outdated build must never be allowed to reach
    // a screen that assumes it can send fields the backend now requires
    // (see ForceUpdateScreen's doc comment). Deliberately fails OPEN: if
    // this call fails for any reason (no internet, backend hiccup, a
    // malformed response), the user proceeds normally rather than being
    // stuck on a blank/frozen splash screen - a rare false negative here is
    // far better than blocking every legitimate user during a network
    // problem.
    if (await _isBelowMinimumVersion()) return;

    final secureStorage = ref.read(secureStorageProvider);
    final onboardingDone = await secureStorage.isOnboardingComplete();

    if (!onboardingDone) {
      if (mounted) context.go(RouteNames.onboarding);
      return;
    }

    // Check auth session
    final authNotifier = ref.read(authNotifierProvider.notifier);
    // Wait for the initial _checkSession() (kicked off when authNotifierProvider
    // was first read - possibly just now) to fully resolve. Reading `state`
    // any earlier would almost always see the pre-check default instead of
    // the real status - which is exactly how a PIN-locked session used to
    // slip through as if it were freshly unauthenticated.
    await authNotifier.ready;
    if (!mounted) return;

    final status = ref.read(authNotifierProvider).status;
    switch (status) {
      case AuthStatus.authenticated:
        context.go(RouteNames.home);
        return;
      case AuthStatus.pinLockRequired:
        context.go(RouteNames.loginPinUnlock);
        return;
      case AuthStatus.pinSetupRequired:
        context.go(RouteNames.pinSetup);
        return;
      case AuthStatus.transactionPinSetupRequired:
        context.go(RouteNames.transactionPinSetup);
        return;
      case AuthStatus.unauthenticated:
      case AuthStatus.loading:
        break;
    }

    // No usable session at all - try biometric auto-login if enabled,
    // otherwise fall through to the regular login screen.
    final loggedInViaBiometric = await authNotifier.tryBiometricLogin();
    if (!mounted) return;
    if (loggedInViaBiometric) {
      context.go(RouteNames.home);
    } else {
      context.go(RouteNames.login);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary600,
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary700,
              AppColors.primary500,
              AppColors.secondary600,
            ],
          ),
        ),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // ── Logo mark ─────────────────────────────────
              Container(
                    width: 112,
                    height: 112,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.15),
                          blurRadius: 30,
                          offset: const Offset(0, 12),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: Image.asset(
                        'assets/icon/logo.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  )
                  .animate()
                  .scale(
                    begin: const Offset(0.5, 0.5),
                    duration: 600.ms,
                    curve: Curves.easeOutBack,
                  )
                  .fadeIn(duration: 400.ms),

              const SizedBox(height: 24),

              Text(
                AppStrings.appName,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.3),

              const SizedBox(height: 8),

              Text(
                AppStrings.appTagline,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.8),
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ).animate().fadeIn(delay: 450.ms),

              const SizedBox(height: 64),

              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation(
                    Colors.white.withValues(alpha: 0.8),
                  ),
                ),
              ).animate().fadeIn(delay: 600.ms),
            ],
          ),
        ),
      ),
    );
  }
}
