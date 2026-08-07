import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:lottie/lottie.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/router/route_names.dart';
import '../../core/utils/extensions.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/receipt_service.dart';
import 'kd_button.dart';
import 'kd_receipt.dart';

class PurchaseSuccessView extends StatelessWidget {
  const PurchaseSuccessView({
    super.key,
    required this.title,
    required this.amount,
    required this.reference,
    required this.details,
    this.balanceAfter,
    this.onBuyAgain,
  });

  final String title;
  final double amount;
  final String reference;
  final List<MapEntry<String, String>> details;
  final double? balanceAfter;
  final VoidCallback? onBuyAgain;

  ReceiptData get _receiptData => ReceiptData(
        title: title,
        amount: amount,
        reference: reference,
        date: DateTime.now(),
        status: 'Successful',
        details: details,
        balanceAfter: balanceAfter,
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
          child: Column(
            children: [
              const Spacer(),

              // ── Success Animation ──────────────────────────
              SizedBox(
                width: 140,
                height: 140,
                child: Lottie.asset(
                  'assets/animations/success.json',
                  repeat: false,
                  errorBuilder: (_, __, ___) => Container(
                    decoration: const BoxDecoration(
                      color: AppColors.success50,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_circle_rounded,
                      color: AppColors.success500,
                      size: 80,
                    ),
                  ),
                ),
              ).animate().scale(curve: Curves.easeOutBack, duration: 500.ms),

              const SizedBox(height: 16),

              Text(
                'Purchase successful!',
                style: context.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ).animate().fadeIn(delay: 200.ms),

              const SizedBox(height: 6),

              Text(
                title,
                textAlign: TextAlign.center,
                style: context.textTheme.bodyMedium?.copyWith(
                  color: AppColors.neutral500,
                ),
              ).animate().fadeIn(delay: 250.ms),

              const SizedBox(height: 24),

              // ── Receipt Card ────────────────────────────────
              KDReceiptCard(
                title: title,
                amount: amount,
                reference: reference,
                date: DateTime.now(),
                status: 'Successful',
                details: details,
                balanceAfter: balanceAfter,
              ).animate().fadeIn(delay: 300.ms).slideY(begin: 0.1),

              const SizedBox(height: 16),

              // ── Share / Download ─────────────────────────────
              Row(
                children: [
                  Expanded(
                    child: KDOutlinedButton(
                      label: 'Share',
                      icon: Icons.share_outlined,
                      onPressed: () => ReceiptService.shareReceipt(_receiptData),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: KDOutlinedButton(
                      label: 'Download',
                      icon: Icons.download_outlined,
                      onPressed: () =>
                          ReceiptService.downloadReceipt(_receiptData),
                    ),
                  ),
                ],
              ).animate().fadeIn(delay: 350.ms),

              const Spacer(),

              // ── Bottom actions ──────────────────────────────
              if (onBuyAgain != null) ...[
                KDButton(
                  label: 'Buy again',
                  onPressed: onBuyAgain,
                  gradient: AppColors.primaryGradient,
                ),
                const SizedBox(height: 12),
              ],
              KDOutlinedButton(
                label: 'Go to home',
                onPressed: () => context.go(RouteNames.home),
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
