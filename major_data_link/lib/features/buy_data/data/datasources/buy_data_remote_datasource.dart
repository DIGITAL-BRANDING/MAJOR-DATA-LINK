import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/error/error_handler.dart';
import '../../domain/entities/data_plan_entity.dart';

/// A Data Type (e.g. "SME", "GIFTING", "CORPORATE GIFTING") available for a
/// given network, matching Alrahuz's own "Select Data Type" step.
class DataTypeOption {
  const DataTypeOption({required this.category, required this.planCount});
  final String category;
  final int planCount;

  factory DataTypeOption.fromJson(Map<String, dynamic> json) {
    return DataTypeOption(
      category: json['category']?.toString() ?? '',
      planCount: (json['planCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class PurchaseResult {
  const PurchaseResult({
    required this.success,
    required this.reference,
    required this.message,
    this.balanceAfter,
  });

  final bool success;
  final String reference;
  final String message;
  final double? balanceAfter;

  factory PurchaseResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return PurchaseResult(
      success: json['status'] == true || json['status'] == 'success',
      reference: data['reference']?.toString() ??
          data['transaction_id']?.toString() ??
          '',
      message: json['message']?.toString() ?? 'Transaction successful',
      balanceAfter: data['balance_after'] != null
          ? double.tryParse(data['balance_after'].toString())
          : null,
    );
  }
}

abstract class BuyDataRemoteDataSource {
  Future<List<DataPlanEntity>> getDataPlans(
    NetworkProvider network, {
    String? category,
  });

  Future<List<DataTypeOption>> getDataTypes(NetworkProvider network);

  Future<PurchaseResult> purchaseData({
    required NetworkProvider network,
    required String planId,
    required String phone,
    required double amount,
  });
}

class BuyDataRemoteDataSourceImpl implements BuyDataRemoteDataSource {
  const BuyDataRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<DataPlanEntity>> getDataPlans(
    NetworkProvider network, {
    String? category,
  }) async {
    try {
      final response = await _dio.get(
        AppEndpoints.dataPlans(network.code),
        queryParameters:
            (category != null && category.isNotEmpty) ? {'category': category} : null,
      );
      final list = (response.data['data'] ?? response.data) as List<dynamic>;
      return list
          .map((e) =>
              DataPlanEntity.fromJson(e as Map<String, dynamic>, network))
          .toList();
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<List<DataTypeOption>> getDataTypes(NetworkProvider network) async {
    try {
      final response =
          await _dio.get(AppEndpoints.dataPlanCategories(network.code));
      final list = (response.data['data'] ?? response.data) as List<dynamic>;
      return list
          .map((e) => DataTypeOption.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<PurchaseResult> purchaseData({
    required NetworkProvider network,
    required String planId,
    required String phone,
    required double amount,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.purchaseData,
        data: {
          'network': network.code,
          'plan_id': planId,
          'phone': phone,
          'amount': amount,
        },
        options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
      );
      return PurchaseResult.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}
