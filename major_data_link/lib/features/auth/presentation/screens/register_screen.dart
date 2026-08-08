import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../providers/auth_provider.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _referralController = TextEditingController();
  bool _agreedToTerms = false;

  @override
  void initState() {
    super.initState();
    _prefillReferralCode();
  }

  /// Picks up the referral code main.dart's _capturePendingReferralCode
  /// stashed on first launch, if this install came from a /ref/CODE link.
  /// One-time use - cleared immediately after reading so it doesn't
  /// resurface if the user backs out and lands on this screen again later
  /// with a code they've since typed over or deliberately cleared.
  Future<void> _prefillReferralCode() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString('kd_pending_referral_code');
    if (code == null || code.isEmpty) return;

    await prefs.remove('kd_pending_referral_code');
    if (!mounted) return;
    setState(() => _referralController.text = code);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _referralController.dispose();
    super.dispose();
  }

  Future<void> _handleRegister() async {
    context.hideKeyboard();
    if (!_formKey.currentState!.validate()) return;

    if (!_agreedToTerms) {
      context.showSnackBar(
        'Please agree to the Terms of Service to continue',
        isError: true,
      );
      return;
    }

    final result = await ref.read(authNotifierProvider.notifier).register(
          fullName: _nameController.text.trim(),
          email: _emailController.text.trim(),
          phone: _phoneController.text.trim(),
          password: _passwordController.text,
          referralCode: _referralController.text.trim().isEmpty
              ? null
              : _referralController.text.trim(),
        );

    if (!mounted) return;

    await result.fold<Future<void>>(
      (failure) async => context.showSnackBar(failure.message, isError: true),
      (_) async {
        context.showSnackBar('Account created successfully');
        context.go(RouteNames.home);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppStrings.createAccount,
                  style: context.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ).animate().fadeIn().slideX(begin: -0.05),
                const SizedBox(height: 6),
                Text(
                  AppStrings.registerSubtitle,
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                ).animate().fadeIn(delay: 50.ms),

                const SizedBox(height: 28),

                KDTextField(
                  controller: _nameController,
                  label: AppStrings.fullNameLabel,
                  hint: 'John Doe',
                  prefixIcon: Icons.person_outline_rounded,
                  textCapitalization: TextCapitalization.words,
                  autofillHints: const [AutofillHints.name],
                  validator: AppValidators.fullName,
                ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                KDTextField(
                  controller: _emailController,
                  label: AppStrings.emailLabel,
                  hint: 'you@example.com',
                  prefixIcon: Icons.email_outlined,
                  keyboardType: TextInputType.emailAddress,
                  autofillHints: const [AutofillHints.email],
                  validator: AppValidators.email,
                ).animate().fadeIn(delay: 150.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                KDPhoneField(
                  controller: _phoneController,
                  validator: AppValidators.phone,
                ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                KDTextField(
                  controller: _passwordController,
                  label: AppStrings.passwordLabel,
                  hint: 'At least 8 characters',
                  prefixIcon: Icons.lock_outline_rounded,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: AppValidators.password,
                ).animate().fadeIn(delay: 250.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                KDTextField(
                  controller: _confirmPasswordController,
                  label: AppStrings.confirmPasswordLabel,
                  hint: 'Re-enter your password',
                  prefixIcon: Icons.lock_outline_rounded,
                  obscureText: true,
                  validator: (v) => AppValidators.confirmPassword(
                    v,
                    _passwordController.text,
                  ),
                ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                KDTextField(
                  controller: _referralController,
                  label: 'Referral code (optional)',
                  hint: 'KD123ABC',
                  prefixIcon: Icons.card_giftcard_outlined,
                  textCapitalization: TextCapitalization.characters,
                ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.1),

                const SizedBox(height: 20),

                // ── Terms checkbox ───────────────────────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 22,
                      height: 22,
                      child: Checkbox(
                        value: _agreedToTerms,
                        onChanged: (v) =>
                            setState(() => _agreedToTerms = v ?? false),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: RichText(
                          text: TextSpan(
                            style: context.textTheme.bodySmall,
                            children: [
                              const TextSpan(text: 'I agree to the '),
                              TextSpan(
                                text: 'Terms of Service',
                                style: TextStyle(
                                  color: context.colors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const TextSpan(text: ' and '),
                              TextSpan(
                                text: 'Privacy Policy',
                                style: TextStyle(
                                  color: context.colors.primary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ).animate().fadeIn(delay: 400.ms),

                const SizedBox(height: 24),

                KDButton(
                  label: AppStrings.registerButton,
                  onPressed: _handleRegister,
                  isLoading: authState.isLoading,
                  gradient: AppColors.primaryGradient,
                ).animate().fadeIn(delay: 450.ms).slideY(begin: 0.1),

                const SizedBox(height: 24),

                Center(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        AppStrings.alreadyHaveAccount,
                        style: context.textTheme.bodyMedium,
                      ),
                      GestureDetector(
                        onTap: () => context.pop(),
                        child: Text(
                          AppStrings.signIn,
                          style: TextStyle(
                            color: context.colors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ).animate().fadeIn(delay: 500.ms),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
