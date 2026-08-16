import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/app_colors.dart';
import '../../core/constants/app_strings.dart';
import '../widgets/kd_button.dart';

/// Shown instead of the normal app when the installed version is below the
/// backend's `min_android_version` (see AppConfig in the backend's Prisma
/// schema for why this exists - concretely, commit a089b84 added a
/// REQUIRED `pin` field to purchase endpoints; an old APK that never
/// learned to send one would otherwise fail every purchase with a raw,
/// meaningless ZodError instead of ever being told to update).
///
/// Deliberately has no back button, no way to dismiss, and is reached via
/// a raw Navigator.pushReplacement from SplashScreen (not a normal
/// go_router route) - it must not be possible to navigate past this screen
/// without updating.
class ForceUpdateScreen extends StatelessWidget {
  const ForceUpdateScreen({
    super.key,
    required this.downloadUrl,
    this.latestVersion,
    this.message,
  });

  final String downloadUrl;
  final String? latestVersion;
  final String? message;

  Future<void> _openDownload() async {
    final uri = Uri.parse(downloadUrl);
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: AppColors.primary600,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(
                      Icons.system_update_rounded,
                      size: 40,
                      color: Colors.white,
                    ),
                  ).animate().scale(curve: Curves.easeOutBack, duration: 500.ms).fadeIn(),

                  const SizedBox(height: 28),

                  Text(
                    'Update required',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ).animate().fadeIn(delay: 150.ms),

                  const SizedBox(height: 12),

                  Text(
                    message?.trim().isNotEmpty == true
                        ? message!
                        : 'A new version of ${AppStrings.appName} is ready'
                            '${latestVersion != null ? ' (v$latestVersion)' : ''}. '
                            'Please update to keep using the app - some features '
                            'will not work correctly on this older version.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 15,
                      height: 1.5,
                    ),
                  ).animate().fadeIn(delay: 250.ms),

                  const SizedBox(height: 36),

                  SizedBox(
                    width: double.infinity,
                    child: KDButton(
                      label: 'Update now',
                      onPressed: _openDownload,
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary600,
                    ),
                  ).animate().fadeIn(delay: 350.ms).slideY(begin: 0.15),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
