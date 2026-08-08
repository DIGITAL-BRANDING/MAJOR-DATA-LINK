import 'package:dartz/dartz.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../../../core/storage/hive_storage.dart';
import '../../../buy_data/data/datasources/beneficiary_local_datasource.dart';
import '../../../buy_data/domain/entities/beneficiary_entity.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';
import '../datasources/airtime_remote_datasource.dart';

class AirtimePurchaseResult {
  const AirtimePurchaseResult({
    required this.success,
    required this.reference,
    required this.message,
    this.balanceAfter,
  });

  final bool success;
  final String reference;
  final String message;
  final double? balanceAfter;
}

abstract class AirtimeRepository {
  Future<Either<Failure, AirtimePurchaseResult>> purchaseAirtime({
    required NetworkProvider network,
    required String phone,
    required double amount,
  });

  Future<List<BeneficiaryEntity>> getBeneficiaries();
  Future<void> saveBeneficiary({
    required String phone,
    required NetworkProvider network,
  });
}

class AirtimeRepositoryImpl implements AirtimeRepository {
  AirtimeRepositoryImpl({
    required AirtimeRemoteDataSource remote,
    required BeneficiaryLocalDataSource beneficiaryLocal,
    required NetworkInfo networkInfo,
    required HiveStorage hive,
  })  : _remote = remote,
        _beneficiaryLocal = beneficiaryLocal,
        _networkInfo = networkInfo,
        _hive = hive;

  final AirtimeRemoteDataSource _remote;
  final BeneficiaryLocalDataSource _beneficiaryLocal;
  final NetworkInfo _networkInfo;
  final HiveStorage _hive;

  @override
  Future<Either<Failure, AirtimePurchaseResult>> purchaseAirtime({
    required NetworkProvider network,
    required String phone,
    required double amount,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final result = await _remote.purchaseAirtime(
        network: network,
        phone: phone,
        amount: amount,
      );
      if (result.success) {
        await _hive.remove('wallet_balance');
      }
      return Right(AirtimePurchaseResult(
        success: result.success,
        reference: result.reference,
        message: result.message,
        balanceAfter: result.balanceAfter,
      ));
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<List<BeneficiaryEntity>> getBeneficiaries() {
    return _beneficiaryLocal.getBeneficiaries(BeneficiaryType.airtime);
  }

  @override
  Future<void> saveBeneficiary({
    required String phone,
    required NetworkProvider network,
  }) {
    return _beneficiaryLocal.saveBeneficiary(
      BeneficiaryEntity(
        id: '',
        type: BeneficiaryType.airtime,
        value: phone,
        label: phone,
        network: network.code,
      ),
    );
  }
}
