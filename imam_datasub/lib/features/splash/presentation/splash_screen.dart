import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/di/injection.dart';
import '../../../core/router/auth_status.dart';
import '../../../core/router/route_names.dart';
import '../../auth/presentation/providers/auth_provider.dart';

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

  Future<void> _bootstrap() async {
    // Allow splash to display for branding purposes
    await Future.delayed(const Duration(milliseconds: 1800));
    if (!mounted) return;

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
