import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../providers/auth_provider.dart';

/// Second half of the "forgot password" flow - reached from
/// ForgotPasswordScreen's success state once the 6-digit code has been
/// emailed. Takes the code + a new password and calls
/// resetPasswordUseCaseProvider to finish the reset.
class ResetPasswordScreen extends ConsumerStatefulWidget {
  const ResetPasswordScreen({super.key, required this.email});

  final String email;

  @override
  ConsumerState<ResetPasswordScreen> createState() =>
      _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends ConsumerState<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  String _code = '';
  bool _codeHasError = false;
  bool _isSubmitting = false;
  bool _isResending = false;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    context.hideKeyboard();
    if (_code.length != 6) {
      setState(() => _codeHasError = true);
      context.showSnackBar('Enter the 6-digit code from your email', isError: true);
      return;
    }
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final result = await ref.read(resetPasswordUseCaseProvider).call(
          email: widget.email,
          token: _code,
          newPassword: _passwordController.text,
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    result.fold(
      (failure) {
        setState(() => _codeHasError = true);
        context.showSnackBar(failure.message, isError: true);
      },
      (_) {
        context.showSnackBar('Password reset. Sign in with your new password.');
        context.go(RouteNames.login);
      },
    );
  }

  Future<void> _handleResend() async {
    setState(() => _isResending = true);
    final result = await ref
        .read(forgotPasswordUseCaseProvider)
        .call(email: widget.email);
    if (!mounted) return;
    setState(() => _isResending = false);

    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (_) => context.showSnackBar('A new code has been sent to ${widget.email}'),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                const SizedBox(height: 8),
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.primary50,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(
                    Icons.mark_email_read_outlined,
                    size: 28,
                    color: context.colors.primary,
                  ),
                ).animate().fadeIn().scale(curve: Curves.easeOutBack),

                const SizedBox(height: 24),
                Text(
                  'Enter your code',
                  style: context.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ).animate().fadeIn(delay: 100.ms),

                const SizedBox(height: 8),
                Text(
                  'We sent a 6-digit code to ${widget.email}. It expires in 10 minutes.',
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                ).animate().fadeIn(delay: 150.ms),

                const SizedBox(height: 32),

                Center(
                  child: KDOtpInput(
                    hasError: _codeHasError,
                    onChanged: (value) {
                      setState(() {
                        _code = value;
                        if (_codeHasError) _codeHasError = false;
                      });
                    },
                    onCompleted: (value) => setState(() => _code = value),
                  ),
                ).animate().fadeIn(delay: 200.ms).scale(begin: const Offset(0.9, 0.9)),

                const SizedBox(height: 16),

                Center(
                  child: TextButton(
                    onPressed: _isResending ? null : _handleResend,
                    child: Text(
                      _isResending ? 'Sending…' : "Didn't get a code? Resend",
                      style: TextStyle(
                        color: context.colors.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ).animate().fadeIn(delay: 250.ms),

                const SizedBox(height: 16),

                KDTextField(
                  controller: _passwordController,
                  label: 'New password',
                  hint: 'At least 8 characters',
                  prefixIcon: Icons.lock_outline_rounded,
                  obscureText: true,
                  autofillHints: const [AutofillHints.newPassword],
                  validator: AppValidators.password,
                ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),

                const SizedBox(height: 16),

                KDTextField(
                  controller: _confirmPasswordController,
                  label: 'Confirm new password',
                  hint: 'Re-enter your new password',
                  prefixIcon: Icons.lock_outline_rounded,
                  obscureText: true,
                  validator: (v) => AppValidators.confirmPassword(
                    v,
                    _passwordController.text,
                  ),
                  onSubmitted: (_) => _handleSubmit(),
                ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.1),

                const SizedBox(height: 28),

                KDButton(
                  label: 'Reset password',
                  onPressed: _handleSubmit,
                  isLoading: _isSubmitting,
                  gradient: AppColors.primaryGradient,
                ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.1),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
