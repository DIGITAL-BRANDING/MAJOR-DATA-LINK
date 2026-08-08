import 'package:dio/dio.dart';
import '../../config/app_config.dart';
import '../../utils/logger.dart';

class RetryInterceptor extends Interceptor {
  RetryInterceptor(this._dio);

  final Dio _dio;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final attempt = err.requestOptions.extra['_retry_attempt'] as int? ?? 0;

    // Only retry on network errors and 5xx, not auth/validation errors
    if (!_shouldRetry(err) || attempt >= AppConfig.maxRetries) {
      return handler.next(err);
    }

    appLogger.w(
      'Retrying request (${attempt + 1}/${AppConfig.maxRetries}): ${err.requestOptions.path}',
    );

    // Exponential backoff: 2s, 4s, 8s
    final delay = Duration(seconds: (2 << attempt).clamp(1, 16));
    await Future.delayed(delay);

    try {
      final options = err.requestOptions;
      options.extra['_retry_attempt'] = attempt + 1;

      final response = await _dio.request<dynamic>(
        options.path,
        data: options.data,
        queryParameters: options.queryParameters,
        options: Options(
          method: options.method,
          headers: options.headers,
          responseType: options.responseType,
          extra: options.extra,
        ),
      );

      return handler.resolve(response);
    } on DioException catch (retryErr) {
      return handler.next(retryErr);
    }
  }

  bool _shouldRetry(DioException err) {
    // Retry on connection / timeout errors
    if (err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout) {
      return true;
    }

    // Retry on 5xx server errors (not 4xx client errors)
    final statusCode = err.response?.statusCode;
    if (statusCode != null && statusCode >= 500) {
      return true;
    }

    return false;
  }
}
