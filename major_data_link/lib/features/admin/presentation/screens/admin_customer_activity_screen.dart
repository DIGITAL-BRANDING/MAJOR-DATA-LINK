import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../providers/admin_pricing_provider.dart';

class AdminCustomerActivityScreen extends ConsumerStatefulWidget {
  const AdminCustomerActivityScreen({super.key});

  @override
  ConsumerState<AdminCustomerActivityScreen> createState() =>
      _AdminCustomerActivityScreenState();
}

class _AdminCustomerActivityScreenState
    extends ConsumerState<AdminCustomerActivityScreen> {
  int _days = 30;

  @override
  Widget build(BuildContext context) {
    final activity = ref.watch(adminCustomerActivityProvider(_days));
    return Scaffold(
      appBar: AppBar(title: const Text('Customer Activity')),
      body: SafeArea(
        top: false,
        child: activity.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => Center(child: Text(error.toString())),
          data: (data) => RefreshIndicator(
            onRefresh: () async =>
                ref.invalidate(adminCustomerActivityProvider(_days)),
            child: ListView(
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              children: [
                Row(
                  children: [
                    Text('Period', style: context.textTheme.titleSmall),
                    const Spacer(),
                    DropdownButton<int>(
                      value: _days,
                      items: const [7, 30, 90, 365]
                          .map(
                            (days) => DropdownMenuItem(
                              value: days,
                              child: Text('Last $days days'),
                            ),
                          )
                          .toList(),
                      onChanged: (days) =>
                          days == null ? null : setState(() => _days = days),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    _SummaryCard(
                      label: 'Active users',
                      value: '${data.summary.activeCustomers}',
                    ),
                    _SummaryCard(
                      label: 'Purchases',
                      value: '${data.summary.successfulPurchases}',
                    ),
                    _SummaryCard(
                      label: 'Total usage',
                      value: '₦${data.summary.totalUsage.toStringAsFixed(2)}',
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  'Top customers — reward candidates',
                  style: context.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                if (data.topCustomers.isEmpty)
                  const KDCard(
                    child: Text(
                      'No successful customer purchases in this period.',
                    ),
                  ),
                ...data.topCustomers.asMap().entries.map((entry) {
                  final rank = entry.key + 1;
                  final user = entry.value;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: KDCard(
                      padding: const EdgeInsets.all(15),
                      child: Row(
                        children: [
                          CircleAvatar(child: Text('$rank')),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  user.name,
                                  style: context.textTheme.titleSmall?.copyWith(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  '${user.purchases} successful purchases • ${user.email}',
                                  style: context.textTheme.bodySmall?.copyWith(
                                    color: AppColors.neutral500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₦${user.totalUsage.toStringAsFixed(2)}',
                            style: context.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                              color: context.colors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 16),
                Text(
                  'Recent purchases',
                  style: context.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                ...data.recentPurchases.map(
                  (purchase) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: KDCard(
                      padding: const EdgeInsets.all(15),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            purchase.name,
                            style: context.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            purchase.description,
                            style: context.textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 5),
                          Text(
                            '${purchase.type.replaceAll('_', ' ')} • ₦${purchase.amount.toStringAsFixed(2)} • ${purchase.createdAt.toLocal()}',
                            style: context.textTheme.bodySmall?.copyWith(
                              color: AppColors.neutral500,
                            ),
                          ),
                        ],
                      ),
                    ),
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.label, required this.value});
  final String label, value;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 160,
    child: KDCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.textTheme.bodySmall?.copyWith(
              color: AppColors.neutral500,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            value,
            style: context.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    ),
  );
}
