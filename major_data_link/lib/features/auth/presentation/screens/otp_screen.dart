import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../providers/auth_provider.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({
    super.key,
    required this.destination,
    required this.mode,
    this.type = 'email',
  });

  final String destination;
  final String mode; // 'register' | 'login' | 'reset_password'
  final String type; // 'email' | 'phone'

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  Timer? _timer;
  int _secondsLeft = 60;
  bool _hasError = false;
  String _enteredOtp = '';

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startTimer() {
    _secondsLeft = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft == 0) {
        timer.cancel();
      } else {
        setState(() => _secondsLeft--);
      }
    });
  }

  Future<void> _handleResend() async {
    final success = await ref.read(authNotifierProvider.notifier).sendOtp(
          destination: widget.destination,
          purpose: widget.mode,
        );
    if (!mounted) return;
    if (success) {
      _startTimer();
      context.showSnackBar('OTP code resent');
    } else {
      context.showSnackBar('Failed to resend code', isError: true);
    }
  }

  Future<void> _handleVerify(String otp) async {
    setState(() {
      _enteredOtp = otp;
      _hasError = false;
    });

    final success = await ref.read(authNotifierProvider.notifier).verifyOtp(
          destination: widget.destination,
          otp: otp,
          purpose: widget.mode,
        );

    if (!mounted) return;

    if (success) {
      if (widget.mode == 'register') {
        // New users need to set up their PIN
        context.go(RouteNames.home);
      } else {
        context.go(RouteNames.home);
      }
    } else {
      setState(() => _hasError = true);
      context.showSnackBar(
        'Invalid OTP code. Please try again.',
        isError: true,
      );
    }
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
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
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
                  widget.type == 'email'
                      ? Icons.mark_email_unread_outlined
                      : Icons.sms_outlined,
                  size: 28,
                  color: context.colors.primary,
                ),
              ).animate().fadeIn().scale(curve: Curves.easeOutBack),

              const SizedBox(height: 24),

              Text(
                AppStrings.verifyOtp,
                style: context.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ).animate().fadeIn(delay: 100.ms),

              const SizedBox(height: 8),
              RichText(
                text: TextSpan(
                  style: context.textTheme.bodyMedium?.copyWith(
                    color: AppColors.neutral500,
                  ),
                  children: [
                    const TextSpan(text: AppStrings.otpSentTo),
                    TextSpan(
                      text: _maskedDestination,
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: context.isDark
                            ? AppColors.neutral100
                            : AppColors.neutral900,
                      ),
                    ),
                  ],
                ),
              ).animate().fadeIn(delay: 150.ms),

              const SizedBox(height: 40),

              Center(
                child: KDOtpInput(
                  hasError: _hasError,
                  onCompleted: _handleVerify,
                  onChanged: (v) {
                    if (_hasError) setState(() => _hasError = false);
                  },
                ),
              )
                  .animate()
                  .fadeIn(delay: 200.ms)
                  .scale(begin: const Offset(0.9, 0.9)),

              const SizedBox(height: 32),

              Center(
                child: _secondsLeft > 0
                    ? Text(
                        '${AppStrings.resendIn}'
                        '${_formatCountdown(_secondsLeft)}',
                        style: context.textTheme.bodyMedium?.copyWith(
                          color: AppColors.neutral500,
                        ),
                      )
                    : GestureDetector(
                        onTap: _handleResend,
                        child: Text(
                          AppStrings.resendCode,
                          style: TextStyle(
                            color: context.colors.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
              ).animate().fadeIn(delay: 250.ms),

              const Spacer(),

              KDButton(
                label: AppStrings.confirm,
                onPressed: _enteredOtp.length == 6
                    ? () => _handleVerify(_enteredOtp)
                    : null,
                isLoading: authState.isLoading,
                gradient: AppColors.primaryGradient,
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  String get _maskedDestination {
    if (widget.type != 'email') return _maskPhone(widget.destination);

    final parts = widget.destination.split('@');
    if (parts.length != 2 || parts.first.isEmpty) return widget.destination;

    final name = parts.first;
    final visibleName = name.length <= 2 ? name : name.substring(0, 2);
    return '$visibleName***@${parts.last}';
  }

  String _maskPhone(String phone) {
    if (phone.length < 7) return phone;
    return '${phone.substring(0, 4)}****${phone.substring(phone.length - 3)}';
  }

  String _formatCountdown(int seconds) {
    final minutes = seconds ~/ 60;
    final remainingSeconds = seconds % 60;
    return '$minutes:${remainingSeconds.toString().padLeft(2, '0')}';
  }
}
