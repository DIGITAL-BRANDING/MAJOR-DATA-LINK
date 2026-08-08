import '../../../../core/error/exceptions.dart';
import '../../../../core/security/aes_encryption.dart';
import '../../../../core/storage/hive_storage.dart';
import '../../../../core/storage/secure_storage.dart';
import '../models/auth_response_model.dart';
import '../models/user_model.dart';

abstract class AuthLocalDataSource {
  Future<void> cacheAuthResponse(AuthResponseModel response);
  Future<void> cacheUser(UserModel user);
  Future<UserModel?> getCachedUser();
  Future<String?> getAccessToken();
  Future<bool> hasValidSession();
  Future<void> clearSession();

  // Transaction PIN management (4-digit)
  Future<void> savePinLocally(String pin);
  Future<bool> verifyPinLocally(String pin);
  Future<bool> hasPinSet();
  Future<void> recordFailedPinAttempt();
  Future<void> resetPinAttempts();
  Future<bool> isPinLockedOut();
  Future<int> getRemainingPinAttempts();

  // Login PIN management (6-digit) — unlocks the app locally on a
  // device that already holds a valid session. Kept entirely separate
  // from the transaction PIN above.
  Future<void> saveLoginPinLocally(String pin);
  Future<bool> verifyLoginPinLocally(String pin);
  Future<bool> hasLoginPinSet();
  Future<void> recordFailedLoginPinAttempt();
  Future<void> resetLoginPinAttempts();
  Future<bool> isLoginPinLockedOut();
  Future<int> getRemainingLoginPinAttempts();

  // Biometric
  Future<void> setBiometricEnabled(bool enabled);
  Future<bool> isBiometricEnabled();

  // Remember me
  Future<void> saveRememberedIdentifier(String identifier);
  Future<String?> getRememberedIdentifier();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  AuthLocalDataSourceImpl(this._secureStorage, this._hiveStorage);

  final SecureStorageService _secureStorage;
  final HiveStorage _hiveStorage;

  static const int _maxPinAttempts = 5;
  static const _pinLockoutDuration = Duration(minutes: 30);

  @override
  Future<void> cacheAuthResponse(AuthResponseModel response) async {
    await _secureStorage.saveAccessToken(response.accessToken);
    await _secureStorage.saveRefreshToken(response.refreshToken);
    await _secureStorage.saveTokenExpiry(response.expiryDateTime);
    await _secureStorage.saveUserId(response.user.id);
    await cacheUser(response.user);
  }

  @override
  Future<void> cacheUser(UserModel user) async {
    await _hiveStorage.saveUser(user.toJson());
  }

