import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../utils/logger.dart';

/// All keys in one place to prevent typos
abstract class _Keys {
  static const accessToken = 'kd_access_token';
  static const refreshToken = 'kd_refresh_token';
  static const tokenExpiry = 'kd_token_expiry';
  static const transactionPin = 'kd_tx_pin';
  static const biometricEnabled = 'kd_biometric_enabled';
  static const deviceId = 'kd_device_id';
  static const hiveEncryptionKey = 'kd_hive_key';
  static const userId = 'kd_user_id';
  static const pinAttempts = 'kd_pin_attempts';
  static const pinLockoutUntil = 'kd_pin_lockout';
  static const loginPin = 'kd_login_pin';
  static const loginPinAttempts = 'kd_login_pin_attempts';
  static const loginPinLockoutUntil = 'kd_login_pin_lockout';
  static const fcmToken = 'kd_fcm_token';
  static const onboardingComplete = 'kd_onboarding_done';
  static const rememberEmail = 'kd_remember_email';
}

class SecureStorageService {
  SecureStorageService() : _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
      keyCipherAlgorithm: KeyCipherAlgorithm.RSA_ECB_OAEPwithSHA_256andMGF1Padding,
      storageCipherAlgorithm: StorageCipherAlgorithm.AES_GCM_NoPadding,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  final FlutterSecureStorage _storage;

  // ── Auth Tokens ──────────────────────────────────────────
  Future<void> saveAccessToken(String token) =>
      _write(_Keys.accessToken, token);

  Future<String?> getAccessToken() => _read(_Keys.accessToken);

  Future<void> saveRefreshToken(String token) =>
      _write(_Keys.refreshToken, token);

  Future<String?> getRefreshToken() => _read(_Keys.refreshToken);

  Future<void> saveTokenExpiry(DateTime expiry) =>
      _write(_Keys.tokenExpiry, expiry.millisecondsSinceEpoch.toString());

