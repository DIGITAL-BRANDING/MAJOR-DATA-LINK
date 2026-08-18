import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/security/secure_screen_mixin.dart';
import '../../core/di/injection.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import 'kd_button.dart';
import 'kd_pin_input.dart';

/// Shows the PIN confirmation sheet and returns the verified 4-digit PIN on
/// success, or null if cancelled or verification failed after the user gave
/// up retrying.
///
/// Returns the PIN itself (not just a bool) because the backend now
/// requires that same PIN again, directly in the purchase request body
/// (POST /data/purchase, /airtime/purchase, etc - see requirePinConfirmation
/// in the backend's require-pin.ts). Before that backend change, this sheet
/// calling POST /user/pin/verify and the actual purchase call that followed
/// it were two completely disconnected requests - nothing stopped a client
/// from skipping this sheet entirely and calling the purchase endpoint
/// directly with no PIN at all. Every caller of this function MUST now
/// include the returned PIN in its purchase request, or that request will
/// be rejected server-side.
///
/// No biometric shortcut here anymore, unlike this sheet's previous
/// version - a biometric match has nothing to send the server as the
/// verified secret (the app only ever stores a one-way HASH of the PIN
/// locally, specifically so a plain PIN is never sitting on-device in a
/// reversible form). Biometric unlock for the app itself is unaffected -
/// see login_pin_unlock_screen.dart - only this money-moving-confirmation
/// sheet requires the actual PIN to be typed, every time.
Future<String?> showPinConfirmationSheet({
  required BuildContext context,
  required WidgetRef ref,
  String title = 'Confirm transaction',
  String subtitle = 'Enter your 4-digit PIN to continue',
}) async {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    isDismissible: true,
    builder: (_) => _PinConfirmationSheet(title: title, subtitle: subtitle),
  );
}

class _PinConfirmationSheet extends ConsumerStatefulWidget {
  const _PinConfirmationSheet({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  ConsumerState<_PinConfirmationSheet> createState() =>
      _PinConfirmationSheetState();
}

class _PinConfirmationSheetState extends ConsumerState<_PinConfirmationSheet>
    with SecureScreenMixin {
  bool _isVerifying = false;
  bool _hasError = false;
  String? _errorMessage;
  Key _shakeKey = UniqueKey();

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
          // The server just independently confirmed this exact PIN is
          // correct (via POST /user/pin/verify) - safe to hand back to the
          // caller, who will send it again with the actual purchase.
          Navigator.of(context).pop(pin);
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

            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
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
