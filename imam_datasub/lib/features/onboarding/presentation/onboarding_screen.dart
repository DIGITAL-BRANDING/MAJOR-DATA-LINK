import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/di/injection.dart';
import '../../../core/router/route_names.dart';
import '../../../shared/widgets/kd_button.dart';

class _OnboardData {
  const _OnboardData({
    required this.title,
    required this.body,
    required this.imageAsset,
    required this.gradient,
    this.isSvg = false,
  });

  final String title;
  final String body;

  /// Path to the hero artwork for this page (raster .webp/.png or a
  /// vector .svg — see [isSvg]).
  final String imageAsset;
  final bool isSvg;
  final LinearGradient gradient;
}

const _pages = [
  _OnboardData(
    title: AppStrings.onboarding1Title,
    body: AppStrings.onboarding1Body,
    imageAsset: 'assets/images/onboarding/onboarding_1.png',
    gradient: AppColors.primaryGradient,
  ),
  _OnboardData(
    title: AppStrings.onboarding2Title,
    body: AppStrings.onboarding2Body,
    imageAsset: 'assets/images/onboarding/onboarding_2.png',
    gradient: LinearGradient(
      colors: [AppColors.secondary500, AppColors.accent500],
    ),
  ),
  _OnboardData(
    title: AppStrings.onboarding3Title,
    body: AppStrings.onboarding3Body,
    // The actual asset shipped in assets/images/onboarding/ is a raster
    // PNG, not an SVG - isSvg stays false so this goes through
    // Image.asset() like the other two pages instead of SvgPicture.asset(),
    // which was failing to find a .svg file that never existed on disk.
    imageAsset: 'assets/images/onboarding/onboarding_3.png',
    gradient: LinearGradient(
      colors: [AppColors.accent500, AppColors.primary600],
    ),
  ),
];

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  int _currentPage = 0;

  Future<void> _completeOnboarding() async {
    final storage = ref.read(secureStorageProvider);
    await storage.setOnboardingComplete();
    if (mounted) context.go(RouteNames.login);
  }

  void _next() {
    if (_currentPage < _pages.length - 1) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    } else {
      _completeOnboarding();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: TextButton(
                  onPressed: _completeOnboarding,
                  child: Text(
                    AppStrings.skip,
                    style: TextStyle(
                      color: AppColors.neutral500,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: _pages.length,
                onPageChanged: (i) => setState(() => _currentPage = i),
                itemBuilder: (context, index) => _OnboardPage(data: _pages[index]),
              ),
            ),
            SmoothPageIndicator(
              controller: _controller,
              count: _pages.length,
              effect: ExpandingDotsEffect(
                activeDotColor: Theme.of(context).colorScheme.primary,
                dotColor: AppColors.neutral200,
                dotHeight: 8,
                dotWidth: 8,
                expansionFactor: 3,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: KDButton(
                label: _currentPage == _pages.length - 1
                    ? 'Get started'
                    : AppStrings.next,
                onPressed: _next,
                gradient: _pages[_currentPage].gradient,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardPage extends StatelessWidget {
  const _OnboardPage({required this.data});
  final _OnboardData data;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Hero image: full-bleed (no side padding) and takes the majority
        // of the page's height so it reads as the star of the screen
        // instead of a small centered thumbnail.
        Expanded(
          flex: 6,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
            child: SizedBox(
              width: double.infinity,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(
                      color: data.gradient.colors.first.withValues(alpha: 0.28),
                      blurRadius: 36,
                      offset: const Offset(0, 18),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(32),
                  child: data.isSvg
                      ? SvgPicture.asset(
                          data.imageAsset,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                        )
                      : Image.asset(
                          data.imageAsset,
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                        ),
                ),
              ),
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms)
              .scale(begin: const Offset(0.95, 0.95), curve: Curves.easeOutBack),
        ),

        // Title + body: the remaining, smaller share of the page.
        Expanded(
          flex: 4,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  data.title,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ).animate().fadeIn(delay: 150.ms).slideY(begin: 0.2),

                const SizedBox(height: 12),

                Text(
                  data.body,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: AppColors.neutral500,
                        height: 1.5,
                      ),
                ).animate().fadeIn(delay: 250.ms),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
