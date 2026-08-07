import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/error/error_handler.dart';
import '../../../buy_data/data/datasources/buy_data_remote_datasource.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';

abstract class AirtimeRemoteDataSource {
  Future<PurchaseResult> purchaseAirtime({
    required NetworkProvider network,
    required String phone,
    required double amount,
  });
}

class AirtimeRemoteDataSourceImpl implements AirtimeRemoteDataSource {
  const AirtimeRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<PurchaseResult> purchaseAirtime({
    required NetworkProvider network,
    required String phone,
    required double amount,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.purchaseAirtime,
        data: {
          'network': network.code,
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
