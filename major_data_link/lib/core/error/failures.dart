import 'package:equatable/equatable.dart';

/// Sealed failure hierarchy for clean architecture error propagation.
/// All errors in the app should map to one of these types.
abstract class Failure extends Equatable {
  const Failure({required this.message, this.code});

  final String message;
  final String? code;

  @override
  List<Object?> get props => [message, code];
}

// ── Network ───────────────────────────────────────────────────
class NetworkFailure extends Failure {
  const NetworkFailure({
    super.message = 'No internet connection. Check your network and try again.',
    super.code = 'NETWORK_ERROR',
  });
}

class TimeoutFailure extends Failure {
  const TimeoutFailure({
    super.message = 'Request timed out. Please try again.',
    super.code = 'TIMEOUT',
  });
}

// ── Server ────────────────────────────────────────────────────
class ServerFailure extends Failure {
  const ServerFailure({
    required super.message,
    super.code = 'SERVER_ERROR',
  });

  factory ServerFailure.fromStatusCode(int statusCode, String? message) {
    return ServerFailure(
      message: message ?? _defaultMessage(statusCode),
      code: statusCode.toString(),
    );
  }

  static String _defaultMessage(int code) {
    switch (code) {
      case 400:
        return 'Bad request. Please check your input.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 422:
        return 'Validation error. Please check your input.';
      case 429:
        return 'Too many requests. Please slow down.';
      case 500:
        return 'Our servers are busy. Please try again shortly.';
      case 503:
        return 'Service temporarily unavailable. Try again later.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}

// ── Auth ──────────────────────────────────────────────────────
class AuthFailure extends Failure {
  const AuthFailure({
    required super.message,
    super.code = 'AUTH_ERROR',
  });

  const AuthFailure.invalidCredentials()
      : this(message: 'Invalid email or password.', code: 'INVALID_CREDENTIALS');

  const AuthFailure.sessionExpired()
      : this(
          message: 'Your session has expired. Please sign in again.',
          code: 'SESSION_EXPIRED',
        );

  const AuthFailure.accountDisabled()
      : this(
          message: 'Your account has been suspended. Contact support.',
          code: 'ACCOUNT_DISABLED',
        );

  const AuthFailure.emailNotVerified()
      : this(
          message: 'Please verify your email before signing in.',
          code: 'EMAIL_NOT_VERIFIED',
        );
}

// ── Validation ────────────────────────────────────────────────
class ValidationFailure extends Failure {
  const ValidationFailure({
    required super.message,
    super.code = 'VALIDATION_ERROR',
    this.fieldErrors,
  });

  final Map<String, List<String>>? fieldErrors;

  @override
  List<Object?> get props => [message, code, fieldErrors];
}

// ── Payment ───────────────────────────────────────────────────
class PaymentFailure extends Failure {
  const PaymentFailure({
    required super.message,
    super.code = 'PAYMENT_ERROR',
  });

  const PaymentFailure.insufficientBalance()
      : this(
          message: 'Insufficient wallet balance.',
          code: 'INSUFFICIENT_BALANCE',
        );

  const PaymentFailure.transactionFailed()
      : this(
          message: 'Transaction failed. Please try again.',
          code: 'TRANSACTION_FAILED',
        );
}

// ── PIN ───────────────────────────────────────────────────────
class PinFailure extends Failure {
  const PinFailure({
    required super.message,
    super.code = 'PIN_ERROR',
    this.attemptsLeft,
  });

  final int? attemptsLeft;

  const PinFailure.wrong({int? attemptsLeft})
      : this(
          message: 'Incorrect PIN. Please try again.',
          code: 'WRONG_PIN',
          attemptsLeft: attemptsLeft,
        );

  const PinFailure.lockedOut()
      : this(
          message: 'Too many incorrect attempts. Try again in 30 minutes.',
          code: 'PIN_LOCKED_OUT',
        );
}

// ── Cache ─────────────────────────────────────────────────────
class CacheFailure extends Failure {
  const CacheFailure({
    super.message = 'Failed to load cached data.',
    super.code = 'CACHE_ERROR',
  });
}

// ── KYC ───────────────────────────────────────────────────────
class KycFailure extends Failure {
  const KycFailure({
    required super.message,
    super.code = 'KYC_ERROR',
  });
}

// ── Feature Not Available ─────────────────────────────────────
class FeatureUnavailableFailure extends Failure {
  const FeatureUnavailableFailure({
    super.message = 'This feature is temporarily unavailable.',
    super.code = 'FEATURE_UNAVAILABLE',
  });
}

// ── Unknown ───────────────────────────────────────────────────
class UnknownFailure extends Failure {
  const UnknownFailure({
    super.message = 'An unexpected error occurred. Please try again.',
    super.code = 'UNKNOWN_ERROR',
  });
}
