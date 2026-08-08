import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../providers/auth_provider.dart';

/// Recovery screen for someone who forgot their 6-digit login PIN. There's
/// no way to prove identity with the PIN itself, so this falls back to the
/// account password - on success the backend clears the old login PIN and
/// the app naturally lands on the "create your login PIN" screen, exactly
/// like a first-time login.
class ResetLoginPinScreen extends ConsumerStatefulWidget {
  const ResetLoginPinScreen({super.key, this.prefilledIdentifier});

  /// Pre-fills the email/phone field when we already know who this is
  /// (e.g. reached from the local unlock screen, where the session's user
  /// is already known). Left blank when reached from the login screen on
  /// an unrecognized device, since we may only have a partially-typed value.
  final String? prefilledIdentifier;

  @override
  ConsumerState<ResetLoginPinScreen> createState() =>
      _ResetLoginPinScreenState();
}

class _ResetLoginPinScreenState extends ConsumerState<ResetLoginPinScreen> {
  late final _identifierController =
      TextEditingController(text: widget.prefilledIdentifier ?? '');
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    context.hideKeyboard();
    if (!_formKey.currentState!.validate()) return;

    final success = await ref
        .read(authNotifierProvider.notifier)
        .resetLoginPinWithPassword(
          identifier: _identifierController.text.trim(),
          password: _passwordController.text,
        );

    if (!mounted) return;

    if (success) {
      context.showSnackBar(
        'Password confirmed. Create your new login PIN.',
      );
      // Router redirect handles navigation to the login-PIN setup screen
      // automatically once status flips to pinSetupRequired.
    } else {
      final error = ref.read(authNotifierProvider).errorMessage;
      context.showSnackBar(
        error ?? 'Something went wrong. Please try again.',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authNotifierProvider).isLoading;

    return Scaffold(
      appBar: AppBar(title: const Text('Reset login PIN')),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppColors.primary50,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(
                    Icons.lock_reset_rounded,
                    color: context.colors.primary,
                    size: 30,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Forgot your login PIN?',
                  style: context.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Enter your account password to confirm it\'s you, then '
                  'you\'ll be able to create a new 6-digit login PIN.',
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                ),
                const SizedBox(height: 32),
                KDTextField(
                  controller: _identifierController,
                  label: 'Email or phone',
                  keyboardType: TextInputType.emailAddress,
                  enabled: widget.prefilledIdentifier == null,
                  validator: (v) => (v == null || v.trim().length < 3)
                      ? 'Enter your email or phone'
                      : null,
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _passwordController,
                  label: 'Password',
                  obscureText: _obscurePassword,
                  suffixIcon: _obscurePassword
                      ? Icons.visibility_outlined
                      : Icons.visibility_off_outlined,
                  onSuffixTap: () =>
                      setState(() => _obscurePassword = !_obscurePassword),
                  validator: (v) => (v == null || v.isEmpty)
                      ? 'Enter your password'
                      : null,
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 28),
                SizedBox(
                  width: double.infinity,
                  child: KDButton(
                    label: 'Continue',
                    isLoading: isLoading,
                    onPressed: isLoading ? null : _submit,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
