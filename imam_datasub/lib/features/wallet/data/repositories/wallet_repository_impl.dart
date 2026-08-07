import 'package:dartz/dartz.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../../../core/storage/hive_storage.dart';
import '../../domain/entities/wallet_entity.dart';
import '../../domain/repositories/wallet_repository.dart';
import '../datasources/wallet_remote_datasource.dart';
import '../models/wallet_model.dart';

class WalletRepositoryImpl implements WalletRepository {
  WalletRepositoryImpl({
    required WalletRemoteDataSource remote,
    required NetworkInfo networkInfo,
    required HiveStorage hiveStorage,
  }) : _remote = remote,
       _networkInfo = networkInfo,
       _hive = hiveStorage;

  final WalletRemoteDataSource _remote;
  final NetworkInfo _networkInfo;
  final HiveStorage _hive;

  static const _cacheKey = 'wallet_balance';

  @override
  Future<Either<Failure, WalletEntity>> getBalance({
    bool forceRefresh = false,
  }) async {
    try {
      if (!forceRefresh) {
        final cached = _hive.get<Map>(_cacheKey);
        if (cached != null) {
          return Right(
            WalletModel.fromCache(Map<String, dynamic>.from(cached)),
          );
        }
      }

      if (!await _networkInfo.isConnected) {
        final cached = _hive.get<Map>(_cacheKey);
        if (cached != null) {
          return Right(
            WalletModel.fromCache(Map<String, dynamic>.from(cached)),
          );
        }
        return const Left(NetworkFailure());
      }

      final wallet = await _remote.getBalance();
      await _hive.set(
        _cacheKey,
        wallet.toJson(),
        ttl: AppConfig.walletBalanceCache,
      );
      return Right(wallet);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, WalletEntity>> getVirtualAccount() async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final wallet = await _remote.getVirtualAccount();
      return Right(wallet);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> fundWallet({
    required double amount,
    required String paymentMethod,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final result = await _remote.fundWallet(
        amount: amount,
        paymentMethod: paymentMethod,
      );
      await _hive.remove(_cacheKey); // Invalidate cache
      return Right(result);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> createDynamicFunding({
    required double amount,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final result = await _remote.createDynamicFunding(amount: amount);
      return Right(result);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> redeemCoupon({
    required String code,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final result = await _remote.redeemCoupon(code: code);
      await _hive.remove(_cacheKey);
      return Right(result);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, Map<String, dynamic>>> verifyFunding({
    required String reference,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final result = await _remote.verifyFunding(reference: reference);
      await _hive.remove(
        _cacheKey,
      ); // Invalidate cache — balance may have changed
      return Right(result);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> requestWithdrawal({
    required double amount,
    required String bankAccountNumber,
    required String bankCode,
    required String pin,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      await _remote.requestWithdrawal(
        amount: amount,
        bankAccountNumber: bankAccountNumber,
        bankCode: bankCode,
        pin: pin,
      );
      await _hive.remove(_cacheKey);
      return const Right(null);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }
}
