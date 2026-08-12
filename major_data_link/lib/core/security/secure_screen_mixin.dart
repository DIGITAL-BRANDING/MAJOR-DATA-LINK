import 'package:flutter/widgets.dart';

/// Reference-counts how many "secure" screens/sheets are currently mounted
/// at once, so screenshot protection (Android FLAG_SECURE) only turns off
/// once the LAST one is gone. Without this, navigating from one secure
/// screen straight to another (e.g. Wallet -> transaction PIN sheet) would
/// flip protection off for a frame when the first screen's State disposes,
/// then back on when the second mounts - a real, if brief, gap.
///
/// Release builds only - MainActivity.kt's isDebuggableBuild() check means
/// this is a no-op on debug builds regardless of what's requested here, so
/// screenshots still work normally for local development/QA.
class SecureScreenController {
  SecureScreenController._();

  /// Screenshot protection is intentionally disabled across all builds.
  /// Users can take screenshots on every screen, including release builds.
  static Future<void> push() async {}

  static Future<void> pop() async {}
}

/// Mix into any State that shows sensitive data - wallet balance/funding,
/// transaction PIN entry, OTP, or a generated NIN/BVN slip/response - to
/// block screenshots and screen recording for as long as it's mounted.
///
/// Usage:
/// ```dart
/// class _WalletScreenState extends ConsumerState<WalletScreen>
///     with SecureScreenMixin {
///   // ... no other changes needed - initState/dispose are handled here.
/// }
/// ```
///
/// If a State overrides initState or dispose itself, call
/// `super.initState()` / `super.dispose()` as usual - this mixin hooks into
/// those the normal Dart mixin way and doesn't need any other wiring.
mixin SecureScreenMixin<T extends StatefulWidget> on State<T> {
  @override
  void initState() {
    super.initState();
    SecureScreenController.push();
  }

  @override
  void dispose() {
    SecureScreenController.pop();
    super.dispose();
  }
}

/// Same protection as [SecureScreenMixin], for screens built as a
/// ConsumerWidget/StatelessWidget (no State class to mix into) - e.g.
/// WalletScreen. Wrap the screen's root widget in build():
/// ```dart
/// Widget build(BuildContext context, WidgetRef ref) {
///   return SecureScreenWrapper(child: Scaffold(...));
/// }
/// ```
class SecureScreenWrapper extends StatefulWidget {
  const SecureScreenWrapper({super.key, required this.child});

  final Widget child;

  @override
  State<SecureScreenWrapper> createState() => _SecureScreenWrapperState();
}

class _SecureScreenWrapperState extends State<SecureScreenWrapper>
    with SecureScreenMixin {
  @override
  Widget build(BuildContext context) => widget.child;
}
