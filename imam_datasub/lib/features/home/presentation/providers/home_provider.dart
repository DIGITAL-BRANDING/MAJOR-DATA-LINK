import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/config/app_config.dart';
import '../../data/datasources/home_remote_datasource.dart';
import '../../domain/entities/banner_entity.dart';

final homeRemoteDataSourceProvider = Provider<HomeRemoteDataSource>((ref) {
  return HomeRemoteDataSourceImpl(ref.read(dioClientProvider));
});

// ── Banners (cached, refreshed periodically) ───────────────
final bannersProvider = FutureProvider<List<BannerEntity>>((ref) async {
  final hive = ref.read(hiveStorageProvider);
  const cacheKey = 'home_banners';

  // Try cache first
  final cached = hive.get<List>(cacheKey);
  if (cached != null) {
    try {
      return cached
          .map((e) => BannerEntity.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      // Fall through to network
    }
  }

  try {
    final remote = ref.read(homeRemoteDataSourceProvider);
    final banners = await remote.getBanners();
    await hive.set(
      cacheKey,
      banners
          .map((b) => {
                'id': b.id,
                'image_url': b.imageUrl,
                'title': b.title,
                'action_url': b.actionUrl,
                'action_type': b.actionType,
              })
          .toList(),
      ttl: const Duration(hours: 6),
    );
    return banners;
  } catch (_) {
    return [];
  }
});

// ── Greeting based on time of day ──────────────────────────
final greetingProvider = Provider<String>((ref) {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
});

// ── Unread notification count (stubbed; wired in notifications feature) ──
final unreadNotificationCountProvider = StateProvider<int>((ref) => 0);
