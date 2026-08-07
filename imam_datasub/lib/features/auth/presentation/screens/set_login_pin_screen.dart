import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../providers/auth_provider.dart';

/// Mandatory 6-digit login PIN creation screen. Shown right after a
/// successful login/register when the account has no login PIN yet
/// (AuthStatus.pinSetupRequired). There is no skip and no way back -
/// the user must create a PIN before reaching Home.
class SetLoginPinScreen extends ConsumerStatefulWidget {
  const SetLoginPinScreen({super.key});

  @override
  ConsumerState<SetLoginPinScreen> createState() => _SetLoginPinScreenState();
}

class _SetLoginPinScreenState extends ConsumerState<SetLoginPinScreen> {
  String _firstPin = '';
  int _step = 0; // 0 = create, 1 = confirm
  bool _isLoading = false;
  bool _hasError = false;

  Future<void> _handlePinCompleted(String pin) async {
    if (_step == 0) {
      setState(() {
        _firstPin = pin;
        _step = 1;
      });
      return;
    }

    if (pin != _firstPin) {
      setState(() {
        _hasError = true;
        _step = 0;
        _firstPin = '';
      });
      context.showSnackBar(AppStrings.pinMismatch, isError: true);
      return;
    }

    setState(() => _isLoading = true);
    final success = await ref
        .read(authNotifierProvider.notifier)
        .completeLoginPinSetup(pin);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      context.showSnackBar(AppStrings.loginPinCreated);
      // Router redirect handles navigation to Home automatically once
      // status flips to authenticated.
    } else {
      final error = ref.read(authNotifierProvider).errorMessage;
      setState(() {
        _hasError = true;
        _step = 0;
        _firstPin = '';
      });
      if (error != null) context.showSnackBar(error, isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary50,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(
                    Icons.lock_person_outlined,
                    color: context.colors.primary,
                    size: 34,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  _step == 0
                      ? AppStrings.createLoginPin
                      : AppStrings.confirmLoginPin,
                  style: context.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _step == 0
                      ? AppStrings.createLoginPinSubtitle
                      : 'Re-enter your 6-digit PIN to confirm',
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                if (_isLoading)
                  const CircularProgressIndicator()
                else
                  KDPinInput(
                    key: ValueKey('login_pin_step_$_step'),
                    length: 6,
                    hasError: _hasError,
                    onCompleted: _handlePinCompleted,
                    onChanged: (_) => setState(() => _hasError = false),
                  ),
                const SizedBox(height: 32),
                Text(
                  'You\'ll use this PIN to log in on this device from now '
                  'on. On a new device, you\'ll need your password and this '
                  'PIN together.',
                  style: context.textTheme.bodySmall?.copyWith(
                    color: AppColors.neutral400,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
