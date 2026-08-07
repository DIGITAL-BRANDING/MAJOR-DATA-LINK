import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/utils/formatters.dart';

class WalletCard extends StatelessWidget {
  const WalletCard({
    super.key,
    required this.balance,
    required this.name,
    required this.accountNumber,
    required this.isBalanceHidden,
    required this.onToggleBalance,
    required this.onFund,
    this.onTransfer,
    this.isLoading = false,
  });

  final double balance;
  final String name;
  final String accountNumber;
  final bool isBalanceHidden;
  final VoidCallback onToggleBalance;
  final VoidCallback onFund;
  // Nullable: when null, the Transfer button is hidden entirely (e.g. on the
  // home dashboard, where transfer-to-another-user was intentionally removed).
  final VoidCallback? onTransfer;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Container(
          height: AppDimensions.walletCardHeight,
          margin: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
          decoration: BoxDecoration(
            gradient: AppColors.walletGradient,
            borderRadius: BorderRadius.circular(AppDimensions.walletCardRadius),
            boxShadow: [
              BoxShadow(
                color: AppColors.primary500.withValues(alpha: 0.4),
                blurRadius: 24,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(AppDimensions.walletCardRadius),
            child: Stack(
              children: [
                // ── Background circles (decoration) ────────────
                Positioned(
                  top: -40,
                  right: -30,
                  child: Container(
                    width: 160,
                    height: 160,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.glassWhite,
                    ),
                  ),
                ),
                Positioned(
                  bottom: -50,
                  left: -20,
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.glassWhite,
                    ),
                  ),
                ),

                // ── Glassmorphism overlay ──────────────────────
                BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 0, sigmaY: 0),
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          Colors.white.withValues(alpha: 0.05),
                          Colors.transparent,
                        ],
                      ),
                      border: Border.all(
                        color: AppColors.glassBorder,
                        width: 0.5,
                      ),
                      borderRadius: BorderRadius.circular(
                        AppDimensions.walletCardRadius,
                      ),
                    ),
                  ),
                ),

                // ── Card Content ───────────────────────────────
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top row: label + settings icon
                      Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Wallet balance',
                                  style: TextStyle(
                                    color: AppColors.neutral0.withValues(
                                      alpha: 0.7,
                                    ),
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  name,
                                  style: const TextStyle(
                                    color: AppColors.neutral0,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          // MAJOR DATA-LINK logo mark
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: AppColors.neutral0,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: AppColors.glassBorder,
                                width: 0.5,
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Padding(
                              padding: const EdgeInsets.all(2),
                              child: Image.asset(
                                'assets/icon/logo.png',
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const Spacer(),

                      // Balance
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(
                            child: AnimatedSwitcher(
                              duration: const Duration(milliseconds: 300),
                              transitionBuilder: (child, animation) =>
                                  FadeTransition(
                                    opacity: animation,
                                    child: child,
                                  ),
                              child: isLoading
                                  ? Container(
                                      key: const ValueKey('loading'),
                                      height: 36,
                                      width: 160,
                                      decoration: BoxDecoration(
                                        color: AppColors.glassWhite,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                    )
                                  : isBalanceHidden
                                  ? Text(
                                      key: const ValueKey('hidden'),
                                      '₦ ●●●●●●',
                                      style: const TextStyle(
                                        color: AppColors.neutral0,
                                        fontSize: 28,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 2,
                                      ),
                                    )
                                  : Text(
                                      key: const ValueKey('shown'),
                                      AppFormatters.formatAmount(balance),
                                      style: const TextStyle(
                                        color: AppColors.neutral0,
                                        fontSize: 28,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                            ),
                          ),
                          // Toggle visibility
                          GestureDetector(
                            onTap: onToggleBalance,
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: AppColors.glassWhite,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                isBalanceHidden
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                color: AppColors.neutral0,
                                size: 18,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 4),
                      Text(
                        'Acct: ${AppFormatters.maskAccountNumber(accountNumber)}',
                        style: TextStyle(
                          color: AppColors.neutral0.withValues(alpha: 0.6),
                          fontSize: 12,
                        ),
                      ),

                      const Spacer(),

                      // Bottom row: action buttons
                      Row(
                        children: [
                          _ActionButton(
                            icon: Icons.add_rounded,
                            label: 'Add money',
                            onTap: onFund,
                          ),
                          if (onTransfer != null) ...[
                            const SizedBox(width: 12),
                            _ActionButton(
                              icon: Icons.swap_horiz_rounded,
                              label: 'Transfer',
                              onTap: onTransfer!,
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        )
        .animate()
        .fadeIn(duration: 500.ms)
        .slideY(begin: 0.1, curve: Curves.easeOutCubic);
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.glassWhite,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.glassBorder, width: 0.5),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: AppColors.neutral0, size: 14),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppColors.neutral0,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
