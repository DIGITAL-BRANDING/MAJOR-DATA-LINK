import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/di/injection.dart';
import '../../../core/router/route_names.dart';

class _OnboardData {
  const _OnboardData({
    required this.title,
    required this.body,
    required this.imageAsset,
  });

  /// Not shown on screen anymore — the artwork is meant to speak for
  /// itself, full-bleed. Kept only as a [Semantics] label so screen
  /// readers still get a description of each page.
  final String title;
  final String body;

  final String imageAsset;
}

const _pages = [
  _OnboardData(
    title: AppStrings.onboarding1Title,
    body: AppStrings.onboarding1Body,
    imageAsset: 'assets/images/onboarding/onboarding_1.png',
  ),
  _OnboardData(
    title: AppStrings.onboarding2Title,
    body: AppStrings.onboarding2Body,
    imageAsset: 'assets/images/onboarding/onboarding_2.png',
  ),
  _OnboardData(
    title: AppStrings.onboarding3Title,
    body: AppStrings.onboarding3Body,
    imageAsset: 'assets/images/onboarding/onboarding_3.png',
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

  void _previous() {
    if (_currentPage > 0) {
      _controller.previousPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLastPage = _currentPage == _pages.length - 1;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Full-bleed pages — the image IS the screen, edge to edge,
          // nothing drawn on top of it except small floating controls.
          PageView.builder(
            controller: _controller,
            itemCount: _pages.length,
            onPageChanged: (i) => setState(() => _currentPage = i),
            itemBuilder: (context, index) {
              final page = _pages[index];
              return Semantics(
                label: '${page.title}. ${page.body}',
                image: true,
                child: Image.asset(
                  page.imageAsset,
                  fit: BoxFit.cover,
                  width: double.infinity,
                  height: double.infinity,
                ),
              );
            },
          ),

          // Top controls: previous arrow (left) once you've moved past
          // page 1, page dots (center), Skip (right). Next lives here too
          // as a circular arrow so nothing sits over the bottom of the
          // artwork.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 16, 0),
                child: Row(
                  children: [
                    _CircleIconButton(
                      icon: Icons.arrow_back_ios_new_rounded,
                      onPressed: _currentPage > 0 ? _previous : null,
                    ),
                    const Spacer(),
                    SmoothPageIndicator(
                      controller: _controller,
                      count: _pages.length,
                      effect: ExpandingDotsEffect(
                        activeDotColor: Colors.white,
                        dotColor: Colors.white.withValues(alpha: 0.4),
                        dotHeight: 7,
                        dotWidth: 7,
                        expansionFactor: 3,
                      ),
                    ),
                    const Spacer(),
                    TextButton(
                      onPressed: _completeOnboarding,
                      style: TextButton.styleFrom(
                        foregroundColor: Colors.white,
                        backgroundColor: Colors.black.withValues(alpha: 0.35),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 10),
                      ),
                      child: Text(
                        AppStrings.skip,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(width: 8),
                    _CircleIconButton(
                      icon: isLastPage
                          ? Icons.check_rounded
                          : Icons.arrow_forward_ios_rounded,
                      onPressed: _next,
                      filled: isLastPage,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Small translucent circular button used for the prev/next/done controls
/// floating over the full-bleed artwork — readable regardless of what's
/// underneath it, and disabled (dimmed) when there's no previous page.
class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    return Material(
      color: filled
          ? AppColors.primary600
          : Colors.black.withValues(alpha: enabled ? 0.35 : 0.15),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Icon(
            icon,
            size: 18,
            color: Colors.white.withValues(alpha: enabled ? 1 : 0.4),
          ),
        ),
      ),
    );
  }
}
