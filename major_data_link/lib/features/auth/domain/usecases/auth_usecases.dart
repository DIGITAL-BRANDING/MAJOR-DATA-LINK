import 'package:dartz/dartz.dart';
import '../../../../core/error/failures.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

// ── Login ──────────────────────────────────────────────────
class LoginUseCase {
  const LoginUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, AuthLoginResult>> call({
    required String identifier,
    required String password,
    String? loginPin,
    bool rememberMe = false,
  }) {
    return _repository.login(
      identifier: identifier,
      password: password,
      loginPin: loginPin,
      rememberMe: rememberMe,
    );
  }
}

// ── Register ───────────────────────────────────────────────
class RegisterUseCase {
  const RegisterUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, AuthLoginResult>> call({
    required String fullName,
    required String email,
    required String phone,
    required String password,
    String? referralCode,
  }) {
    return _repository.register(
      fullName: fullName,
      email: email,
      phone: phone,
      password: password,
      referralCode: referralCode,
    );
  }
}

// ── Send OTP ───────────────────────────────────────────────
class SendOtpUseCase {
  const SendOtpUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({
    required String destination,
    required String purpose,
  }) {
    return _repository.sendOtp(destination: destination, purpose: purpose);
  }
}

// ── Verify OTP ─────────────────────────────────────────────
class VerifyOtpUseCase {
  const VerifyOtpUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, UserEntity>> call({
    required String destination,
    required String otp,
    required String purpose,
  }) {
    return _repository.verifyOtp(
      destination: destination,
      otp: otp,
      purpose: purpose,
    );
  }
}

// ── Forgot Password ───────────────────────────────────────
class ForgotPasswordUseCase {
  const ForgotPasswordUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({required String email}) {
    return _repository.forgotPassword(email: email);
  }
}

// ── Reset Password ─────────────────────────────────────────
class ResetPasswordUseCase {
  const ResetPasswordUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({
    required String email,
    required String token,
    required String newPassword,
  }) {
    return _repository.resetPassword(
      email: email,
      token: token,
      newPassword: newPassword,
    );
  }
}

// ── Get Current User ──────────────────────────────────────
class GetCurrentUserUseCase {
  const GetCurrentUserUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, UserEntity>> call({bool forceRefresh = false}) {
    return _repository.getCurrentUser(forceRefresh: forceRefresh);
  }
}

// ── Logout ─────────────────────────────────────────────────
class LogoutUseCase {
  const LogoutUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call() => _repository.logout();
}

// ── Biometric Login ────────────────────────────────────────
class BiometricLoginUseCase {
  const BiometricLoginUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, UserEntity>> call() => _repository.biometricLogin();
}

// ── Set Transaction PIN ────────────────────────────────────
class SetTransactionPinUseCase {
  const SetTransactionPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({required String pin}) {
    return _repository.setTransactionPin(pin: pin);
  }
}

// ── Verify Transaction PIN ─────────────────────────────────
class VerifyTransactionPinUseCase {
  const VerifyTransactionPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, bool>> call({required String pin}) {
    return _repository.verifyTransactionPin(pin: pin);
  }
}

// ── Change Transaction PIN ─────────────────────────────────
class ChangeTransactionPinUseCase {
  const ChangeTransactionPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({
    required String oldPin,
    required String newPin,
  }) {
    return _repository.changeTransactionPin(oldPin: oldPin, newPin: newPin);
  }
}

// ── Set Login PIN (6-digit) ────────────────────────────────
class SetLoginPinUseCase {
  const SetLoginPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({required String pin}) {
    return _repository.setLoginPin(pin: pin);
  }
}

// ── Reset forgotten Login PIN via password ──────────────────
class ResetLoginPinUseCase {
  const ResetLoginPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, AuthLoginResult>> call({
    required String identifier,
    required String password,
  }) {
    return _repository.resetLoginPinWithPassword(
      identifier: identifier,
      password: password,
    );
  }
}

// ── Change Login PIN (6-digit) ─────────────────────────────
class ChangeLoginPinUseCase {
  const ChangeLoginPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({
    required String oldPin,
    required String newPin,
  }) {
    return _repository.changeLoginPin(oldPin: oldPin, newPin: newPin);
  }
}

// ── Unlock with Login PIN (local, no server round trip) ────
class UnlockWithLoginPinUseCase {
  const UnlockWithLoginPinUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, bool>> call({required String pin}) {
    return _repository.unlockWithLoginPin(pin: pin);
  }
}

// ── Change Password ────────────────────────────────────────
class ChangePasswordUseCase {
  const ChangePasswordUseCase(this._repository);
  final AuthRepository _repository;

  Future<Either<Failure, void>> call({
    required String oldPassword,
    required String newPassword,
  }) {
    return _repository.changePassword(
      oldPassword: oldPassword,
      newPassword: newPassword,
    );
  }
}
