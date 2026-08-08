import 'package:dio/dio.dart';
import 'exceptions.dart';
import 'failures.dart';

class ErrorHandler {
  ErrorHandler._();

  /// Convert a raw exception into a typed AppException
  static AppException handleException(dynamic error) {
    if (error is DioException) {
      return _handleDioException(error);
    }
    if (error is AppException) return error;
    return UnknownException(message: error.toString());
  }

  static AppException _handleDioException(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        if (error.error?.toString().contains('SocketException') == true ||
            error.error?.toString().contains('NetworkException') == true) {
          return const NetworkException();
        }
        return UnknownException(message: error.message ?? 'Unknown error');

      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.transformTimeout:
        return const TimeoutException();

      case DioExceptionType.badResponse:
        return _handleBadResponse(error.response);

      case DioExceptionType.cancel:
        return const AppException(
          message: 'Request was cancelled',
          code: 'REQUEST_CANCELLED',
        );

      case DioExceptionType.badCertificate:
        return const AppException(
          message: 'Security certificate error',
          code: 'BAD_CERTIFICATE',
        );
    }
  }

  static AppException _handleBadResponse(Response? response) {
    final statusCode = response?.statusCode ?? 0;
    final data = response?.data;

    String message = _extractMessage(data, statusCode);
    String? code = _extractCode(data);

    switch (statusCode) {
      case 400:
        final fieldErrors = _extractFieldErrors(data);
        if (fieldErrors != null) {
          return ValidationException(
            message: message,
            code: code ?? 'VALIDATION_ERROR',
            statusCode: statusCode,
            fieldErrors: fieldErrors,
          );
        }
        return ServerException(message: message, code: code, statusCode: statusCode);

      case 401:
        return AuthException(
          message: message.isNotEmpty ? message : 'Authentication required',
          code: code ?? 'UNAUTHORIZED',
          statusCode: statusCode,
        );

      case 403:
        return AuthException(
          message: message.isNotEmpty ? message : 'Access denied',
          code: code ?? 'FORBIDDEN',
          statusCode: statusCode,
        );

      case 422:
        return ValidationException(
          message: message,
          code: code ?? 'VALIDATION_ERROR',
          statusCode: statusCode,
          fieldErrors: _extractFieldErrors(data),
        );

      case 429:
        return ServerException(
          message: 'Too many requests. Please slow down.',
          code: 'RATE_LIMITED',
          statusCode: statusCode,
        );

      default:
        return ServerException(
          message: message,
          code: code,
          statusCode: statusCode,
        );
    }
  }

  static String _extractMessage(dynamic data, int statusCode) {
    if (data is Map<String, dynamic>) {
      return (data['message'] ??
              data['error'] ??
              data['msg'] ??
              _defaultMessage(statusCode))
          .toString();
    }
    return _defaultMessage(statusCode);
  }

  static String? _extractCode(dynamic data) {
    if (data is Map<String, dynamic>) {
      return data['code']?.toString() ?? data['error_code']?.toString();
    }
    return null;
  }

  static Map<String, List<String>>? _extractFieldErrors(dynamic data) {
    if (data is Map<String, dynamic>) {
      final errors = data['errors'];
      if (errors is Map<String, dynamic>) {
        return errors.map((key, value) {
          if (value is List) {
            return MapEntry(key, value.map((e) => e.toString()).toList());
          }
          return MapEntry(key, [value.toString()]);
        });
      }
    }
    return null;
  }

  static String _defaultMessage(int code) {
    switch (code) {
      case 400:
        return 'Bad request. Please check your input.';
      case 401:
        return 'Your session has expired. Please sign in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 422:
        return 'Please check your input and try again.';
      case 429:
        return 'Too many requests. Please slow down.';
      case 500:
        return 'Our servers are busy. Please try again shortly.';
      case 503:
        return 'Service temporarily unavailable.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  /// Convert Failure to user-friendly message
  static String getFailureMessage(Failure failure) {
    return failure.message;
  }

  /// Convert exception to Failure
  static Failure exceptionToFailure(AppException exception) {
    if (exception is NetworkException) {
      return const NetworkFailure();
    }
    if (exception is TimeoutException) {
      return const TimeoutFailure();
    }
    if (exception is AuthException) {
      return AuthFailure(message: exception.message, code: exception.code);
    }
    if (exception is ValidationException) {
      return ValidationFailure(
        message: exception.message,
        code: exception.code,
        fieldErrors: exception.fieldErrors,
      );
    }
    if (exception is PaymentException) {
      return PaymentFailure(message: exception.message, code: exception.code);
    }
    if (exception is PinException) {
      return PinFailure(
        message: exception.message,
        code: exception.code,
        attemptsLeft: exception.attemptsLeft,
      );
    }
    if (exception is CacheException) {
      return const CacheFailure();
    }
    if (exception is KycException) {
      return KycFailure(message: exception.message, code: exception.code);
    }
    if (exception is ServerException) {
      return ServerFailure(message: exception.message, code: exception.code);
    }
    return UnknownFailure(message: exception.message);
  }
}