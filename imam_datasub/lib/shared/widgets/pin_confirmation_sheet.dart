import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/security/biometric_service.dart';
import '../../core/di/injection.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import 'kd_button.dart';
import 'kd_pin_input.dart';

/// Shows the PIN confirmation sheet and returns true if PIN was verified,
/// false if cancelled or verification failed after retries exhausted.
Future<bool> showPinConfirmationSheet({
  required BuildContext context,
  required WidgetRef ref,
  String title = 'Confirm transaction',
  String subtitle = 'Enter your 4-digit PIN to continue',
  bool allowBiometric = true,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: true,
    builder: (_) => _PinConfirmationSheet(
      title: title,
      subtitle: subtitle,
      allowBiometric: allowBiometric,
    ),
  );
  return result ?? false;
}

class _PinConfirmationSheet extends ConsumerStatefulWidget {
  const _PinConfirmationSheet({
    required this.title,
    required this.subtitle,
    required this.allowBiometric,
  });

  final String title;
  final String subtitle;
  final bool allowBiometric;

  @override
  ConsumerState<_PinConfirmationSheet> createState() =>
      _PinConfirmationSheetState();
}

class _PinConfirmationSheetState extends ConsumerState<_PinConfirmationSheet> {
  bool _isVerifying = false;
  bool _hasError = false;
  String? _errorMessage;
  Key _shakeKey = UniqueKey();

  @override
  void initState() {
    super.initState();
    if (widget.allowBiometric) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
    }
  }

  Future<void> _tryBiometric() async {
    final local = ref.read(authLocalDataSourceProvider);
    final isEnabled = await local.isBiometricEnabled();
    if (!isEnabled) return;

    final biometricService = ref.read(biometricServiceProvider);
    final available = await biometricService.isAvailable();
    if (!available) return;

    final result = await biometricService.authenticate(
      title: 'Confirm transaction',
      subtitle: 'Use biometric to authorize this purchase',
    );

    if (result == BiometricResult.success && mounted) {
      Navigator.of(context).pop(true);
    }
  }

  Future<void> _verifyPin(String pin) async {
    setState(() {
      _isVerifying = true;
      _hasError = false;
      _errorMessage = null;
    });

    final useCase = ref.read(verifyTransactionPinUseCaseProvider);
    final result = await useCase.call(pin: pin);

    if (!mounted) return;

    result.fold(
      (failure) {
        setState(() {
          _isVerifying = false;
          _hasError = true;
          _errorMessage = failure.message;
          _shakeKey = UniqueKey();
        });
      },
      (isValid) {
        if (isValid) {
          Navigator.of(context).pop(true);
        } else {
          setState(() {
            _isVerifying = false;
            _hasError = true;
            _errorMessage = 'Incorrect PIN. Please try again.';
            _shakeKey = UniqueKey();
          });
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      // SafeArea + SingleChildScrollView: this sheet's content height isn't
      // fixed - it grows when the error message or the verifying spinner
      // appears. On shorter screens (or when those extra bits show up at the
      // same time), the fixed-size Column below can end up needing more
      // vertical space than the sheet is given, which used to throw
      // "A RenderFlex overflowed ... on the bottom". Scrolling instead of
      // overflowing keeps every device/state combination safe.
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Container(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
            decoration: const BoxDecoration(
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppDimensions.bottomSheetRadius),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.neutral300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),

            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.primary50,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.lock_outline_rounded,
                color: Theme.of(context).colorScheme.primary,
                size: 26,
              ),
            ),

            const SizedBox(height: 16),

            Text(
              widget.title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.subtitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
            ),

            const SizedBox(height: 28),

            KDPinInput(
              key: ValueKey(_shakeKey),
              length: 4,
              hasError: _hasError,
              errorShakeKey: _shakeKey,
              onCompleted: _verifyPin,
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.error,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],

            if (_isVerifying) ...[
              const SizedBox(height: 20),
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ],

            const SizedBox(height: 20),

            if (widget.allowBiometric)
              TextButton.icon(
                onPressed: _tryBiometric,
                icon: const Icon(Icons.fingerprint_rounded, size: 20),
                label: const Text('Use biometric instead'),
              ),

            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                'Cancel',
                style: TextStyle(color: AppColors.neutral500),
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