  Future<DateTime?> getTokenExpiry() async {
    final raw = await _read(_Keys.tokenExpiry);
    if (raw == null) return null;
    final ms = int.tryParse(raw);
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<bool> isTokenExpired() async {
    final expiry = await getTokenExpiry();
    if (expiry == null) return true;
    return DateTime.now().isAfter(
      expiry.subtract(const Duration(minutes: 5)),
    );
  }

  Future<void> clearAuth() async {
    await _delete(_Keys.accessToken);
    await _delete(_Keys.refreshToken);
    await _delete(_Keys.tokenExpiry);
  }

  // ── User ─────────────────────────────────────────────────
  Future<void> saveUserId(String id) => _write(_Keys.userId, id);
  Future<String?> getUserId() => _read(_Keys.userId);

  // ── Transaction PIN ───────────────────────────────────────
  /// Save hashed PIN — never store plain text
  Future<void> savePin(String hashedPin) => _write(_Keys.transactionPin, hashedPin);
  Future<String?> getPin() => _read(_Keys.transactionPin);
  Future<bool> hasPin() async => (await _read(_Keys.transactionPin)) != null;
  Future<void> clearPin() => _delete(_Keys.transactionPin);

  // ── PIN Lockout ───────────────────────────────────────────
  Future<void> savePinAttempts(int attempts) =>
      _write(_Keys.pinAttempts, attempts.toString());

  Future<int> getPinAttempts() async {
    final raw = await _read(_Keys.pinAttempts);
    return int.tryParse(raw ?? '0') ?? 0;
  }

  Future<void> savePinLockoutUntil(DateTime until) =>
      _write(_Keys.pinLockoutUntil, until.millisecondsSinceEpoch.toString());

  Future<DateTime?> getPinLockoutUntil() async {
    final raw = await _read(_Keys.pinLockoutUntil);
    if (raw == null) return null;
    final ms = int.tryParse(raw);
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<void> clearPinLockout() async {
    await _delete(_Keys.pinAttempts);
    await _delete(_Keys.pinLockoutUntil);
  }

  // ── Login PIN (6-digit, used to unlock the app locally) ────
  // Namespaced by the currently cached userId (see saveUserId, written on
  // every login/register in cacheAuthResponse) rather than one fixed key.
  // Un-namespaced, this device would treat "a PIN exists" as true for ANY
  // account that ever set one here - so a second, genuinely different
  // account logging in on the same device would be shown the PIN-unlock
  // screen demanding the FIRST account's PIN, which they have no way to
  // know. Scoping by user makes "does THIS account have a local PIN on
  // this device" the actual question being answered.
  Future<String> _loginPinScope() async => (await getUserId()) ?? '_no_user';

  /// Save hashed login PIN — never store plain text
  Future<void> saveLoginPin(String hashedPin) async =>
      _write('${_Keys.loginPin}:${await _loginPinScope()}', hashedPin);
  Future<String?> getLoginPin() async =>
      _read('${_Keys.loginPin}:${await _loginPinScope()}');
  Future<bool> hasLoginPin() async =>
      (await getLoginPin()) != null;
  Future<void> clearLoginPin() async =>
      _delete('${_Keys.loginPin}:${await _loginPinScope()}');

  // ── Login PIN Lockout ───────────────────────────────────────
  Future<void> saveLoginPinAttempts(int attempts) async => _write(
        '${_Keys.loginPinAttempts}:${await _loginPinScope()}',
        attempts.toString(),
      );

  Future<int> getLoginPinAttempts() async {
    final raw = await _read('${_Keys.loginPinAttempts}:${await _loginPinScope()}');
    return int.tryParse(raw ?? '0') ?? 0;
  }

  Future<void> saveLoginPinLockoutUntil(DateTime until) async => _write(
        '${_Keys.loginPinLockoutUntil}:${await _loginPinScope()}',
        until.millisecondsSinceEpoch.toString(),
      );

  Future<DateTime?> getLoginPinLockoutUntil() async {
    final raw = await _read('${_Keys.loginPinLockoutUntil}:${await _loginPinScope()}');
    if (raw == null) return null;
    final ms = int.tryParse(raw);
    if (ms == null) return null;
    return DateTime.fromMillisecondsSinceEpoch(ms);
  }

  Future<void> clearLoginPinLockout() async {
    final scope = await _loginPinScope();
    await _delete('${_Keys.loginPinAttempts}:$scope');
    await _delete('${_Keys.loginPinLockoutUntil}:$scope');
  }

  // ── Biometric ─────────────────────────────────────────────
  Future<void> setBiometricEnabled(bool enabled) =>
      _write(_Keys.biometricEnabled, enabled.toString());

  Future<bool> isBiometricEnabled() async {
    final raw = await _read(_Keys.biometricEnabled);
    return raw == 'true';
  }

  // ── Device ────────────────────────────────────────────────
  Future<void> saveDeviceId(String id) => _write(_Keys.deviceId, id);
  Future<String?> getDeviceId() => _read(_Keys.deviceId);

  // ── Hive encryption key ───────────────────────────────────
  Future<void> saveHiveKey(String key) => _write(_Keys.hiveEncryptionKey, key);
  Future<String?> getHiveKey() => _read(_Keys.hiveEncryptionKey);

  // ── FCM Token ─────────────────────────────────────────────
  Future<void> saveFcmToken(String token) => _write(_Keys.fcmToken, token);
  Future<String?> getFcmToken() => _read(_Keys.fcmToken);

  // ── Onboarding ────────────────────────────────────────────
  Future<void> setOnboardingComplete() =>
      _write(_Keys.onboardingComplete, 'true');

  Future<bool> isOnboardingComplete() async {
    final raw = await _read(_Keys.onboardingComplete);
    return raw == 'true';
  }

  // ── Remember email ────────────────────────────────────────
  Future<void> saveRememberedEmail(String email) =>
      _write(_Keys.rememberEmail, email);

  Future<String?> getRememberedEmail() => _read(_Keys.rememberEmail);

  Future<void> clearRememberedEmail() => _delete(_Keys.rememberEmail);

  // ── Full clear ────────────────────────────────────────────
  Future<void> clearAll() async {
    try {
      await _storage.deleteAll();
    } catch (e) {
      appLogger.e('SecureStorage clearAll failed', error: e);
    }
  }

  // ── Private helpers ───────────────────────────────────────
  Future<void> _write(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (e) {
      appLogger.e('SecureStorage write failed for $key', error: e);
    }
  }

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (e) {
      appLogger.e('SecureStorage read failed for $key', error: e);
      return null;
    }
  }

  Future<void> _delete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (e) {
      appLogger.e('SecureStorage delete failed for $key', error: e);
    }
  }
}
