import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../providers/auth_provider.dart';

/// App-lock screen shown on resume when a valid session + a local login
/// PIN both exist (AuthStatus.pinLockRequired). Verification is entirely
/// local - no server round trip - see AuthRepository.unlockWithLoginPin.
class LoginPinUnlockScreen extends ConsumerStatefulWidget {
  const LoginPinUnlockScreen({super.key});

  @override
  ConsumerState<LoginPinUnlockScreen> createState() =>
      _LoginPinUnlockScreenState();
}

class _LoginPinUnlockScreenState extends ConsumerState<LoginPinUnlockScreen> {
  bool _isLoading = false;
  bool _hasError = false;
  String? _errorText;
  bool _isLockedOut = false;
  final _shakeKey = UniqueKey();

  Future<void> _handlePinCompleted(String pin) async {
    setState(() => _isLoading = true);
    final result =
        await ref.read(authNotifierProvider.notifier).unlockWithPin(pin);
    if (!mounted) return;
    setState(() => _isLoading = false);

    result.fold(
      (failure) {
        setState(() {
          _hasError = true;
          if (failure is PinFailure && failure.code == 'PIN_LOCKED_OUT') {
            _isLockedOut = true;
            _errorText = AppStrings.loginPinLockedOut;
          } else if (failure is PinFailure && failure.attemptsLeft != null) {
            _errorText =
                'Incorrect PIN. ${failure.attemptsLeft} attempt(s) left.';
          } else {
            _errorText = failure.message;
          }
        });
      },
      (_) {}, // Notifier already flips status -> router redirects to Home
    );
  }

  Future<void> _logout() async {
    await ref.read(authNotifierProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);

    return PopScope(
      canPop: false,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: AppColors.primary50,
                  child: Icon(
                    Icons.lock_outline_rounded,
                    color: context.colors.primary,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  user != null
                      ? 'Welcome back, ${user.firstName}'
                      : 'Welcome back',
                  style: context.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  AppStrings.enterLoginPin,
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                ),
                const SizedBox(height: 40),
                if (_isLoading)
                  const CircularProgressIndicator()
                else if (!_isLockedOut)
                  KDPinInput(
                    key: ValueKey('unlock_$_hasError'),
                    length: 6,
                    hasError: _hasError,
                    errorShakeKey: _shakeKey,
                    onCompleted: _handlePinCompleted,
                    onChanged: (_) => setState(() {
                      _hasError = false;
                      _errorText = null;
                    }),
                  ),
                if (_errorText != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _errorText!,
                    style: context.textTheme.bodySmall?.copyWith(
                      color: context.colors.error,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
                const SizedBox(height: 32),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => context.push(
                    '${RouteNames.resetLoginPin}?identifier=${Uri.encodeComponent(user?.email ?? '')}',
                  ),
                  child: const Text('Forgot PIN?'),
                ),
                TextButton(
                  onPressed: _logout,
                  child: const Text('Not you? Log out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
