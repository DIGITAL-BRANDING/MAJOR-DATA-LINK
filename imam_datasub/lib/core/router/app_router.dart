import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'route_names.dart';
import 'auth_status.dart';

// ── Screen imports ─────────────────────────────────────────
// Each will be created in their feature folder
import '../../features/splash/presentation/splash_screen.dart';
import '../../features/onboarding/presentation/onboarding_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/register_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/forgot_password_screen.dart';
import '../../features/auth/presentation/screens/set_login_pin_screen.dart';
import '../../features/auth/presentation/screens/login_pin_unlock_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/home/presentation/screens/main_shell.dart';
import '../../features/home/presentation/screens/services_screen.dart';
import '../../features/buy_data/presentation/screens/buy_data_screen.dart';
import '../../features/buy_airtime/presentation/screens/buy_airtime_screen.dart';
import '../../features/cable_tv/presentation/screens/cable_tv_screen.dart';
import '../../features/electricity/presentation/screens/electricity_screen.dart';
import '../../features/result_checker/presentation/screens/waec_screen.dart';
import '../../features/result_checker/presentation/screens/neco_screen.dart';
import '../../features/result_checker/presentation/screens/nabteb_screen.dart';
import '../../features/jamb/presentation/screens/jamb_screen.dart';
import '../../features/bulk_sms/presentation/screens/bulk_sms_screen.dart';
import '../../features/recharge_card/presentation/screens/recharge_card_screen.dart';
import '../../features/data_card/presentation/screens/data_card_screen.dart';
import '../../features/wallet/presentation/screens/wallet_screen.dart';
import '../../features/wallet/presentation/screens/fund_wallet_screen.dart';
import '../../features/transactions/presentation/screens/transactions_screen.dart';
import '../../features/transactions/presentation/screens/transaction_detail_screen.dart';
import '../../features/referral/presentation/screens/referral_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/profile/presentation/screens/edit_profile_screen.dart';
import '../../features/settings/presentation/screens/settings_screen.dart';
import '../../features/notifications/presentation/screens/notifications_screen.dart';
import '../../features/support/presentation/screens/support_screen.dart';
import '../../features/kyc/presentation/screens/kyc_screen.dart';
import '../../features/airtime_to_cash/presentation/screens/airtime_to_cash_screen.dart';
import '../../features/admin/presentation/screens/admin_data_pricing_screen.dart';
import '../../features/admin/presentation/screens/admin_dashboard_screen.dart';
import '../../features/admin/presentation/screens/admin_service_pricing_screen.dart';
import '../../features/admin/presentation/screens/admin_provider_balance_screen.dart';
import '../../features/admin/presentation/screens/admin_broadcast_screen.dart';
import '../../features/legal/presentation/screens/legal_document_screen.dart';
import '../di/injection.dart';

