import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_service.dart';
import '../network/dio_client.dart';
import '../network/network_info.dart';
import '../network/token_refresh_coordinator.dart';
import '../security/biometric_service.dart';
import '../storage/hive_storage.dart';
import '../storage/secure_storage.dart';
import '../router/auth_status.dart';

// ── Storage ───────────────────────────────────────────────
final secureStorageProvider = Provider<SecureStorageService>(
  (_) => SecureStorageService(),
);

final hiveStorageProvider = Provider<HiveStorage>((ref) {
  return HiveStorage(ref.read(secureStorageProvider));
});

// ── Network ───────────────────────────────────────────────
final connectivityProvider = Provider<Connectivity>((_) => Connectivity());

final networkInfoProvider = Provider<NetworkInfo>((ref) {
  return NetworkInfoImpl(ref.read(connectivityProvider));
});

final connectivityStreamProvider = StreamProvider<bool>((ref) {
  return ref.read(networkInfoProvider).onConnectivityChanged;
});

// ── API ───────────────────────────────────────────────────
// A single long-lived coordinator per app session. Exposed as its own
// provider (rather than created inline inside DioClient.create) so the auth
// repository can call invalidatePendingRefreshes() on it directly at logout
// and at the start of a fresh login - see AuthRepositoryImpl.
final tokenRefreshCoordinatorProvider = Provider<TokenRefreshCoordinator>((ref) {
  return TokenRefreshCoordinator(ref.read(secureStorageProvider));
});

final dioClientProvider = Provider((ref) {
  final storage = ref.read(secureStorageProvider);
  final container = ref.container;

  return DioClient.create(
    storage: storage,
    refreshCoordinator: ref.read(tokenRefreshCoordinatorProvider),
    onSessionExpired: () async {
      // Invalidate auth state on session expiry
      container.invalidate(authStateProvider);
    },
  );
});

final apiServiceProvider = Provider<ApiService>((ref) {
  return DioApiService(ref.read(dioClientProvider));
});

// ── Security ──────────────────────────────────────────────
final biometricServiceProvider = Provider<BiometricService>(
  (_) => BiometricService(),
);

// ── Auth state (stub — overridden by auth feature) ────────
// This is the app-level auth state that the router watches.
// The AuthNotifier in the auth feature will override this.
final authStateProvider =
    StateProvider<AsyncValue<AuthStatus>>((ref) => const AsyncValue.data(AuthStatus.unauthenticated));
