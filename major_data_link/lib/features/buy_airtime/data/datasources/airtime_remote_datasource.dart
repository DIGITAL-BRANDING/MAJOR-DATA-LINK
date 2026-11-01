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
    required String pin,
  });
}

class AirtimeRemoteDataSourceImpl implements AirtimeRemoteDataSource {
  AirtimeRemoteDataSourceImpl(this._dio);
  final Dio _dio;
  final Map<String, String> _purchaseKeys = {};

  @override
  Future<PurchaseResult> purchaseAirtime({
    required NetworkProvider network,
    required String phone,
    required double amount,
    required String pin,
  }) async {
    try {
      final fingerprint = '${network.code}|${phone.trim()}|$amount';
      final key = _purchaseKeys.putIfAbsent(fingerprint, () => const Uuid().v4());
      final response = await _dio.post(
        AppEndpoints.purchaseAirtime,
        data: {
          'network': network.code,
          'phone': phone,
          'amount': amount,
          'pin': pin,
        },
        options: Options(headers: {'Idempotency-Key': key}, receiveTimeout: const Duration(seconds: 45)),
      );
      final result = PurchaseResult.fromJson(response.data as Map<String, dynamic>);
      if (!result.confirmationRequired) _purchaseKeys.remove(fingerprint);
      return result;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}
