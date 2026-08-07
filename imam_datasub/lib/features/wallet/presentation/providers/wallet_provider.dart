import 'dart:async';
import 'package:dartz/dartz.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/failures.dart';
import '../../data/datasources/wallet_remote_datasource.dart';
import '../../data/repositories/wallet_repository_impl.dart';
import '../../domain/entities/wallet_entity.dart';
import '../../domain/repositories/wallet_repository.dart';

// ── Data layer ─────────────────────────────────────────────
final walletRemoteDataSourceProvider = Provider<WalletRemoteDataSource>((ref) {
  return WalletRemoteDataSourceImpl(ref.read(dioClientProvider));
});

final walletRepositoryProvider = Provider<WalletRepository>((ref) {
  return WalletRepositoryImpl(
    remote: ref.read(walletRemoteDataSourceProvider),
    networkInfo: ref.read(networkInfoProvider),
    hiveStorage: ref.read(hiveStorageProvider),
  );
});

// ── Wallet state notifier with polling ────────────────────
class WalletNotifier extends StateNotifier<AsyncValue<WalletEntity>> {
  WalletNotifier(this._repository) : super(const AsyncValue.loading()) {
    _load();
    _startPolling();
  }

  final WalletRepository _repository;
  Timer? _pollTimer;

  Future<void> _load({bool forceRefresh = false}) async {
    final result = await _repository.getBalance(forceRefresh: forceRefresh);
    result.fold((failure) {
      // Keep showing stale data on error rather than wiping the UI
      if (!state.hasValue) {
        state = AsyncValue.error(failure, StackTrace.current);
      }
    }, (wallet) => state = AsyncValue.data(wallet));
  }

  void _startPolling() {
    _pollTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      _load(forceRefresh: true);
    });
  }

  Future<void> refresh() => _load(forceRefresh: true);

  Future<Either<Failure, Map<String, dynamic>>> fundWallet({
    required double amount,
    required String paymentMethod,
  }) async {
    final result = await _repository.fundWallet(
      amount: amount,
      paymentMethod: paymentMethod,
    );
    result.fold((_) {}, (_) => refresh());
    return result;
  }

  Future<Either<Failure, Map<String, dynamic>>> createDynamicFunding({
    required double amount,
  }) async {
    return _repository.createDynamicFunding(amount: amount);
  }

  Future<Either<Failure, Map<String, dynamic>>> redeemCoupon({
    required String code,
  }) async {
    final result = await _repository.redeemCoupon(code: code);
    result.fold((_) {}, (_) => refresh());
    return result;
  }

  Future<Either<Failure, Map<String, dynamic>>> verifyFunding({
    required String reference,
  }) async {
    final result = await _repository.verifyFunding(reference: reference);
    result.fold((_) {}, (_) => refresh());
    return result;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}

final walletNotifierProvider =
    StateNotifierProvider<WalletNotifier, AsyncValue<WalletEntity>>((ref) {
      return WalletNotifier(ref.read(walletRepositoryProvider));
    });

// ── Balance visibility toggle (persisted to settings) ─────
final balanceVisibilityProvider = StateProvider<bool>((ref) {
  final hive = ref.read(hiveStorageProvider);
  return hive.getSetting<bool>('balance_hidden', defaultValue: false) ?? false;
});