  @override
  Future<UserModel?> getCachedUser() async {
    final json = _hiveStorage.getUser();
    if (json == null) return null;
    try {
      return UserModel.fromJson(json);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<String?> getAccessToken() => _secureStorage.getAccessToken();

  @override
  Future<bool> hasValidSession() async {
    final token = await _secureStorage.getAccessToken();
    if (token == null) return false;
    final isExpired = await _secureStorage.isTokenExpired();
    final refreshToken = await _secureStorage.getRefreshToken();
    // Valid if token isn't expired, OR we have a refresh token to renew it
    return !isExpired || refreshToken != null;
  }

  @override
  Future<void> clearSession() async {
    await _secureStorage.clearAuth();
    await _hiveStorage.clearUserData();
    await _secureStorage.clearLoginPin();
    await _secureStorage.clearLoginPinLockout();
  }

  // ── PIN ──────────────────────────────────────────────────
  @override
  Future<void> savePinLocally(String pin) async {
    final salt = AesEncryption.generateSalt();
    final hash = AesEncryption.hashPin(pin, salt);
    await _secureStorage.savePin('$salt:$hash');
    await resetPinAttempts();
  }

  @override
  Future<bool> verifyPinLocally(String pin) async {
    final stored = await _secureStorage.getPin();
    if (stored == null || !stored.contains(':')) return false;

    final parts = stored.split(':');
    final salt = parts[0];
    final hash = parts[1];

    final isValid = AesEncryption.verifyPin(pin, hash, salt);

    if (isValid) {
      await resetPinAttempts();
    } else {
      await recordFailedPinAttempt();
    }

    return isValid;
  }

  @override
  Future<bool> hasPinSet() => _secureStorage.hasPin();

  @override
  Future<void> recordFailedPinAttempt() async {
    final attempts = await _secureStorage.getPinAttempts();
    final newAttempts = attempts + 1;
    await _secureStorage.savePinAttempts(newAttempts);

    if (newAttempts >= _maxPinAttempts) {
      await _secureStorage.savePinLockoutUntil(
        DateTime.now().add(_pinLockoutDuration),
      );
    }
  }

  @override
  Future<void> resetPinAttempts() => _secureStorage.clearPinLockout();

  @override
  Future<bool> isPinLockedOut() async {
    final lockoutUntil = await _secureStorage.getPinLockoutUntil();
    if (lockoutUntil == null) return false;
    if (DateTime.now().isAfter(lockoutUntil)) {
      await resetPinAttempts();
      return false;
    }
    return true;
  }

  @override
  Future<int> getRemainingPinAttempts() async {
    final attempts = await _secureStorage.getPinAttempts();
    return (_maxPinAttempts - attempts).clamp(0, _maxPinAttempts);
  }

  // ── Login PIN (6-digit) ───────────────────────────────────
  @override
  Future<void> saveLoginPinLocally(String pin) async {
    final salt = AesEncryption.generateSalt();
    final hash = AesEncryption.hashPin(pin, salt);
    await _secureStorage.saveLoginPin('$salt:$hash');
    await resetLoginPinAttempts();
  }

  @override
  Future<bool> verifyLoginPinLocally(String pin) async {
    final stored = await _secureStorage.getLoginPin();
    if (stored == null || !stored.contains(':')) return false;

    final parts = stored.split(':');
    final salt = parts[0];
    final hash = parts[1];

    final isValid = AesEncryption.verifyPin(pin, hash, salt);

    if (isValid) {
      await resetLoginPinAttempts();
    } else {
      await recordFailedLoginPinAttempt();
    }

    return isValid;
  }

  @override
  Future<bool> hasLoginPinSet() => _secureStorage.hasLoginPin();

  @override
  Future<void> recordFailedLoginPinAttempt() async {
    final attempts = await _secureStorage.getLoginPinAttempts();
    final newAttempts = attempts + 1;
    await _secureStorage.saveLoginPinAttempts(newAttempts);

    if (newAttempts >= _maxPinAttempts) {
      await _secureStorage.saveLoginPinLockoutUntil(
        DateTime.now().add(_pinLockoutDuration),
      );
    }
  }

  @override
  Future<void> resetLoginPinAttempts() => _secureStorage.clearLoginPinLockout();

  @override
  Future<bool> isLoginPinLockedOut() async {
    final lockoutUntil = await _secureStorage.getLoginPinLockoutUntil();
    if (lockoutUntil == null) return false;
    if (DateTime.now().isAfter(lockoutUntil)) {
      await resetLoginPinAttempts();
      return false;
    }
    return true;
  }

  @override
  Future<int> getRemainingLoginPinAttempts() async {
    final attempts = await _secureStorage.getLoginPinAttempts();
    return (_maxPinAttempts - attempts).clamp(0, _maxPinAttempts);
  }

  // ── Biometric ────────────────────────────────────────────
  @override
  Future<void> setBiometricEnabled(bool enabled) =>
      _secureStorage.setBiometricEnabled(enabled);

  @override
  Future<bool> isBiometricEnabled() => _secureStorage.isBiometricEnabled();

  // ── Remember me ──────────────────────────────────────────
  @override
  Future<void> saveRememberedIdentifier(String identifier) =>
      _secureStorage.saveRememberedEmail(identifier);

  @override
  Future<String?> getRememberedIdentifier() =>
      _secureStorage.getRememberedEmail();
}
