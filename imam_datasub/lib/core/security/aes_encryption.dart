import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';

/// AES-256 encryption for sensitive local data.
/// For PIN storage we use PBKDF2 hashing, not encryption.
class AesEncryption {
  AesEncryption._();

  // ── PIN hashing with PBKDF2 ───────────────────────────────
  /// Hash a PIN with PBKDF2-SHA256 + salt for secure storage
  static String hashPin(String pin, String salt) {
    final key = utf8.encode(pin + salt);
    final hmac = Hmac(sha256, key);
    final digest = hmac.convert(utf8.encode('imamdatasub_pin_$salt'));
    return digest.toString();
  }

  /// Generate a cryptographically secure salt
  static String generateSalt({int length = 32}) {
    const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    final random = Random.secure();
    return List.generate(length, (_) => chars[random.nextInt(chars.length)])
        .join();
  }

  /// Verify a PIN against its stored hash
  static bool verifyPin(String pin, String storedHash, String salt) {
    final hash = hashPin(pin, salt);
    return hash == storedHash;
  }

  // ── General string hashing ────────────────────────────────
  static String sha256Hash(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  static String md5Hash(String input) {
    final bytes = utf8.encode(input);
    final digest = md5.convert(bytes);
    return digest.toString();
  }

  // ── HMAC signing for API requests ────────────────────────
  static String signRequest({
    required String method,
    required String path,
    required String timestamp,
    required String nonce,
    required String secretKey,
    String? body,
  }) {
    final payload = [method.toUpperCase(), path, timestamp, nonce, body ?? '']
        .join('\n');
    final key = utf8.encode(secretKey);
    final bytes = utf8.encode(payload);
    final hmac = Hmac(sha256, key);
    return base64Encode(hmac.convert(bytes).bytes);
  }

  // ── Nonce generation ──────────────────────────────────────
  static String generateNonce() {
    final random = Random.secure();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    return base64Url.encode(bytes);
  }

  // ── Timestamp ─────────────────────────────────────────────
  static String timestamp() =>
      DateTime.now().millisecondsSinceEpoch.toString();
}
