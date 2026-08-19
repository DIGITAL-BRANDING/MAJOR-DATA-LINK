import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
      // The public version check gets one short attempt only. It must never
      // keep a customer on splash while an unavailable server retries.
      final response = await dio
          .get(
            AppEndpoints.appConfig,
            options: Options(extra: {'skipAuth': true, 'skipRetry': true}),
          )
          .timeout(const Duration(seconds: 4));
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
            downloadUrl:
                data['android_download_url'] as String? ??
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
    // Force-update check and the session check are independent of each
    // other - neither needs the other's result to start - so they're
    // kicked off together and awaited together instead of one after the
    // other. Combined with the shorter timeouts in AppConfig, this is what
    // brings worst-case boot time down from "two sequential ~130s-worst-case
    // network calls" to roughly one.
    //
    // Reading authNotifierProvider here (rather than later, after the
    // version check resolves) is what actually starts _checkSession() at
    // the same moment as the version check - its constructor fires that
    // call immediately - so both requests are genuinely in flight together,
    // not just awaited together after the fact.
    final authNotifier = ref.read(authNotifierProvider.notifier);

    // All three are *started* here, before anything is awaited - that's
    // what makes them run concurrently. (Deliberately not passed to
    // Future.wait: mixing a Future<bool> with two Future<void>s there would
    // need Dart to unify their type parameter, which is unnecessary risk
    // for zero benefit over just awaiting each variable in turn below.)
    final versionCheck = _isBelowMinimumVersion();
    final sessionCheck = authNotifier.ready;
    // The 1800ms floor keeps the branding visible for a moment even on a
    // fast connection where the real work finishes in a blink - but unlike
    // before, it no longer ADDS to slow-network wait time, since it runs
    // alongside the real work rather than before it.
    final splashFloor = Future<void>.delayed(
      const Duration(milliseconds: 1800),
    );

    final blockedByForceUpdate = await versionCheck;
    try {
      await sessionCheck.timeout(const Duration(seconds: 4));
    } on TimeoutException {
      // Continue through the normal auth-status routing below. A network
      // profile request must not make startup feel frozen.
    }
    await splashFloor;
    if (!mounted) return;
    if (blockedByForceUpdate) return;

    final secureStorage = ref.read(secureStorageProvider);
    final onboardingDone = await secureStorage.isOnboardingComplete();

    if (!onboardingDone) {
      if (mounted) context.go(RouteNames.onboarding);
      return;
    }

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
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.neutral950,
      ),
      child: Scaffold(
        backgroundColor: AppColors.neutral950,
        body: Container(
          decoration: const BoxDecoration(gradient: AppColors.premiumGradient),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // ── Logo mark ─────────────────────────────────
                Container(
                      width: 112,
                      height: 112,
                      decoration: BoxDecoration(
                        color: AppColors.neutral50,
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary400.withValues(alpha: 0.35),
                            blurRadius: 36,
                            spreadRadius: 2,
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
      ),
    );
  }
}
