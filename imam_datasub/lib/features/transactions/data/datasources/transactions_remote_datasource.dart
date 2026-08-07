import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/error/error_handler.dart';
import '../../domain/entities/transaction_entity.dart';

abstract class TransactionsRemoteDataSource {
  Future<List<TransactionEntity>> getTransactions({
    int page = 1,
    int limit = 20,
    String? type,
    String? status,
    DateTime? from,
    DateTime? to,
    String? search,
  });

  Future<TransactionEntity> getTransactionDetail(String id);
}

class TransactionsRemoteDataSourceImpl implements TransactionsRemoteDataSource {
  const TransactionsRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<TransactionEntity>> getTransactions({
    int page = 1,
    int limit = 20,
    String? type,
    String? status,
    DateTime? from,
    DateTime? to,
    String? search,
  }) async {
    try {
      final response = await _dio.get(
        AppEndpoints.transactions,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (type != null) 'type': type,
          if (status != null) 'status': status,
          if (from != null) 'from': from.toIso8601String(),
          if (to != null) 'to': to.toIso8601String(),
          if (search != null && search.isNotEmpty) 'search': search,
        },
      );
      final list =
          (response.data['data'] ?? response.data) as List<dynamic>;
      return list
          .map((e) => TransactionEntity.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<TransactionEntity> getTransactionDetail(String id) async {
    try {
      final response = await _dio.get(AppEndpoints.transactionDetail(id));
      final data = response.data['data'] ?? response.data;
      return TransactionEntity.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}
