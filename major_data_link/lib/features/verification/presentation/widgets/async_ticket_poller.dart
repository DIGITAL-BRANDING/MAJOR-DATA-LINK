import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/verification_provider.dart';

/// Mix into a [ConsumerStatefulWidget]'s State to auto-poll a submitted
/// ticket every few seconds until it settles (`success`/`failed`), on top
/// of the manual refresh button on [AsyncTicketStatusCard].
///
/// Usage:
/// ```dart
/// class _MyScreenState extends ConsumerState<MyScreen>
///     with AsyncTicketPoller<MyScreen> {
///   @override
///   Future<void> checkStatus() =>
///       ref.read(asyncFlowProvider.notifier).checkStatus(
///         (id) => ref.read(verificationRemoteProvider).checkDelinking(id),
///       );
/// }
/// ```
mixin AsyncTicketPoller<T extends ConsumerStatefulWidget> on ConsumerState<T> {
  Timer? _pollTimer;

  Future<void> checkStatus();

  void startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 8), (_) {
      final state = ref.read(asyncFlowProvider);
      if (!mounted || state.isSettled) {
        _pollTimer?.cancel();
        return;
      }
      checkStatus();
    });
  }

  void stopPolling() => _pollTimer?.cancel();

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
