import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';

/// Result of a successful login/register call. Wrapping the user together
/// with [requiresLoginPinSetup] lets the UI/notifier layer decide whether to
/// force the mandatory "create your login PIN" screen right after this call,
/// without a second round trip.
class AuthLoginResult {
  const AuthLoginResult({
    required this.user,
    this.requiresLoginPinSetup = false,
  });

  final UserEntity user;
  final bool requiresLoginPinSetup;
}

abstract class AuthRepository {
  /// Login with email/phone + password. [loginPin] must be supplied once the
  /// account already has a 6-digit login PIN set - the backend rejects the
  /// request with code LOGIN_PIN_REQUIRED otherwise (this is what forces
  /// password + PIN together on a new/unrecognized device).
  Future<Either<Failure, AuthLoginResult>> login({
    required String identifier, // email or phone
    required String password,
    String? loginPin,
    bool rememberMe = false,
  });

  /// Register a new account. Returns AuthLoginResult so the caller knows
  /// whether the mandatory login-PIN setup screen must follow (it always
  /// will for a brand new account).
  Future<Either<Failure, AuthLoginResult>> register({
    required String fullName,
    required String email,
    required String phone,
    required String password,
    String? referralCode,
  });

  /// Send OTP to phone or email
  Future<Either<Failure, void>> sendOtp({
    required String destination,
    required String purpose, // 'register' | 'login' | 'reset_password'
  });

  /// Verify OTP code
  Future<Either<Failure, UserEntity>> verifyOtp({
    required String destination,
    required String otp,
    required String purpose,
  });

  /// Forgot password — send reset link/code
  Future<Either<Failure, void>> forgotPassword({required String email});

  /// Reset password with token
  Future<Either<Failure, void>> resetPassword({
    required String email,
    required String token,
    required String newPassword,
  });

  /// Get currently cached/authenticated user
  Future<Either<Failure, UserEntity>> getCurrentUser({bool forceRefresh = false});

  /// Check if user has a valid session
  Future<bool> hasValidSession();

  /// Logout — clear tokens and cache
  Future<Either<Failure, void>> logout();

  /// Biometric login (re-authenticate with stored token after biometric check)
  Future<Either<Failure, UserEntity>> biometricLogin();

  /// Set transaction PIN (first time)
  Future<Either<Failure, void>> setTransactionPin({required String pin});

  /// Verify transaction PIN before sensitive operations
  Future<Either<Failure, bool>> verifyTransactionPin({required String pin});

  /// Change transaction PIN
  Future<Either<Failure, void>> changeTransactionPin({
    required String oldPin,
    required String newPin,
  });

  /// Set the 6-digit login PIN (first time, mandatory right after login)
  Future<Either<Failure, void>> setLoginPin({required String pin});

  /// Change the existing 6-digit login PIN
  Future<Either<Failure, void>> changeLoginPin({
    required String oldPin,
    required String newPin,
  });

  /// Verify the login PIN locally (no server round trip) to unlock the app
  /// on a device that already holds a valid session.
  Future<Either<Failure, bool>> unlockWithLoginPin({required String pin});

  /// Change account password
  Future<Either<Failure, void>> changePassword({
    required String oldPassword,
    required String newPassword,
  });
}
