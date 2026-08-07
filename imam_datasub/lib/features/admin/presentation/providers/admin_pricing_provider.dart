import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/di/injection.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';
import '../../data/admin_pricing_repository.dart';

final adminPricingRepositoryProvider = Provider<AdminPricingRepository>((ref) {
  return AdminPricingRepository(ref.read(dioClientProvider));
});

final adminMeProvider = FutureProvider<AdminUserSummary?>((ref) {
  return ref.read(adminPricingRepositoryProvider).getAdminMe();
});

final adminDataPricesProvider = FutureProvider.autoDispose
    .family<List<DataPriceRow>, NetworkProvider>((ref, network) {
      return ref.read(adminPricingRepositoryProvider).getDataPrices(network);
    });

final adminServicePricesProvider =
    FutureProvider.autoDispose<List<ServicePriceRow>>((ref) {
      return ref.read(adminPricingRepositoryProvider).getServicePrices();
    });

final adminProviderBalanceProvider =
    FutureProvider.autoDispose<ProviderBalanceBundle>((ref) {
      return ref.read(adminPricingRepositoryProvider).getProviderBalances();
    });

final adminBroadcastHistoryProvider =
    FutureProvider.autoDispose<List<BroadcastEntity>>((ref) {
      return ref.read(adminPricingRepositoryProvider).getBroadcastHistory();
    });
