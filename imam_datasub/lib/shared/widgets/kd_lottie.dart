import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';

class KDLottie extends StatelessWidget {
  const KDLottie({
    super.key,
    required this.asset,
    this.width,
    this.height,
    this.repeat = true,
    this.fallbackIcon,
    this.fallbackColor,
    this.fit = BoxFit.contain,
  });

  final String asset;
  final double? width;
  final double? height;
  final bool repeat;
  final IconData? fallbackIcon;
  final Color? fallbackColor;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    return Lottie.asset(
      asset,
      width: width,
      height: height,
      repeat: repeat,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        if (fallbackIcon != null) {
          return Icon(
            fallbackIcon,
            size: (width ?? 80) * 0.6,
            color: fallbackColor ?? Theme.of(context).colorScheme.primary,
          );
        }
        return const SizedBox.shrink();
      },
    );
  }
}

/// Asset paths for all Lottie animations used in the app.
/// These correspond to files in assets/animations/
abstract class LottieAssets {
  static const splashLogo = 'assets/animations/splash_logo.json';
  static const success = 'assets/animations/success.json';
  static const loading = 'assets/animations/loading.json';
  static const empty = 'assets/animations/empty.json';
  static const error = 'assets/animations/error.json';
  static const onboarding1 = 'assets/animations/onboarding_1.json';
  static const onboarding2 = 'assets/animations/onboarding_2.json';
  static const onboarding3 = 'assets/animations/onboarding_3.json';
}
