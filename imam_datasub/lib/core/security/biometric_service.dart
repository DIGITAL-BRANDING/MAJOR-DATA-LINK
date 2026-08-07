import 'package:flutter/services.dart';
import '../utils/logger.dart';

enum BiometricType { fingerprint, face, none }

class BiometricService {
  static const _channel = MethodChannel('com.imamdatasub.app/biometric');
  static const _securityChannel = MethodChannel('com.imamdatasub.app/security');

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
}

enum BiometricResult { success, failed, error, cancelled }
