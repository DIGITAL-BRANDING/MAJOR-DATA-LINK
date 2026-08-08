import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../providers/admin_pricing_provider.dart';

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final admin = ref.watch(adminMeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Admin Dashboard')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          children: [
            admin.maybeWhen(
              data: (value) => value == null
                  ? const SizedBox.shrink()
                  : Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: Text(
                        'Signed in as ${value.fullName} (${value.role})',
                        style: context.textTheme.bodySmall?.copyWith(
                          color: AppColors.neutral500,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
              orElse: () => const SizedBox.shrink(),
            ),
            _AdminTile(
              icon: Icons.wifi_tethering_rounded,
              title: 'Data Pricing',
              subtitle: 'Manage data plan selling prices per network',
              onTap: () => context.push(RouteNames.adminDataPricing),
            ),
            const SizedBox(height: 10),
            _AdminTile(
              icon: Icons.miscellaneous_services_rounded,
              title: 'Service Pricing',
              subtitle: 'Manage result checker PIN and other service prices',
              onTap: () => context.push(RouteNames.adminServicePricing),
            ),
            const SizedBox(height: 10),
            _AdminTile(
              icon: Icons.account_balance_wallet_outlined,
              title: 'API Balance',
              subtitle: 'View your balance with the data/airtime provider',
              onTap: () => context.push(RouteNames.adminProviderBalance),
            ),
            const SizedBox(height: 10),
            _AdminTile(
              icon: Icons.campaign_outlined,
              title: 'Send Notification',
              subtitle: 'Broadcast a push notification to users',
              onTap: () => context.push(RouteNames.adminBroadcast),
            ),
          ],
        ),
      ),
    );
  }
}

class _AdminTile extends StatelessWidget {
  const _AdminTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return KDCard(
      padding: const EdgeInsets.all(16),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: context.colors.primary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: context.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: context.textTheme.bodySmall
                      ?.copyWith(color: AppColors.neutral500),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: AppColors.neutral400),
        ],
      ),
    );
  }
}