// ── Auth state ────────────────────────────────────────────
// Will be wired to the actual AuthProvider
final _isAuthenticated = false; // placeholder — replaced by provider

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: RouteNames.splash,
    debugLogDiagnostics: true,
    redirect: (context, state) => _guard(authState, state),
    routes: [
      // ── Splash ────────────────────────────────────────────
      GoRoute(
        path: RouteNames.splash,
        builder: (_, __) => const SplashScreen(),
      ),

      // ── Onboarding ────────────────────────────────────────
      GoRoute(
        path: RouteNames.onboarding,
        builder: (_, __) => const OnboardingScreen(),
      ),

      // ── Auth ──────────────────────────────────────────────
      GoRoute(
        path: RouteNames.login,
        pageBuilder: (_, state) => _slide(state, const LoginScreen()),
      ),
      GoRoute(
        path: RouteNames.register,
        pageBuilder: (_, state) => _slide(state, const RegisterScreen()),
      ),
      GoRoute(
        path: RouteNames.verifyOtp,
        builder: (_, state) {
          final destination =
              state.uri.queryParameters['destination'] ??
              state.uri.queryParameters['phone'] ??
              '';
          final mode = state.uri.queryParameters['mode'] ?? 'register';
          final type =
              state.uri.queryParameters['type'] ??
              (destination.contains('@') ? 'email' : 'phone');
          return OtpScreen(destination: destination, mode: mode, type: type);
        },
      ),
      GoRoute(
        path: RouteNames.forgotPassword,
        builder: (_, __) => const ForgotPasswordScreen(),
      ),

      // ── Login PIN (6-digit) ────────────────────────────────
      GoRoute(
        path: RouteNames.pinSetup,
        builder: (_, __) => const SetLoginPinScreen(),
      ),
      GoRoute(
        path: RouteNames.loginPinUnlock,
        builder: (_, __) => const LoginPinUnlockScreen(),
      ),

      // ── Main Shell (bottom nav) ───────────────────────────
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => MainShell(shell: shell),
        branches: [
          // Tab 0: Home
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RouteNames.home,
                builder: (_, __) => const HomeScreen(),
                routes: [
                  GoRoute(
                    path: 'notifications',
                    builder: (_, __) => const NotificationsScreen(),
                  ),
                  GoRoute(
                    path: 'wallet',
                    builder: (_, __) => const WalletScreen(),
                    routes: [
                      GoRoute(
                        path: 'fund',
                        builder: (_, __) => const FundWalletScreen(),
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),

          // Tab 1: Services
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RouteNames.services,
                builder: (_, __) => const ServicesScreen(),
                routes: [
                  GoRoute(
                    path: 'data',
                    pageBuilder: (_, state) =>
                        _slide(state, const BuyDataScreen()),
                  ),
                  GoRoute(
                    path: 'airtime',
                    pageBuilder: (_, state) =>
                        _slide(state, const BuyAirtimeScreen()),
                  ),
                  GoRoute(
                    path: 'airtime-to-cash',
                    builder: (_, __) => const AirtimeToCashScreen(),
                  ),
                  GoRoute(
                    path: 'cable',
                    builder: (_, __) => const CableTvScreen(),
                  ),
                  GoRoute(
                    path: 'electricity',
                    builder: (_, __) => const ElectricityScreen(),
                  ),
                  GoRoute(path: 'waec', builder: (_, __) => const WaecScreen()),
                  GoRoute(path: 'neco', builder: (_, __) => const NecoScreen()),
                  GoRoute(
                    path: 'nabteb',
                    builder: (_, __) => const NabtebScreen(),
                  ),
                  GoRoute(path: 'jamb', builder: (_, __) => const JambScreen()),
                  GoRoute(
                    path: 'bulk-sms',
                    builder: (_, __) => const BulkSmsScreen(),
                  ),
                  GoRoute(
                    path: 'recharge-card',
                    builder: (_, __) => const RechargeCardScreen(),
                  ),
                  GoRoute(
                    path: 'data-card',
                    builder: (_, __) => const DataCardScreen(),
                  ),
                ],
              ),
            ],
          ),

          // Tab 2: Transactions
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RouteNames.transactions,
                builder: (_, __) => const TransactionsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, state) => TransactionDetailScreen(
                      transactionId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),

          // Tab 3: Referrals
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RouteNames.referrals,
                builder: (_, __) => const ReferralScreen(),
              ),
            ],
          ),

          // Tab 4: Profile
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RouteNames.profile,
                builder: (_, __) => const ProfileScreen(),
                routes: [
                  GoRoute(
                    path: 'edit',
                    builder: (_, __) => const EditProfileScreen(),
                  ),
                  GoRoute(
                    path: 'settings',
                    builder: (_, __) => const SettingsScreen(),
                  ),
                  GoRoute(
                    path: 'password',
                    builder: (_, __) => const ChangePasswordScreen(),
                  ),
                  GoRoute(
                    path: 'pin',
                    builder: (_, __) => const ChangePinScreen(),
                  ),
                  GoRoute(
                    path: 'login-pin',
                    builder: (_, __) => const ChangeLoginPinScreen(),
                  ),
                  GoRoute(
                    path: 'security',
                    builder: (_, __) => const SecurityScreen(),
                  ),
                  GoRoute(path: 'kyc', builder: (_, __) => const KycScreen()),
                  GoRoute(
                    path: 'support',
                    builder: (_, __) => const SupportScreen(),
                  ),
                  GoRoute(
                    path: 'admin',
                    builder: (_, __) => const AdminDashboardScreen(),
                  ),
                  GoRoute(
                    path: 'admin/data-pricing',
                    builder: (_, __) => const AdminDataPricingScreen(),
                  ),
                  GoRoute(
                    path: 'admin/service-pricing',
                    builder: (_, __) => const AdminServicePricingScreen(),
                  ),
                  GoRoute(
                    path: 'admin/provider-balance',
                    builder: (_, __) => const AdminProviderBalanceScreen(),
                  ),
                  GoRoute(
                    path: 'admin/broadcast',
                    builder: (_, __) => const AdminBroadcastScreen(),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),

      GoRoute(
        path: RouteNames.privacyPolicy,
        builder: (_, __) =>
            const LegalDocumentScreen(type: LegalDocumentType.privacy),
      ),
      GoRoute(
        path: RouteNames.terms,
        builder: (_, __) =>
            const LegalDocumentScreen(type: LegalDocumentType.terms),
      ),

      // ── Purchase Success (modal-style, any flow) ──────────
      GoRoute(
        path: RouteNames.purchaseSuccess,
        pageBuilder: (_, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return _fade(state, PurchaseSuccessScreen(data: extra));
        },
      ),
    ],

    errorBuilder: (_, state) => _NotFoundScreen(error: state.error),
  );
});

