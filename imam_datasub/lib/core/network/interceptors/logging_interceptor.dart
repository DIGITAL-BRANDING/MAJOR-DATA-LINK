import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../utils/logger.dart';

class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (kDebugMode) {
      appLogger.d(
        '→ ${options.method} ${options.uri}',
        error: options.data != null ? 'Body: ${options.data}' : null,
      );
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    if (kDebugMode) {
      appLogger.d(
        '← ${response.statusCode} ${response.requestOptions.uri}',
        error: 'Response: ${response.data}',
      );
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    appLogger.e(
      '✕ ${err.requestOptions.method} ${err.requestOptions.uri} → ${err.response?.statusCode}',
      error: err.message,
      stackTrace: err.stackTrace,
    );
    handler.next(err);
  }
}
