import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';

class VerificationHubItem {
  const VerificationHubItem({
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
    required this.route,
  });

  final String label;
  final String description;
  final IconData icon;
  final Color color;
  final String route;
}

/// Reusable list hub for a group of verification sub-services — used for
/// both the NIN group (7 flows) and the BVN group (2 flows) so the two
/// entry tiles already on the Services grid keep working unchanged.
class VerificationHubScreen extends StatelessWidget {
  const VerificationHubScreen({
    super.key,
    required this.title,
    required this.items,
  });

  final String title;
  final List<VerificationHubItem> items;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        top: false,
        child: ListView.separated(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          itemCount: items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final item = items[index];
            return KDCard(
              onTap: () => context.push(item.route),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: item.color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(item.icon, color: item.color, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.label,
                            style: context.textTheme.titleSmall
                                ?.copyWith(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 2),
                        Text(
                          item.description,
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.neutral500),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded,
                      color: AppColors.neutral400),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

const _ninHubItems = [
  VerificationHubItem(
    label: 'NIN by NIN',
    description: 'Generate a verification slip using the 11-digit NIN',
    icon: Icons.badge_outlined,
    color: AppColors.primary600,
    route: RouteNames.ninByNin,
  ),
  VerificationHubItem(
    label: 'NIN by Phone',
    description: 'Generate a slip using the phone number registered to a NIN',
    icon: Icons.phone_iphone_rounded,
    color: AppColors.primary700,
    route: RouteNames.ninByPhone,
  ),
  VerificationHubItem(
    label: 'NIN by Demographic',
    description: 'Look up a slip using name, date of birth and gender',
    icon: Icons.badge_outlined,
    color: AppColors.secondary600,
    route: RouteNames.ninByDemographic,
  ),
  VerificationHubItem(
    label: 'NIN Delinking',
    description: 'Unlink an email address from a NIN',
    icon: Icons.link_off_rounded,
    color: AppColors.accent600,
    route: RouteNames.ninDelinking,
  ),
  VerificationHubItem(
    label: 'NIN Validation',
    description: 'Validate a NIN against a specific issue type',
    icon: Icons.fact_check_outlined,
    color: AppColors.success600,
    route: RouteNames.ninValidation,
  ),
  VerificationHubItem(
    label: 'NIN Personalization',
    description: 'Submit a personalization request by NIMC tracking ID',
    icon: Icons.person_pin_circle_outlined,
    color: AppColors.warning600,
    route: RouteNames.ninPersonalization,
  ),
  VerificationHubItem(
    label: 'IPE Clearance',
    description: 'Submit a tracking ID for IPE clearance',
    icon: Icons.verified_outlined,
    color: AppColors.error500,
    route: RouteNames.ipeClearance,
  ),
];

const _bvnHubItems = [
  VerificationHubItem(
    label: 'BVN Slip',
    description: 'Generate a verification slip using the 11-digit BVN',
    icon: Icons.fingerprint_rounded,
    color: AppColors.secondary600,
    route: RouteNames.bvnSlip,
  ),
  VerificationHubItem(
    label: 'BVN Retrieval',
    description: "Look up an unknown BVN using the owner's name and phone",
    icon: Icons.manage_search_rounded,
    color: AppColors.secondary700,
    route: RouteNames.bvnRetrieval,
  ),
];

class NinServicesHubScreen extends StatelessWidget {
  const NinServicesHubScreen({super.key});
  @override
  Widget build(BuildContext context) => const VerificationHubScreen(
        title: 'NIN Services',
        items: _ninHubItems,
      );
}

class BvnServicesHubScreen extends StatelessWidget {
  const BvnServicesHubScreen({super.key});
  @override
  Widget build(BuildContext context) => const VerificationHubScreen(
        title: 'BVN Services',
        items: _bvnHubItems,
      );
}
