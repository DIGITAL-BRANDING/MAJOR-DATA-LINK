import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../domain/entities/referral_entity.dart';

// ── Remote ─────────────────────────────────────────────────
final _referralRemoteProvider = Provider((ref) {
  return _ReferralRemote(ref.read(dioClientProvider));
});

class _ReferralRemote {
  const _ReferralRemote(this._dio);
  final Dio _dio;

  Future<ReferralEntity> getStats() async {
    try {
      final response = await _dio.get(AppEndpoints.referralStats);
      return ReferralEntity.fromJson(
          response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<void> withdrawCommission(double amount) async {
    try {
      await _dio.post(
        AppEndpoints.withdrawCommission,
        data: {'amount': amount},
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

// ── Providers ──────────────────────────────────────────────
final referralStatsProvider =
    FutureProvider.autoDispose<ReferralEntity>((ref) async {
  final remote = ref.read(_referralRemoteProvider);
  return remote.getStats();
});

class ReferralNotifier extends StateNotifier<AsyncValue<void>> {
  ReferralNotifier(this._ref) : super(const AsyncValue.data(null));
  final Ref _ref;

  Future<bool> withdrawCommission(double amount) async {
    state = const AsyncValue.loading();
    try {
      final remote = _ref.read(_referralRemoteProvider);
      await remote.withdrawCommission(amount);
      _ref.invalidate(referralStatsProvider);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      return false;
    }
  }
}

final referralNotifierProvider =
    StateNotifierProvider.autoDispose<ReferralNotifier, AsyncValue<void>>(
        (ref) => ReferralNotifier(ref));