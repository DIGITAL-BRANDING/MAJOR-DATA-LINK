import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_dimensions.dart';
import '../../core/router/route_names.dart';
import '../widgets/kd_button.dart';
import '../widgets/kd_card.dart';

/// Generic placeholder screen for services whose provider/API integration
/// has not been wired up yet (e.g. NIN, BVN, CAC, SCUML, TIN verification
/// services). Once a live provider is connected, replace the route in
/// app_router.dart with the real service screen.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({
    super.key,
    required this.title,
    required this.icon,
    required this.color,
    this.description,
  });

  final String title;
  final IconData icon;
  final Color color;
  final String? description;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        top: false,
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.screenPaddingH,
            ),
            child: KDEmptyState(
              icon: icon,
              title: '$title — Coming Soon',
              message: description ??
                  'We\'re working on bringing $title services to MAJOR DATA-LINK. '
                      'This will be available as soon as it\'s ready.',
              action: SizedBox(
                width: double.infinity,
                child: KDButton(
                  label: 'Contact Support',
                  gradient: AppColors.primaryGradient,
                  onPressed: () => context.push(RouteNames.support),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
