import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../providers/auth_provider.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _emailSent = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    context.hideKeyboard();
    if (!_formKey.currentState!.validate()) return;

    final result = await ref
        .read(forgotPasswordUseCaseProvider)
        .call(email: _emailController.text.trim());

    if (!mounted) return;

    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (_) => setState(() => _emailSent = true),
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
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
          child: _emailSent ? _buildSuccessState(context) : _buildFormState(context),
        ),
      ),
    );
  }

  Widget _buildFormState(BuildContext context) {
    return Form(
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
              Icons.lock_reset_rounded,
              size: 28,
              color: context.colors.primary,
            ),
          ).animate().fadeIn().scale(curve: Curves.easeOutBack),

          const SizedBox(height: 24),
          Text(
            'Forgot password?',
            style: context.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ).animate().fadeIn(delay: 100.ms),

          const SizedBox(height: 8),
          Text(
            'Enter your email address and we will send you a link to reset your password.',
            style: context.textTheme.bodyMedium?.copyWith(
              color: AppColors.neutral500,
            ),
          ).animate().fadeIn(delay: 150.ms),

          const SizedBox(height: 32),

          KDTextField(
            controller: _emailController,
            label: 'Email address',
            hint: 'you@example.com',
            prefixIcon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            autofillHints: const [AutofillHints.email],
            validator: AppValidators.email,
            onSubmitted: (_) => _handleSubmit(),
          ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.1),

          const SizedBox(height: 28),

          KDButton(
            label: 'Send reset link',
            onPressed: _handleSubmit,
            isLoading: ref.watch(authNotifierProvider).isLoading,
            gradient: AppColors.primaryGradient,
          ).animate().fadeIn(delay: 250.ms).slideY(begin: 0.1),
        ],
      ),
    );
  }

  Widget _buildSuccessState(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            color: AppColors.success50,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.mark_email_read_rounded,
            size: 44,
            color: AppColors.success600,
          ),
        ).animate().scale(curve: Curves.easeOutBack),

        const SizedBox(height: 24),
        Text(
          'Check your email',
          style: context.textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ).animate().fadeIn(delay: 100.ms),

        const SizedBox(height: 8),
        Text(
          'We sent a password reset link to\n${_emailController.text}',
          textAlign: TextAlign.center,
          style: context.textTheme.bodyMedium?.copyWith(
            color: AppColors.neutral500,
          ),
        ).animate().fadeIn(delay: 150.ms),

        const SizedBox(height: 32),
        KDOutlinedButton(
          label: 'Back to sign in',
          onPressed: () => context.go('/login'),
        ).animate().fadeIn(delay: 200.ms),
      ],
    );
  }
}
