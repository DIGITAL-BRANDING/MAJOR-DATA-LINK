import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/validators.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../providers/referral_provider.dart';
import '../../domain/entities/referral_entity.dart';

class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(referralStatsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Referrals')),
      body: SafeArea(
        top: false,
        child: statsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(AppDimensions.screenPaddingH),
            child: ListItemShimmer(count: 5),
          ),
          error: (e, _) => KDErrorState(
            message: 'Could not load referral data',
            onRetry: () => ref.invalidate(referralStatsProvider),
          ),
          data: (stats) => RefreshIndicator(
            onRefresh: () => ref.refresh(referralStatsProvider.future),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ── Hero stats ──────────────────────────────
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      gradient: AppColors.walletGradient,
                      borderRadius:
                          BorderRadius.circular(AppDimensions.radiusXXL),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary500.withValues(alpha: 0.3),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Total earnings',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          AppFormatters.formatAmount(stats.totalEarned),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            _StatPill(
                              label: 'Referrals',
                              value: '${stats.totalReferrals}',
                            ),
                            const SizedBox(width: 12),
                            _StatPill(
                              label: 'Pending',
                              value: AppFormatters.formatAmount(
                                  stats.pendingCommission),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ).animate().fadeIn().slideY(begin: 0.1),

                  const SizedBox(height: 24),

                  // ── Referral link ───────────────────────────
                  Text('Your referral link',
                      style: context.textTheme.titleSmall),
                  const SizedBox(height: 10),
                  KDCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                stats.shareLink,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 13,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                Clipboard.setData(
                                    ClipboardData(text: stats.shareLink));
                                context.showSnackBar(
                                    'Referral link copied!');
                              },
                              child: Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: AppColors.primary50,
                                  borderRadius:
                                      BorderRadius.circular(8),
                                ),
                                child: Icon(Icons.copy_rounded,
                                    size: 18,
                                    color: context.colors.primary),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                              vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.primary50,
                            borderRadius:
                                BorderRadius.circular(8),
                          ),
                          child: Center(
                            child: Text(
                              stats.referralCode,
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 3,
                                color: context.colors.primary,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        KDButton(
                          label: 'Share referral link',
                          icon: Icons.share_rounded,
                          onPressed: () => Share.share(
                            'Join MAJOR DATA-LINK and get cheap data & bills! Use my code ${stats.referralCode} to sign up:\n${stats.shareLink}',
                            subject: 'Join MAJOR DATA-LINK',
                          ),
                          gradient: AppColors.primaryGradient,
                          height: AppDimensions.buttonHeightMD,
                        ),
                      ],
                    ),
                  ).animate().fadeIn(delay: 100.ms).slideY(begin: 0.1),

                  const SizedBox(height: 24),

                  // ── Withdraw commission ─────────────────────
                  if (stats.pendingCommission > 0) ...[
                    KDCard(
                      backgroundColor: AppColors.success50,
                      border: Border.all(color: AppColors.success100),
                      child: Row(
                        children: [
                          const Icon(Icons.monetization_on_rounded,
                              color: AppColors.success600),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Text(
                                  AppFormatters.formatAmount(
                                      stats.pendingCommission),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 18,
                                    color: AppColors.success700,
                                  ),
                                ),
                                const Text(
                                  'Available to withdraw',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.success600),
                                ),
                              ],
                            ),
                          ),
                          KDSmallButton(
                            label: 'Withdraw',
                            backgroundColor: AppColors.success600,
                            foregroundColor: Colors.white,
                            onPressed: () => _showWithdrawSheet(
                                context, ref, stats.pendingCommission,
                                stats.minWithdrawal),
                          ),
                        ],
                      ),
                    ).animate().fadeIn(delay: 150.ms),
                    const SizedBox(height: 24),
                  ],

                  // ── Referee list ────────────────────────────
                  if (stats.referees.isNotEmpty) ...[
                    Text('My referrals (${stats.totalReferrals})',
                        style: context.textTheme.titleSmall),
                    const SizedBox(height: 10),
                    ...stats.referees
                        .asMap()
                        .entries
                        .map((e) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _RefereeTile(
                                  referee: e.value, index: e.key),
                            )),
                  ] else ...[
                    KDEmptyState(
                      title: 'No referrals yet',
                      message:
                          'Share your link and earn ${AppFormatters.formatPercent(2)} on every transaction your referrals make.',
                      icon: Icons.people_outline_rounded,
                    ),
                  ],

                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showWithdrawSheet(BuildContext context, WidgetRef ref,
      double available, double minWithdrawal) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _WithdrawSheet(
          available: available, ref: ref, minWithdrawal: minWithdrawal),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: const TextStyle(color: Colors.white70, fontSize: 11)),
          const SizedBox(width: 6),
          Text(value,
              style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 12)),
        ],
      ),
    );
  }
}

class _RefereeTile extends StatelessWidget {
  const _RefereeTile({required this.referee, required this.index});
  final RefereeEntity referee;
  final int index;

  @override
  Widget build(BuildContext context) {
    return KDCard(
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primary100,
            child: Text(
              referee.name.isNotEmpty ? referee.name[0].toUpperCase() : '#',
              style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary700),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(referee.name,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text(
                  '${referee.totalTransactions} transactions · Joined ${AppFormatters.formatDate(referee.joinedAt)}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.neutral500),
                ),
              ],
            ),
          ),
          Text(
            '+${AppFormatters.formatAmount(referee.commissionEarned)}',
            style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.success600,
                fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _WithdrawSheet extends ConsumerStatefulWidget {
  const _WithdrawSheet({
    required this.available,
    required this.ref,
    required this.minWithdrawal,
  });
  final double available;
  final WidgetRef ref;
  final double minWithdrawal;

  @override
  ConsumerState<_WithdrawSheet> createState() => _WithdrawSheetState();
}

class _WithdrawSheetState extends ConsumerState<_WithdrawSheet> {
  final _amountController = TextEditingController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _handleWithdraw() async {
    final amount =
        double.tryParse(_amountController.text.replaceAll(',', ''));
    if (amount == null || amount < widget.minWithdrawal) {
      context.showSnackBar(
        'Minimum withdrawal is ${AppFormatters.formatAmount(widget.minWithdrawal)}',
        isError: true,
      );
      return;
    }
    if (amount > widget.available) {
      context.showSnackBar('Amount exceeds available commission',
          isError: true);
      return;
    }

    setState(() => _isProcessing = true);
    final success = await ref
        .read(referralNotifierProvider.notifier)
        .withdrawCommission(amount);
    setState(() => _isProcessing = false);

    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
      context.showSnackBar('Commission withdrawn to your wallet!');
    } else {
      final error = ref.read(referralNotifierProvider).error;
      context.showSnackBar(
        error is Failure
            ? error.message
            : 'Withdrawal failed. Please try again.',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: AppColors.neutral300,
                    borderRadius: BorderRadius.circular(2)),
              ),
            ),
            const SizedBox(height: 20),
            Text('Withdraw commission',
                style: context.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text(
              'Available: ${AppFormatters.formatAmount(widget.available)}',
              style: const TextStyle(
                  color: AppColors.success600, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 20),
            KDAmountField(
              controller: _amountController,
              label: 'Amount to withdraw',
              validator: (v) => AppValidators.amount(v, min: 500, max: widget.available),
            ),
            const SizedBox(height: 24),
            KDButton(
              label: 'Withdraw to wallet',
              onPressed: _handleWithdraw,
              isLoading: _isProcessing,
              gradient: AppColors.primaryGradient,
            ),
          ],
        ),
        ),
      ),
    );
  }
}
