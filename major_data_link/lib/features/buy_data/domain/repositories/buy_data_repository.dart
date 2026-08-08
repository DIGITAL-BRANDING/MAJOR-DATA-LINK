import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../../data/datasources/buy_data_remote_datasource.dart' show DataTypeOption;
import '../entities/beneficiary_entity.dart';
import '../entities/data_plan_entity.dart';

class DataPurchaseResult {
  const DataPurchaseResult({
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

abstract class BuyDataRepository {
  Future<Either<Failure, List<DataPlanEntity>>> getDataPlans(
    NetworkProvider network, {
    String? category,
    bool forceRefresh = false,
  });

  Future<Either<Failure, List<DataTypeOption>>> getDataTypes(
    NetworkProvider network,
  );

  Future<Either<Failure, DataPurchaseResult>> purchaseData({
    required NetworkProvider network,
    required DataPlanEntity plan,
    required String phone,
  });

  Future<List<BeneficiaryEntity>> getBeneficiaries();
  Future<void> saveBeneficiary({required String phone, required String label, required NetworkProvider network});
  Future<void> deleteBeneficiary(String id);
}
