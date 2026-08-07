import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/di/injection.dart';
import '../../core/network/network_info.dart';

/// Connectivity stream — consumed by any widget needing offline banner
final connectivityStatusProvider = StreamProvider<bool>((ref) {
  final networkInfo = ref.read(networkInfoProvider);
  return networkInfo.onConnectivityChanged;
});

/// Convenience bool provider for quick connectivity checks
final isOnlineProvider = Provider<bool>((ref) {
  return ref
          .watch(connectivityStatusProvider)
          .whenData((v) => v)
          .valueOrNull ??
      true;
});
