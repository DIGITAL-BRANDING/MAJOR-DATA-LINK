import 'package:dio/dio.dart';
import '../config/app_config.dart';
import '../storage/secure_storage.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/logging_interceptor.dart';
import 'interceptors/retry_interceptor.dart';
import 'token_refresh_coordinator.dart';

class DioClient {
  DioClient._();

  static Dio create({
    required SecureStorageService storage,
    required TokenRefreshCoordinator refreshCoordinator,
    required Future<void> Function() onSessionExpired,
  }) {
    final dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.baseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        sendTimeout: AppConfig.sendTimeout,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        validateStatus: (status) => status != null && status < 400,
        followRedirects: true,
        maxRedirects: 3,
      ),
    );

    // Order matters: logging → auth → retry
    dio.interceptors.addAll([
      LoggingInterceptor(),
      AuthInterceptor(storage, refreshCoordinator, onSessionExpired),
      RetryInterceptor(dio),
    ]);

    return dio;
  }
}
