import 'package:dio/dio.dart';

import '../../storage/secure_storage.dart';
import '../../utils/logger.dart';
import '../token_refresh_coordinator.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._storage, this._refreshCoordinator, this._onSessionExpired);

  final SecureStorageService _storage;
  final TokenRefreshCoordinator _refreshCoordinator;
  final Future<void> Function() _onSessionExpired;

  bool _isAuthEndpoint(String path) {
    return path.contains('/auth/login') ||
        path.contains('/auth/register') ||
        path.contains('/auth/token/refresh');
  }

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    appLogger.api(options.method, options.path);

    // Proactively refresh before the token actually expires — this is what
    // keeps a user logged in across the full refresh-token lifetime instead
    // of being logged out the moment the (much shorter-lived) access token
    // expires. Skipped for the auth endpoints themselves: there's no session
    // yet to refresh, and it would just add pointless latency/loops.
    if (!_isAuthEndpoint(options.path)) {
      final ok = await _refreshCoordinator.ensureFreshToken();
      if (!ok) {
        await _onSessionExpired();
      }
    }

    final token = await _storage.getAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final alreadyRetried = err.requestOptions.extra['_auth_retried'] == true;
    final isAuthEndpoint = _isAuthEndpoint(err.requestOptions.path);

    // Reactive fallback: covers cases the proactive check above couldn't catch
    // (server-side revocation, clock skew between device and server). Only
    // ever retries once per request to avoid a loop.
    if (err.response?.statusCode == 401 && !alreadyRetried && !isAuthEndpoint) {
      appLogger.w('Got 401, attempting one token refresh + retry: ${err.requestOptions.path}');
      final refreshed = await _refreshCoordinator.forceRefresh();

      if (refreshed) {
        final token = await _storage.getAccessToken();
        final options = err.requestOptions;
        options.headers['Authorization'] = 'Bearer $token';
        options.extra['_auth_retried'] = true;

        try {
          final response = await Dio().fetch<dynamic>(options);
          return handler.resolve(response);
        } catch (_) {
          // Fall through to session-expired handling below.
        }
      }

      appLogger.w('Backend returned 401 and refresh failed. Session expired.');
      await _onSessionExpired();
    }

    return handler.next(err);
  }
}
