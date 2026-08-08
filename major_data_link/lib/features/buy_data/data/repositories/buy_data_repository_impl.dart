import 'package:dartz/dartz.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/network_info.dart';
import '../../../../core/storage/hive_storage.dart';
import '../../domain/entities/beneficiary_entity.dart';
import '../../domain/entities/data_plan_entity.dart';
import '../../domain/repositories/buy_data_repository.dart';
import '../datasources/beneficiary_local_datasource.dart';
import '../datasources/buy_data_remote_datasource.dart';

class BuyDataRepositoryImpl implements BuyDataRepository {
  BuyDataRepositoryImpl({
    required BuyDataRemoteDataSource remote,
    required BeneficiaryLocalDataSource beneficiaryLocal,
    required NetworkInfo networkInfo,
    required HiveStorage hive,
  })  : _remote = remote,
        _beneficiaryLocal = beneficiaryLocal,
        _networkInfo = networkInfo,
        _hive = hive;

  final BuyDataRemoteDataSource _remote;
  final BeneficiaryLocalDataSource _beneficiaryLocal;
  final NetworkInfo _networkInfo;
  final HiveStorage _hive;

  @override
  Future<Either<Failure, List<DataPlanEntity>>> getDataPlans(
    NetworkProvider network, {
    String? category,
    bool forceRefresh = false,
  }) async {
    final cacheKey = category == null || category.isEmpty
        ? 'data_plans_${network.code}'
        : 'data_plans_${network.code}_${category.toUpperCase()}';

    try {
      if (!forceRefresh) {
        final cached = _hive.get<List>(cacheKey);
        if (cached != null) {
          return Right(cached
              .map((e) => DataPlanEntity.fromJson(
                  Map<String, dynamic>.from(e as Map), network))
              .toList());
        }
      }

      if (!await _networkInfo.isConnected) {
        final cached = _hive.get<List>(cacheKey);
        if (cached != null) {
          return Right(cached
              .map((e) => DataPlanEntity.fromJson(
                  Map<String, dynamic>.from(e as Map), network))
              .toList());
        }
        return const Left(NetworkFailure());
      }

      final plans =
          await _remote.getDataPlans(network, category: category);
      await _hive.set(
        cacheKey,
        plans
            .map((p) => {
                  'id': p.id,
                  'size': p.size,
                  'validity': p.validity,
                  'price': p.price,
                  'category': p.category.name,
                  'planType': p.planTypeRaw,
                  'original_price': p.originalPrice,
                  'description': p.description,
                })
            .toList(),
        ttl: AppConfig.dataPlansCache,
      );
      return Right(plans);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, List<DataTypeOption>>> getDataTypes(
    NetworkProvider network,
  ) async {
    try {
      if (!await _networkInfo.isConnected) {
        return const Left(NetworkFailure());
      }
      final types = await _remote.getDataTypes(network);
      return Right(types);
    } on AppException catch (e) {
      return Left(ErrorHandler.exceptionToFailure(e));
    } catch (e) {
      return Left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, DataPurchaseResult>> purchaseData({
    required NetworkProvider network,
    required DataPlanEntity plan,
    required String phone,
  }) async {
    if (!await _networkInfo.isConnected) {
      return const Left(NetworkFailure());
    }
    try {
      final result = await _remote.purchaseData(
        network: network,
        planId: plan.id,
        phone: phone,
        amount: plan.price,
      );

      if (result.success) {
        // Invalidate wallet balance cache
        await _hive.remove('wallet_balance');
      }

      return Right(DataPurchaseResult(
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
    return _beneficiaryLocal.getBeneficiaries(BeneficiaryType.data);
  }

  @override
  Future<void> saveBeneficiary({
    required String phone,
    required String label,
    required NetworkProvider network,
  }) {
    return _beneficiaryLocal.saveBeneficiary(
      BeneficiaryEntity(
        id: '',
        type: BeneficiaryType.data,
        value: phone,
        label: label.isEmpty ? phone : label,
        network: network.code,
      ),
    );
  }

  @override
  Future<void> deleteBeneficiary(String id) {
    return _beneficiaryLocal.deleteBeneficiary(id);
  }
}
