import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_text_field.dart';

class _ServiceItem {
  const _ServiceItem({
    required this.label,
    required this.icon,
    required this.color,
    required this.route,
  });

  final String label;
  final IconData icon;
  final Color color;
  final String route;
}

const _services = [
  _ServiceItem(
    label: 'Buy Data',
    icon: Icons.wifi_rounded,
    color: AppColors.primary500,
    route: RouteNames.buyData,
  ),
  _ServiceItem(
    label: 'Buy Airtime',
    icon: Icons.phone_android_rounded,
    color: AppColors.secondary500,
    route: RouteNames.buyAirtime,
  ),
  _ServiceItem(
    label: 'Airtime to Cash',
    icon: Icons.currency_exchange_rounded,
    color: AppColors.success500,
    route: RouteNames.airtimeToCash,
  ),
  _ServiceItem(
    label: 'Cable TV',
    icon: Icons.tv_rounded,
    color: AppColors.accent500,
    route: RouteNames.cableTv,
  ),
  _ServiceItem(
    label: 'Electricity',
    icon: Icons.flash_on_rounded,
    color: AppColors.warning500,
    route: RouteNames.electricity,
  ),
  _ServiceItem(
    label: 'WAEC Result',
    icon: Icons.school_rounded,
    color: AppColors.primary600,
    route: RouteNames.waecChecker,
  ),
  _ServiceItem(
    label: 'NECO Result',
    icon: Icons.school_outlined,
    color: AppColors.primary700,
    route: RouteNames.necoChecker,
  ),
  _ServiceItem(
    label: 'NABTEB Result',
    icon: Icons.menu_book_rounded,
    color: AppColors.secondary700,
    route: RouteNames.nabtebChecker,
  ),
  _ServiceItem(
    label: 'JAMB Services',
    icon: Icons.assignment_rounded,
    color: AppColors.accent600,
    route: RouteNames.jambServices,
  ),
  _ServiceItem(
    label: 'Bulk SMS',
    icon: Icons.sms_rounded,
    color: AppColors.secondary600,
    route: RouteNames.bulkSms,
  ),
  _ServiceItem(
    label: 'Recharge Card',
    icon: Icons.sim_card_rounded,
    color: AppColors.success600,
    route: RouteNames.rechargeCard,
  ),
  _ServiceItem(
    label: 'Data Card',
    icon: Icons.credit_card_rounded,
    color: AppColors.warning600,
    route: RouteNames.dataCard,
  ),
];

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _query.isEmpty
        ? _services
        : _services
            .where((s) => s.label.toLowerCase().contains(_query.toLowerCase()))
            .toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Services')),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppDimensions.screenPaddingH,
                vertical: 8,
              ),
              child: KDSearchField(
                controller: _searchController,
                hint: 'Search services',
                onChanged: (v) => setState(() => _query = v),
                onClear: () => setState(() => _query = ''),
              ),
            ),
            Expanded(
              child: GridView.builder(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppDimensions.screenPaddingH,
                  vertical: 12,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 16,
                  childAspectRatio: 0.72,
                ),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final service = filtered[index];
                  return GestureDetector(
                    onTap: () => context.push(service.route),
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              color: service.color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(18),
                            ),
                            child: Icon(service.icon,
                                color: service.color, size: 28),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            service.label,
                            textAlign: TextAlign.center,
                            style: context.textTheme.labelSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  )
                      .animate(delay: Duration(milliseconds: index * 30))
                      .fadeIn(duration: 250.ms)
                      .scale(begin: const Offset(0.9, 0.9));
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
