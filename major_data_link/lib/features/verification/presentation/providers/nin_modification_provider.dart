import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import 'verification_provider.dart' show SlipApiResult, VerificationHistoryItem;

/// One field on a modification type's form, as declared server-side in
/// nin-modification.service.ts's MODIFICATION_CONFIG. Fetched at runtime
/// (GET /nin-modification/types) rather than hardcoded here, so a new field
/// or a wording tweak on the backend shows up without an app release.
class ModificationField {
  const ModificationField({
    required this.key,
    required this.label,
    required this.required,
    required this.input,
    this.options,
  });

  final String key;
  final String label;
  final bool required;
  // 'text' | 'date' | 'phone' | 'nin' | 'select' | 'document'
  final String input;
  final List<String>? options;

  factory ModificationField.fromJson(Map<String, dynamic> json) {
    return ModificationField(
      key: json['key']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      required: json['required'] == true,
      input: json['input']?.toString() ?? 'text',
      options: (json['options'] as List?)?.map((e) => e.toString()).toList(),
    );
  }
}

class ModificationTypeConfig {
  const ModificationTypeConfig({
    required this.id,
    required this.title,
    required this.fields,
  });

  final String id;
  final String title;
  final List<ModificationField> fields;

  factory ModificationTypeConfig.fromJson(Map<String, dynamic> json) {
    return ModificationTypeConfig(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      fields: ((json['fields'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(ModificationField.fromJson)
          .toList(),
    );
  }
}

// Same 2-row-3-col arrangement as techhubltd.co/nin_modifications.php and
// the web app's NinModificationPage.tsx — "I wanted this the same".
const modificationTypeOrder = [
  'update_name',
  'update_phone',
  'update_dob',
  'update_address',
  'update_name_dob',
  'update_name_phone',
];

final ninModificationRemoteProvider = Provider((ref) {
  return NinModificationRemote(ref.read(dioClientProvider));
});

class NinModificationRemote {
  const NinModificationRemote(this._dio);
  final Dio _dio;

  Future<List<ModificationTypeConfig>> getTypes() async {
    try {
      final response = await _dio.get(AppEndpoints.ninModificationTypes);
      final list = (response.data['data'] as List?) ?? const [];
      final configs = list
          .cast<Map<String, dynamic>>()
          .map(ModificationTypeConfig.fromJson)
          .toList();
      configs.sort(
        (a, b) => modificationTypeOrder
            .indexOf(a.id)
            .compareTo(modificationTypeOrder.indexOf(b.id)),
      );
      return configs;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<Map<String, double>> getPrices() async {
    try {
      final response = await _dio.get(AppEndpoints.ninModificationPrices);
      final list = (response.data['data'] as List?) ?? const [];
      return {
        for (final row in list.cast<Map<String, dynamic>>())
          row['type']?.toString() ?? '':
              double.tryParse(row['unitPrice']?.toString() ?? '') ?? 0,
      };
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<List<VerificationHistoryItem>> getHistory(String type) async {
    try {
      final response = await _dio.get(
        AppEndpoints.ninModificationHistory,
        queryParameters: {'type': type},
      );
      final list = (response.data['data'] as List?) ?? const [];
      return list
          .whereType<Map<String, dynamic>>()
          .map(VerificationHistoryItem.fromJson)
          .toList();
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  /// [values] must already match the type's field keys exactly (see
  /// ModificationField.key) — the caller is the dynamic form, which builds
  /// this map straight from the fetched config, so there is no separate
  /// per-type mapping to keep in sync here.
  Future<SlipApiResult> submit({
    required String type,
    required Map<String, dynamic> values,
    required String pin,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.ninModificationSubmit(type),
        data: {...values, 'pin': pin},
        options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
      );
      return SlipApiResult.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

final modificationTypesProvider =
    FutureProvider.autoDispose<List<ModificationTypeConfig>>((ref) {
      return ref.read(ninModificationRemoteProvider).getTypes();
    });

final modificationPricesProvider =
    FutureProvider.autoDispose<Map<String, double>>((ref) {
      return ref.read(ninModificationRemoteProvider).getPrices();
    });

final modificationHistoryProvider = FutureProvider.autoDispose
    .family<List<VerificationHistoryItem>, String>((ref, type) {
      return ref.read(ninModificationRemoteProvider).getHistory(type);
    });
