import 'package:flutter/services.dart';
import '../utils/logger.dart';

enum BiometricType { fingerprint, face, none }

class BiometricService {
  static const _channel = MethodChannel('com.majordatalink.app/biometric');
  static const _securityChannel = MethodChannel('com.majordatalink.app/security');

  // ── Availability ──────────────────────────────────────────
  Future<bool> isAvailable() async {
    try {
      return await _channel.invokeMethod<bool>('isBiometricAvailable') ?? false;
    } on PlatformException catch (e) {
      appLogger.w('Biometric check failed', error: e);
      return false;
    }
  }

  // ── Authentication ────────────────────────────────────────
  Future<BiometricResult> authenticate({
    String title = 'Authenticate',
    String subtitle = 'Use biometric to continue',
  }) async {
    try {
      final result = await _channel.invokeMethod<bool>(
        'authenticate',
        {'title': title, 'subtitle': subtitle},
      );
      if (result == true) return BiometricResult.success;
      return BiometricResult.failed;
    } on PlatformException catch (e) {
      appLogger.w('Biometric auth failed', error: e);
      switch (e.code) {
        case 'AUTH_ERROR':
          return BiometricResult.error;
        case 'AUTH_FAILED':
          return BiometricResult.failed;
        default:
          return BiometricResult.error;
      }
    }
  }

  // ── Root detection ────────────────────────────────────────
  Future<bool> isDeviceRooted() async {
    try {
      return await _securityChannel.invokeMethod<bool>('isRooted') ?? false;
    } on PlatformException catch (e) {
      appLogger.w('Root check failed', error: e);
      return false;
    }
  }

  // ── Device fingerprint ────────────────────────────────────
  Future<String?> getDeviceFingerprint() async {
    try {
      return await _securityChannel.invokeMethod<String>('getDeviceFingerprint');
    } on PlatformException catch (e) {
      appLogger.w('Device fingerprint failed', error: e);
      return null;
    }
  }

  Future<String?> getAndroidId() async {
    try {
      return await _securityChannel.invokeMethod<String>('getAndroidId');
    } on PlatformException catch (e) {
      appLogger.w('Android ID failed', error: e);
      return null;
    }
  }

  // ── Screenshot / screen-recording protection ──────────────
  // Toggles Android's FLAG_SECURE on the app window. Debug builds never
  // enable it regardless of what's passed here (see MainActivity.kt's
  // isDebuggableBuild() check) - only release builds actually block
  // screenshots. Reference-counted by SecureScreenController
  // (core/security/secure_screen_mixin.dart), not called directly by UI code.
  Future<void> setSecureScreen(bool secure) async {
    try {
      await _securityChannel.invokeMethod('setSecureScreen', {'secure': secure});
    } on PlatformException catch (e) {
      appLogger.w('Set secure screen failed', error: e);
    }
  }
}

enum BiometricResult { success, failed, error, cancelled }
