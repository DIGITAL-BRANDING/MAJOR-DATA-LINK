import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _identifierController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _rememberMe = false;
  bool _biometricAvailable = false;
  String _loginPin = '';

  @override
  void initState() {
    super.initState();
    _loadRememberedIdentifier();
    _checkBiometric();
  }

  Future<void> _loadRememberedIdentifier() async {
    final local = ref.read(authLocalDataSourceProvider);
    final saved = await local.getRememberedIdentifier();
    if (saved != null && mounted) {
      setState(() {
        _identifierController.text = saved;
        _rememberMe = true;
      });
    }
  }

  Future<void> _checkBiometric() async {
    final local = ref.read(authLocalDataSourceProvider);
    final biometricService = ref.read(biometricServiceProvider);
    final enabled = await local.isBiometricEnabled();
    final available = await biometricService.isAvailable();
    if (mounted) {
      setState(() => _biometricAvailable = enabled && available);
    }
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    context.hideKeyboard();
    if (!_formKey.currentState!.validate()) return;

    final needsPin = ref.read(authNotifierProvider).needsLoginPinForVerification;
    if (needsPin && _loginPin.length != 6) {
      context.showSnackBar(AppStrings.loginPinRequired, isError: true);
      return;
    }

    final success = await ref
        .read(authNotifierProvider.notifier)
        .login(
          identifier: _identifierController.text.trim(),
          password: _passwordController.text,
          loginPin: needsPin ? _loginPin : null,
          rememberMe: _rememberMe,
        );

    if (!mounted) return;

    if (success) {
      context.go(RouteNames.home);
    } else {
      final error = ref.read(authNotifierProvider).errorMessage;
      context.showSnackBar(
        error ?? AppStrings.somethingWentWrong,
        isError: true,
      );
    }
  }

  Future<void> _handleBiometricLogin() async {
    final success = await ref
        .read(authNotifierProvider.notifier)
        .tryBiometricLogin();
    if (!mounted) return;
    if (success) {
      context.go(RouteNames.home);
    } else {
      context.showSnackBar('Biometric authentication failed', isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 24),

                // ── Logo ────────────────────────────────────
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.neutral0,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary500.withValues(alpha: 0.16),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Padding(
                    padding: const EdgeInsets.all(4),
                    child: Image.asset(
                      'assets/icon/logo.png',
                      fit: BoxFit.contain,
                    ),
                  ),
                ).animate().fadeIn().scale(curve: Curves.easeOutBack),

                const SizedBox(height: 32),

                Text(
                  AppStrings.welcomeBack,
                  style: context.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ).animate().fadeIn(delay: 100.ms).slideX(begin: -0.05),

                const SizedBox(height: 6),
                Text(
                  AppStrings.loginSubtitle,
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                ).animate().fadeIn(delay: 150.ms),

                const SizedBox(height: 32),

                // ── Email/Phone field ───────────────────────
                KDTextField(
                  controller: _identifierController,
                  label: 'Email or phone number',
                  hint: 'you@example.com or 08012345678',
                  prefixIcon: Icons.person_outline_rounded,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.next,
                  autofillHints: const [AutofillHints.username],
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'Enter your email or phone number';
                    }
                    return null;
                  },
                ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                // ── Password field ──────────────────────────
                KDTextField(
                  controller: _passwordController,
                  label: AppStrings.passwordLabel,
                  hint: '••••••••',
                  prefixIcon: Icons.lock_outline_rounded,
                  obscureText: true,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.password],
                  onSubmitted: (_) => _handleLogin(),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter your password';
                    return null;
                  },
                ).animate().fadeIn(delay: 250.ms).slideY(begin: 0.1),

                if (authState.needsLoginPinForVerification) ...[
                  const SizedBox(height: 20),
                  Text(
                    'New device detected',
                    style: context.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: context.colors.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Enter your 6-digit login PIN to finish signing in',
                    style: context.textTheme.bodySmall?.copyWith(
                      color: AppColors.neutral500,
                    ),
                  ),
                  const SizedBox(height: 12),
                  KDPinInput(
                    length: 6,
                    autofocus: false,
                    onCompleted: (pin) => setState(() => _loginPin = pin),
                    onChanged: (pin) => _loginPin = pin,
                  ),
                ],

                const SizedBox(height: 12),

                // ── Remember me + Forgot password ───────────
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        SizedBox(
                          width: 22,
                          height: 22,
                          child: Checkbox(
                            value: _rememberMe,
                            onChanged: (v) =>
                                setState(() => _rememberMe = v ?? false),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          AppStrings.rememberMe,
                          style: context.textTheme.bodySmall,
                        ),
                      ],
                    ),
                    TextButton(
                      onPressed: () => context.push(RouteNames.forgotPassword),
                      child: Text(
                        AppStrings.forgotPassword,
                        style: TextStyle(
                          color: context.colors.primary,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ).animate().fadeIn(delay: 300.ms),

                const SizedBox(height: 12),

                // ── Login button ─────────────────────────────
                KDButton(
                  label: AppStrings.loginButton,
                  onPressed: _handleLogin,
                  isLoading: authState.isLoading,
                  gradient: AppColors.primaryGradient,
                ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.1),

                // ── Biometric login ──────────────────────────
                if (_biometricAvailable) ...[
                  const SizedBox(height: 16),
                  Center(
                    child: GestureDetector(
                      onTap: _handleBiometricLogin,
                      child: Container(
                        width: 56,
                        height: 56,
                        decoration: BoxDecoration(
                          color: AppColors.primary50,
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.primary100),
                        ),
                        child: Icon(
                          Icons.fingerprint_rounded,
                          size: 28,
                          color: context.colors.primary,
                        ),
                      ),
                    ),
                  ).animate().fadeIn(delay: 400.ms).scale(),
                ],

                const SizedBox(height: 32),

                // ── Sign up link ──────────────────────────────
                Center(
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        AppStrings.dontHaveAccount,
                        style: context.textTheme.bodyMedium,
                      ),
                      GestureDetector(
                        onTap: () => context.push(RouteNames.register),
                        child: Text(
                          AppStrings.signUp,
                          style: TextStyle(
                            color: context.colors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 450.ms),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
