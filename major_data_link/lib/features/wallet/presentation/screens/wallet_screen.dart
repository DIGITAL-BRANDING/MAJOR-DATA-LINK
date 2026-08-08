import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/wallet_card.dart';
import '../providers/wallet_provider.dart';

class WalletScreen extends ConsumerWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletAsync = ref.watch(walletNotifierProvider);
    final balanceHidden = ref.watch(balanceVisibilityProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Wallet')),
      body: SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(walletNotifierProvider.notifier).refresh(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 16),
                walletAsync.when(
                  loading: () => const WalletCardShimmer(),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (wallet) => WalletCard(
                    balance: wallet.totalBalance,
                    name: '',
                    accountNumber: wallet.virtualAccountNumber ?? '----------',
                    isBalanceHidden: balanceHidden,
                    onToggleBalance: () =>
                        ref.read(balanceVisibilityProvider.notifier).state =
                            !balanceHidden,
                    onFund: () => context.push(RouteNames.fundWallet),
                  ),
                ),

                const SizedBox(height: 28),

                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Actions', style: context.textTheme.titleSmall),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          _ActionCard(
                            icon: Icons.add_circle_outline_rounded,
                            label: 'Add Money',
                            color: AppColors.success500,
                            onTap: () => context.push(RouteNames.fundWallet),
                          ),
                        ],
                      ),

                      const SizedBox(height: 28),

                      // ── Virtual account ──────────────────────
                      walletAsync.whenData((wallet) {
                            if (wallet.virtualAccountNumber == null) {
                              return const SizedBox.shrink();
                            }
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Virtual account',
                                  style: context.textTheme.titleSmall,
                                ),
                                const SizedBox(height: 12),
                                KDCard(
                                  child: Column(
                                    children: [
                                      _AccountRow(
                                        label: 'Bank',
                                        value: wallet.virtualAccountBank ?? '',
                                      ),
                                      const Divider(height: 16),
                                      _AccountRow(
                                        label: 'Account number',
                                        value: wallet.virtualAccountNumber!,
                                        showCopy: true,
                                        onCopy: () {
                                          Clipboard.setData(
                                            ClipboardData(
                                              text:
                                                  wallet.virtualAccountNumber!,
                                            ),
                                          );
                                          context.showSnackBar(
                                            'Account number copied',
                                          );
                                        },
                                      ),
                                      const Divider(height: 16),
                                      _AccountRow(
                                        label: 'Account name',
                                        value: wallet.virtualAccountName ?? '',
                                      ),
                                    ],
                                  ),
                                ).animate().fadeIn(delay: 200.ms),
                                const SizedBox(height: 12),
                                KDCard(
                                  backgroundColor: AppColors.primary50,
                                  border: Border.all(
                                    color: AppColors.primary100,
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.info_outline_rounded,
                                        color: context.colors.primary,
                                        size: 18,
                                      ),
                                      const SizedBox(width: 8),
                                      Expanded(
                                        child: Text(
                                          'Transfer any amount to this account to fund your wallet instantly. Minimum: ₦100.',
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: context.colors.primary,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          }).value ??
                          const SizedBox.shrink(),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: color.withValues(alpha: 0.2)),
          ),
          child: Column(
            children: [
              Icon(icon, color: color, size: 26),
              const SizedBox(height: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: color,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({
    required this.label,
    required this.value,
    this.showCopy = false,
    this.onCopy,
  });
  final String label;
  final String value;
  final bool showCopy;
  final VoidCallback? onCopy;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: context.textTheme.bodySmall),
        Row(
          children: [
            Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (showCopy) ...[
              const SizedBox(width: 8),
              GestureDetector(
                onTap: onCopy,
                child: Icon(
                  Icons.copy_rounded,
                  size: 16,
                  color: context.colors.primary,
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}
