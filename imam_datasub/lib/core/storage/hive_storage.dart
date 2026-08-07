import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'secure_storage.dart';
import '../utils/logger.dart';

/// Box names — single source of truth
abstract class HiveBoxes {
  static const user = 'kd_user';
  static const transactions = 'kd_transactions';
  static const beneficiaries = 'kd_beneficiaries';
  static const settings = 'kd_settings';
  static const promos = 'kd_promos';
  static const cache = 'kd_cache';
  static const dataPlans = 'kd_data_plans';
}

class HiveStorage {
  HiveStorage(this._secureStorage);

  final SecureStorageService _secureStorage;

  Future<void> initialize() async {
    await Hive.initFlutter();

    // Register any type adapters here before opening boxes
    // e.g. Hive.registerAdapter(UserModelAdapter());

    await _openBoxes();
    appLogger.i('Hive initialized successfully');
  }

  Future<void> _openBoxes() async {
    final encryptionKey = await _getOrCreateEncryptionKey();
    final cipher = HiveAesCipher(encryptionKey);

    // Open all boxes with encryption
    await Future.wait([
      Hive.openBox<dynamic>(HiveBoxes.user, encryptionCipher: cipher),
      Hive.openBox<dynamic>(HiveBoxes.transactions, encryptionCipher: cipher),
      Hive.openBox<dynamic>(HiveBoxes.beneficiaries, encryptionCipher: cipher),
      Hive.openBox<dynamic>(HiveBoxes.settings, encryptionCipher: cipher),
      Hive.openBox<dynamic>(HiveBoxes.promos, encryptionCipher: cipher),
      Hive.openBox<dynamic>(HiveBoxes.cache, encryptionCipher: cipher),
      Hive.openBox<dynamic>(HiveBoxes.dataPlans, encryptionCipher: cipher),
    ]);
  }

  Future<Uint8List> _getOrCreateEncryptionKey() async {
    final stored = await _secureStorage.getHiveKey();
    if (stored != null) {
      return Uint8List.fromList(base64Decode(stored));
    }

    // Generate a new 256-bit key
    final key = Uint8List(32);
    final random = Random.secure();
    for (int i = 0; i < 32; i++) {
      key[i] = random.nextInt(256);
    }

    await _secureStorage.saveHiveKey(base64Encode(key));
    return key;
  }

  // ── User box helpers ──────────────────────────────────────
  Box<dynamic> get userBox => Hive.box<dynamic>(HiveBoxes.user);

  Future<void> saveUser(Map<String, dynamic> user) async {
    await userBox.put('profile', user);
    await userBox.put('profile_cached_at', DateTime.now().toIso8601String());
  }

  Map<String, dynamic>? getUser() {
    final data = userBox.get('profile');
    return data != null ? Map<String, dynamic>.from(data as Map) : null;
  }

  bool isUserCacheValid({Duration ttl = const Duration(hours: 1)}) {
    final cachedAt = userBox.get('profile_cached_at') as String?;
    if (cachedAt == null) return false;
    final parsed = DateTime.tryParse(cachedAt);
    if (parsed == null) return false;
    return DateTime.now().difference(parsed) < ttl;
  }

  // ── Cache box helpers ─────────────────────────────────────
  Box<dynamic> get cacheBox => Hive.box<dynamic>(HiveBoxes.cache);

  Future<void> set(String key, dynamic value, {Duration? ttl}) async {
    await cacheBox.put(key, value);
    if (ttl != null) {
      await cacheBox.put(
        '${key}_expires',
        DateTime.now().add(ttl).toIso8601String(),
      );
    }
  }

  T? get<T>(String key) {
    // Check TTL
    final expiresStr = cacheBox.get('${key}_expires') as String?;
    if (expiresStr != null) {
      final expires = DateTime.tryParse(expiresStr);
      if (expires != null && DateTime.now().isAfter(expires)) {
        cacheBox.delete(key);
        cacheBox.delete('${key}_expires');
        return null;
      }
    }
    final raw = cacheBox.get(key);
    if (raw == null) return null;
    return raw as T?;
  }

  Future<void> remove(String key) async {
    await cacheBox.delete(key);
    await cacheBox.delete('${key}_expires');
  }

  // ── Settings helpers ──────────────────────────────────────
  Box<dynamic> get settingsBox => Hive.box<dynamic>(HiveBoxes.settings);

  Future<void> saveSetting(String key, dynamic value) =>
      settingsBox.put(key, value);

  T? getSetting<T>(String key, {T? defaultValue}) {
    return (settingsBox.get(key) as T?) ?? defaultValue;
  }

  // ── Clear on logout ───────────────────────────────────────
  Future<void> clearUserData() async {
    await Future.wait([
      userBox.clear(),
      cacheBox.clear(),
      Hive.box<dynamic>(HiveBoxes.transactions).clear(),
      Hive.box<dynamic>(HiveBoxes.beneficiaries).clear(),
      Hive.box<dynamic>(HiveBoxes.promos).clear(),
      Hive.box<dynamic>(HiveBoxes.dataPlans).clear(),
    ]);
    appLogger.i('Hive user data cleared');
  }

  // Keep settings on logout (theme, language preference)
  Future<void> clearAllData() async {
    await clearUserData();
    await settingsBox.clear();
  }
}
