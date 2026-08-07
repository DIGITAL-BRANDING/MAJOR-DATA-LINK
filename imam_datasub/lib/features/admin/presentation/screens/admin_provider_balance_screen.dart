import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../providers/admin_pricing_provider.dart';

class AdminProviderBalanceScreen extends ConsumerWidget {
  const AdminProviderBalanceScreen({super.key});

  Future<void> _refresh(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(adminPricingRepositoryProvider).refreshProviderBalance();
      ref.invalidate(adminProviderBalanceProvider);
      if (context.mounted) {
        context.showSnackBar('Alrahuz balance refreshed');
      }
    } catch (error) {
      if (context.mounted) {
        context.showSnackBar(error.toString(), isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balances = ref.watch(adminProviderBalanceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('API Balance')),
      body: SafeArea(
        top: false,
        child: balances.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(error.toString(), textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () =>
                        ref.invalidate(adminProviderBalanceProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (bundle) {
            final account = bundle.fundingAccount;
            return RefreshIndicator(
              onRefresh: () => _refresh(context, ref),
              child: ListView(
                padding: EdgeInsets.fromLTRB(
                  AppDimensions.screenPaddingH,
                  AppDimensions.screenPaddingH,
                  AppDimensions.screenPaddingH,
                  AppDimensions.screenPaddingH +
                      MediaQuery.paddingOf(context).bottom,
                ),
                children: [
                  KDCard(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Alrahuz Funding Account',
                          style: context.textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _AccountRow(
                          label: 'Account Number',
                          value: account.accountNumber,
                        ),
                        _AccountRow(
                          label: 'Account Name',
                          value: account.accountName,
                        ),
                        _AccountRow(
                          label: 'Bank Name',
                          value: account.bankName,
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: KDButton(
                            label: 'Copy account number',
                            onPressed: () async {
                              await Clipboard.setData(
                                ClipboardData(text: account.accountNumber),
                              );
                              if (context.mounted) {
                                context.showSnackBar('Account number copied');
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Tap refresh after funding your Alrahuz account. The previous balance only changes automatically after provider purchases, so a website top-up needs this live refresh.',
                    style: context.textTheme.bodySmall?.copyWith(
                      color: AppColors.neutral500,
                    ),
                  ),
                  const SizedBox(height: 16),
                  ...bundle.rows.map(
                    (row) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: KDCard(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              row.provider.toUpperCase(),
                              style: context.textTheme.labelMedium?.copyWith(
                                color: AppColors.neutral500,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'NGN${row.balance.toStringAsFixed(2)}',
                              style: context.textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Last updated: ${row.lastCheckedAt.toLocal()}',
                              style: context.textTheme.bodySmall?.copyWith(
                                color: AppColors.neutral400,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (bundle.rows.isEmpty)
                    const KDCard(
                      child: Text(
                        'No provider balance recorded yet. Tap refresh to check Alrahuz.',
                      ),
                    ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: KDButton(
                      label: 'Refresh Alrahuz Balance',
                      onPressed: () => _refresh(context, ref),
                      gradient: AppColors.primaryGradient,
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AccountRow extends StatelessWidget {
  const _AccountRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 118,
            child: Text(
              label,
              style: context.textTheme.bodySmall?.copyWith(
                color: AppColors.neutral500,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              style: context.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
