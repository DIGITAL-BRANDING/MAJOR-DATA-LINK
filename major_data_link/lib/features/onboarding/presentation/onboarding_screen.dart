import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';
import '../../../core/constants/app_strings.dart';
import '../../../core/di/injection.dart';
import '../../../core/router/route_names.dart';

/// One onboarding page. Mirrors the web landing hero: a two-tone headline,
/// a short description and a product image.
class _Slide {
  const _Slide({
    required this.dark,
    required this.accent,
    required this.body,
    required this.image,
  });

  final String dark;
  final String accent;
  final String body;
  final String image;
}

const _slides = <_Slide>[
  _Slide(
    dark: 'RESULT',
    accent: 'CHECKERS',
    body: 'Buy WAEC, NECO and NABTEB result PINs, JAMB e-PIN, JAMB Admission Letter and JAMB Reprint services, delivered in minutes.',
    image: 'assets/images/onboarding/onboarding_results.png',
  ),
  _Slide(
    dark: 'NIN & BVN',
    accent: 'SERVICES',
    body: 'Verify NIN and BVN, generate slips, and request CAC registration or a TIN certificate. Fast, secure, paid from your wallet.',
    image: 'assets/images/onboarding/onboarding_nin.png',
  ),
  _Slide(
    dark: 'DATA & AIRTIME',
    accent: 'TOPUP',
    body: 'Instant airtime topup and cheap data for all networks. Fund your wallet by bank transfer, any time.',
    image: 'assets/images/onboarding/onboarding_airtime.jpeg',
  ),
  _Slide(
    dark: 'CAC',
    accent: 'SERVICES',
    body: 'Register your business name with the CAC from your wallet. Sole proprietorship and partnership registrations, completed by our team and delivered to your Deliveries.',
    image: 'assets/images/onboarding/onboarding_cac.png',
  ),
  _Slide(
    dark: 'TIN',
    accent: 'SERVICES',
    body: 'Get a company or individual NRS/FIRS TIN certificate. Submit your details once, pay from your wallet, and receive the certificate in Deliveries.',
    image: 'assets/images/onboarding/onboarding_tin.png',
  ),
  _Slide(
    dark: 'BIRTH ATTESTATION',
    accent: '& MANY MORE',
    body: 'Birth attestation, BVN CRM, newspaper publication, school website and more. One wallet, every service in one place.',
    image: 'assets/images/onboarding/onboarding_birth.png',
  ),
  _Slide(
    dark: 'GRAPHICS & BRANDING',
    accent: 'PRINTING SERVICES',
    body: 'Design and print flyers, posters, business cards, stickers and branding materials. Get your design done and printed through K-Tech.',
    image: 'assets/images/onboarding/onboarding_graphics.png',
  ),
];

// Same palette as the web hero, so the first impression matches the website.
const _heroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF6EF46A), Color(0xFFA6FFA1), Color(0xFFE6FFE2)],
);
const _ink = Color(0xFF111111);
const _accentRed = Color(0xFFE11D2E);
const _navy = Color(0xFF0B2A55);
const _autoplayEvery = Duration(seconds: 6);

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _controller = PageController();
  Timer? _timer;
  int _index = 0;
  // Once the user swipes, stop auto-advancing so the slide they are reading stays put.
  bool _userTouched = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(_autoplayEvery, (_) {
      if (_userTouched || !_controller.hasClients) return;
      _controller.animateToPage(
        (_index + 1) % _slides.length,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  /// Marks onboarding as done and goes to [route]. Used by Skip, Sign Up and Login.
  Future<void> _finish(String route) async {
    _timer?.cancel();
    await ref.read(secureStorageProvider).setOnboardingComplete();
    if (!mounted) return;
    context.go(route);
  }

  void _back() {
    if (_index > 0) {
      _controller.previousPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: _heroGradient),
        child: SafeArea(
          child: Column(
            children: [
              _TopBar(
                index: _index,
                count: _slides.length,
                controller: _controller,
                onBack: _back,
                onSkip: () => _finish(RouteNames.login),
              ),
              Expanded(
                child: NotificationListener<ScrollStartNotification>(
                  onNotification: (notification) {
                    if (notification.dragDetails != null) _userTouched = true;
                    return false;
                  },
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _slides.length,
                    onPageChanged: (i) => setState(() => _index = i),
                    itemBuilder: (_, i) => _SlideView(slide: _slides[i]),
                  ),
                ),
              ),
              _CtaBar(
                onSignUp: () => _finish(RouteNames.register),
                onLogin: () => _finish(RouteNames.login),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.index,
    required this.count,
    required this.controller,
    required this.onBack,
    required this.onSkip,
  });

  final int index;
  final int count;
  final PageController controller;
  final VoidCallback onBack;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 6, 8, 0),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: index > 0
                ? IconButton(
                    onPressed: onBack,
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: _ink),
                    tooltip: 'Previous',
                  )
                : null,
          ),
          Expanded(
            child: Center(
              child: SmoothPageIndicator(
                controller: controller,
                count: count,
                effect: ExpandingDotsEffect(
                  activeDotColor: _ink,
                  dotColor: Color(0x55111111),
                  dotHeight: 7,
                  dotWidth: 7,
                  expansionFactor: 3,
                ),
              ),
            ),
          ),
          TextButton(
            onPressed: onSkip,
            style: TextButton.styleFrom(foregroundColor: _ink),
            child: Text(
              AppStrings.skip,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Headline size follows the screen width, so small phones and tablets both fit.
        final headlineSize = (constraints.maxWidth * 0.085).clamp(26.0, 42.0);
        return Semantics(
          label: '${slide.dark} ${slide.accent}. ${slide.body}',
          child: Column(
            children: [
              Expanded(
                flex: 6,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                  child: Center(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: Image.asset(
                        slide.image,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Container(
                          color: Colors.white.withValues(alpha: 0.5),
                          child: const Center(
                            child: Icon(Icons.image_outlined, size: 64, color: _ink),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                flex: 4,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: '${slide.dark} ',
                              style: const TextStyle(color: _ink),
                            ),
                            TextSpan(
                              text: slide.accent,
                              style: const TextStyle(color: _accentRed),
                            ),
                          ],
                        ),
                        style: TextStyle(
                          fontSize: headlineSize,
                          fontWeight: FontWeight.w900,
                          height: 1.05,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        slide.body,
                        style: TextStyle(
                          fontSize: 16,
                          height: 1.5,
                          color: _ink.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _CtaBar extends StatelessWidget {
  const _CtaBar({required this.onSignUp, required this.onLogin});

  final VoidCallback onSignUp;
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
      child: Row(
        children: [
          Expanded(
            child: FilledButton(
              onPressed: onSignUp,
              style: FilledButton.styleFrom(
                backgroundColor: _ink,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('Sign Up', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: FilledButton(
              onPressed: onLogin,
              style: FilledButton.styleFrom(
                backgroundColor: _navy,
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(54),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text('Login', style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }
}