/// Data layer exceptions — thrown by data sources, caught by repositories
/// and converted to Failure types via Either<Failure, T>

class AppException implements Exception {
  const AppException({required this.message, this.code, this.statusCode});

  final String message;
  final String? code;
  final int? statusCode;

  @override
  String toString() => 'AppException: $message (code: $code, status: $statusCode)';
}

class NetworkException extends AppException {
  const NetworkException({
    super.message = 'No internet connection',
    super.code = 'NETWORK_ERROR',
  });
}

class TimeoutException extends AppException {
  const TimeoutException({
    super.message = 'Request timed out',
    super.code = 'TIMEOUT',
  });
}

class ServerException extends AppException {
  const ServerException({
    required super.message,
    super.code = 'SERVER_ERROR',
    super.statusCode,
  });
}

class AuthException extends AppException {
  const AuthException({
    required super.message,
    super.code = 'AUTH_ERROR',
    super.statusCode,
  });
}

class ValidationException extends AppException {
  const ValidationException({
    required super.message,
    super.code = 'VALIDATION_ERROR',
    super.statusCode,
    this.fieldErrors,
  });

  final Map<String, List<String>>? fieldErrors;
}

class PaymentException extends AppException {
  const PaymentException({
    required super.message,
    super.code = 'PAYMENT_ERROR',
    super.statusCode,
  });
}

class PinException extends AppException {
  const PinException({
    required super.message,
    super.code = 'PIN_ERROR',
    this.attemptsLeft,
  });

  final int? attemptsLeft;
}

class CacheException extends AppException {
  const CacheException({
    super.message = 'Cache operation failed',
    super.code = 'CACHE_ERROR',
  });
}

class KycException extends AppException {
  const KycException({
    required super.message,
    super.code = 'KYC_ERROR',
  });
}

class UnknownException extends AppException {
  const UnknownException({
    super.message = 'An unexpected error occurred',
    super.code = 'UNKNOWN_ERROR',
  });
}