// ── Auth Guard ────────────────────────────────────────────
String? _guard(AsyncValue<AuthStatus> authState, GoRouterState state) {
  final location = state.matchedLocation;

  // Public routes — no guard needed
  const publicRoutes = [
    RouteNames.splash,
    RouteNames.onboarding,
    RouteNames.login,
    RouteNames.register,
    RouteNames.verifyOtp,
    RouteNames.forgotPassword,
    RouteNames.privacyPolicy,
    RouteNames.terms,
  ];
  if (publicRoutes.contains(location)) return null;

  return authState.when(
    data: (status) {
      switch (status) {
        case AuthStatus.authenticated:
          // Don't let a fully authenticated user linger on the PIN
          // setup/unlock screens (e.g. after a hot restart mid-flow).
          if (location == RouteNames.pinSetup ||
              location == RouteNames.loginPinUnlock) {
            return RouteNames.home;
          }
          return null;
        case AuthStatus.pinSetupRequired:
          return location == RouteNames.pinSetup ? null : RouteNames.pinSetup;
        case AuthStatus.pinLockRequired:
          return location == RouteNames.loginPinUnlock
              ? null
              : RouteNames.loginPinUnlock;
        case AuthStatus.unauthenticated:
        case AuthStatus.loading:
          return RouteNames.login;
      }
    },
    loading: () => null, // Stay on current screen during load
    error: (_, __) => RouteNames.login,
  );
}

// ── Page transitions ──────────────────────────────────────
CustomTransitionPage<void> _slide(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionsBuilder: (_, animation, secondaryAnimation, child) {
      return SlideTransition(
        position: Tween<Offset>(begin: const Offset(1.0, 0.0), end: Offset.zero)
            .animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            ),
        child: child,
      );
    },
    transitionDuration: const Duration(milliseconds: 280),
  );
}

CustomTransitionPage<void> _fade(GoRouterState state, Widget child) {
  return CustomTransitionPage<void>(
    key: state.pageKey,
    child: child,
    transitionsBuilder: (_, animation, __, child) {
      return FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeIn),
        child: child,
      );
    },
    transitionDuration: const Duration(milliseconds: 300),
  );
}

// ── 404 screen ─────────────────────────────────────────────
class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen({this.error});
  final Exception? error;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(
              'Page not found',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 24),
            TextButton(
              onPressed: () => context.go(RouteNames.home),
              child: const Text('Go home'),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Placeholder for purchase success (wired up in feature) ─
class PurchaseSuccessScreen extends StatelessWidget {
  const PurchaseSuccessScreen({super.key, required this.data});
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: Text('Purchase Success')));
}

// AuthStatus enum is defined in auth_status.dart to prevent circular imports
