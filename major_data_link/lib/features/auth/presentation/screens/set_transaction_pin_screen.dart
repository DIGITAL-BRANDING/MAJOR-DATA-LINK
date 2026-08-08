import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../providers/auth_provider.dart';

/// Mandatory 4-digit transaction PIN creation screen (wallet
/// confirm/balance/delete). Shown right after login/register when the
/// account has no transaction PIN yet (AuthStatus.transactionPinSetupRequired)
/// - for a brand new account this follows straight after the login PIN
/// setup screen. There is no skip and no way back.
class SetTransactionPinScreen extends ConsumerStatefulWidget {
  const SetTransactionPinScreen({super.key});

  @override
  ConsumerState<SetTransactionPinScreen> createState() =>
      _SetTransactionPinScreenState();
}

class _SetTransactionPinScreenState
    extends ConsumerState<SetTransactionPinScreen> {
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
        .completeTransactionPinSetup(pin);
    if (!mounted) return;
    setState(() => _isLoading = false);

    if (success) {
      context.showSnackBar(AppStrings.pinCreated);
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
                    Icons.pin_outlined,
                    color: context.colors.primary,
                    size: 34,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  _step == 0 ? AppStrings.createPin : AppStrings.confirmPin,
                  style: context.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  _step == 0
                      ? 'Choose a 4-digit PIN to confirm wallet funding, view your balance, and deactivate/delete your account'
                      : 'Re-enter your 4-digit PIN to confirm',
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
                    key: ValueKey('transaction_pin_step_$_step'),
                    length: 4,
                    hasError: _hasError,
                    onCompleted: _handlePinCompleted,
                    onChanged: (_) => setState(() => _hasError = false),
                  ),
                const SizedBox(height: 32),
                Text(
                  'This is different from your login PIN - you\'ll be '
                  'asked for it whenever you fund your wallet, check your '
                  'balance, or manage your account.',
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
