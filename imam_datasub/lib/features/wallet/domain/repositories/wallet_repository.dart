import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/wallet_entity.dart';

abstract class WalletRepository {
  Future<Either<Failure, WalletEntity>> getBalance({bool forceRefresh = false});
  Future<Either<Failure, WalletEntity>> getVirtualAccount();
  Future<Either<Failure, Map<String, dynamic>>> fundWallet({
    required double amount,
    required String paymentMethod,
  });
  Future<Either<Failure, Map<String, dynamic>>> createDynamicFunding({
    required double amount,
  });
  Future<Either<Failure, Map<String, dynamic>>> redeemCoupon({
    required String code,
  });
  Future<Either<Failure, Map<String, dynamic>>> verifyFunding({
    required String reference,
  });
  Future<Either<Failure, void>> requestWithdrawal({
    required double amount,
    required String bankAccountNumber,
    required String bankCode,
    required String pin,
  });
}
