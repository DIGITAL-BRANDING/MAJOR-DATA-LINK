import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';

/// Mirrors the Techhubltd slip tiers documented for NIN-by-NIN / NIN-by-Phone.
/// `vnin` only exists for NIN-by-NIN — NIN-by-Phone excludes it (see
/// `SlipTierX.availableFor`).
enum SlipTier { premium, standard, regular, vnin }

extension SlipTierX on SlipTier {
  String get label => switch (this) {
    SlipTier.premium => 'Premium',
    SlipTier.standard => 'Standard',
    SlipTier.regular => 'Regular',
    SlipTier.vnin => 'VNIN',
  };

  String get apiValue => name;
}

/// BVN slips only ever had two documented tiers.
enum BvnTier { premium, standard }

extension BvnTierX on BvnTier {
  String get label => this == BvnTier.premium ? 'Premium' : 'Standard';
  String get apiValue => name;
}

/// One of the 8 validation issue types Techhubltd's NIN Validation service
/// accepts (`nin_validation` is the default when omitted).
enum NinValidationType {
  ninValidation,
  noRecord,
  sim,
  modification,
  photoError,
  bankValidation,
  vNinValidation,
  updateRecords,
}

extension NinValidationTypeX on NinValidationType {
  String get apiValue => switch (this) {
    NinValidationType.ninValidation => 'nin_validation',
    NinValidationType.noRecord => 'no_record',
    NinValidationType.sim => 'sim',
    NinValidationType.modification => 'modification',
    NinValidationType.photoError => 'photo_error',
    NinValidationType.bankValidation => 'bank_validation',
    NinValidationType.vNinValidation => 'v.nin_validation',
    NinValidationType.updateRecords => 'update_records',
  };

  String get label => switch (this) {
    NinValidationType.ninValidation => 'General NIN Validation',
    NinValidationType.noRecord => 'No Record Found',
    NinValidationType.sim => 'SIM Validation',
    NinValidationType.modification => 'Modification',
    NinValidationType.photoError => 'Photo Error',
    NinValidationType.bankValidation => 'Bank Validation',
    NinValidationType.vNinValidation => 'V.NIN Validation',
    NinValidationType.updateRecords => 'Update Records',
  };
}

/// Which coarse service key (matches the backend's `ServiceKey`) the
/// `/verification/prices` list is filtered against, so each screen shows the
/// real configured selling price up front instead of only finding out the
/// cost when the debit happens.
enum VerificationService {
  ninSlipPremium,
  ninSlipStandard,
  ninSlipRegular,
  ninSlipVnin,
  ninPhoneSlipPremium,
  ninPhoneSlipStandard,
  ninPhoneSlipRegular,
  ninDemographic,
  bvnSlipPremium,
  bvnSlipStandard,
  ninDelinking,
  ninValidation,
  ninPersonalization,
  bvnRetrieval,
  ipeClearance,
}

extension VerificationServiceX on VerificationService {
  /// Matches `SERVICE_KEYS` in the backend's verification.service.ts.
  String get key => switch (this) {
    VerificationService.ninSlipPremium => 'NIN_SLIP_PREMIUM',
    VerificationService.ninSlipStandard => 'NIN_SLIP_STANDARD',
    VerificationService.ninSlipRegular => 'NIN_SLIP_REGULAR',
    VerificationService.ninSlipVnin => 'NIN_SLIP_VNIN',
    VerificationService.ninPhoneSlipPremium => 'NIN_PHONE_SLIP_PREMIUM',
    VerificationService.ninPhoneSlipStandard => 'NIN_PHONE_SLIP_STANDARD',
    VerificationService.ninPhoneSlipRegular => 'NIN_PHONE_SLIP_REGULAR',
    VerificationService.ninDemographic => 'NIN_DEMOGRAPHIC',
    VerificationService.bvnSlipPremium => 'BVN_SLIP_PREMIUM',
    VerificationService.bvnSlipStandard => 'BVN_SLIP_STANDARD',
    VerificationService.ninDelinking => 'NIN_DELINKING',
    VerificationService.ninValidation => 'NIN_VALIDATION',
    VerificationService.ninPersonalization => 'NIN_PERSONALIZATION',
    VerificationService.bvnRetrieval => 'BVN_RETRIEVAL',
    VerificationService.ipeClearance => 'IPE_CLEARANCE',
  };
}

// ── Result models ────────────────────────────────────────────

/// A synchronous slip lookup's outcome (NIN by NIN/Phone/Demographic, BVN
/// slip) — one call, one PDF, no polling.
class SlipApiResult {
  const SlipApiResult({
    required this.success,
    required this.message,
    required this.reference,
    this.balanceAfter,
    this.userData,
    this.pdfBase64,
    this.pdfUrl,
  });

  final bool success;
  final String message;
  final String reference;
  final double? balanceAfter;
  final Map<String, dynamic>? userData;
  final String? pdfBase64;
  final String? pdfUrl;

  factory SlipApiResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? const {};
    return SlipApiResult(
      success: json['status'] == true,
      message: json['message']?.toString() ?? '',
      reference: data['reference']?.toString() ?? '',
      balanceAfter: data['balance_after'] != null
          ? double.tryParse(data['balance_after'].toString())
          : null,
      userData: data['user_data'] as Map<String, dynamic>?,
      pdfBase64: data['pdf_base64']?.toString(),
      pdfUrl: data['pdf_url']?.toString(),
    );
  }
}

/// Completed verification results remain retrievable for seven days. Pending
/// asynchronous jobs appear only after the backend marks them successful.
/// Identity fields are deliberately not included in this list; only the
/// generated PDF (when the provider supplied one) can be retrieved.
class VerificationHistoryItem {
  const VerificationHistoryItem({
    required this.reference,
    required this.status,
    required this.createdAt,
    this.pdfBase64,
    this.pdfUrl,
  });

  final String reference;
  final String status;
  final DateTime createdAt;
  final String? pdfBase64;
  final String? pdfUrl;

  factory VerificationHistoryItem.fromJson(Map<String, dynamic> json) {
    return VerificationHistoryItem(
      reference: json['reference']?.toString() ?? '',
      status: json['status']?.toString() ?? 'unknown',
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
      pdfBase64: json['pdf_base64']?.toString(),
      pdfUrl: json['pdf_url']?.toString(),
    );
  }

  bool get hasPdf =>
      (pdfBase64?.isNotEmpty ?? false) ||
      (pdfUrl?.startsWith('https://') ?? false);
}

/// The result of *submitting* one of the five async services — deducts the
/// wallet immediately and hands back a ticket_id to poll later.
class AsyncSubmitApiResult {
  const AsyncSubmitApiResult({
    required this.reference,
    required this.ticketId,
    this.balanceAfter,
  });

  final String reference;
  final String ticketId;
  final double? balanceAfter;

  factory AsyncSubmitApiResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? const {};
    return AsyncSubmitApiResult(
      reference: data['reference']?.toString() ?? '',
      ticketId: data['ticket_id']?.toString() ?? '',
      balanceAfter: data['balance_after'] != null
          ? double.tryParse(data['balance_after'].toString())
          : null,
    );
  }
}

/// The result of *polling* a ticket. `status` is `pending`, `success` or
/// `failed` — a failed ticket has already been auto-refunded server-side by
/// the time this comes back.
class AsyncStatusApiResult {
  const AsyncStatusApiResult({
    required this.ticketId,
    required this.status,
    this.response,
  });

  final String ticketId;
  final String status;
  final Map<String, dynamic>? response;

  bool get isPending => status == 'pending';
  bool get isSuccess => status == 'success';
  bool get isFailed => status == 'failed';

  factory AsyncStatusApiResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? const {};
    return AsyncStatusApiResult(
      ticketId:
          data['ticketId']?.toString() ?? data['ticket_id']?.toString() ?? '',
      status: data['status']?.toString() ?? 'pending',
      response: data['response'] as Map<String, dynamic>?,
    );
  }
}

// ── Remote client ─────────────────────────────────────────────

final verificationRemoteProvider = Provider((ref) {
  return VerificationRemote(ref.read(dioClientProvider));
});

class VerificationRemote {
  const VerificationRemote(this._dio);
  final Dio _dio;

  Options get _idempotent =>
      Options(headers: {'Idempotency-Key': const Uuid().v4()});

  Future<Map<String, double>> getPrices() async {
    try {
      final response = await _dio.get(AppEndpoints.verificationPrices);
      final list = (response.data['data'] as List?) ?? const [];
      // Backend's listServicePrices() returns camelCase (unitPrice), unlike
      // the snake_case bodies everywhere else in this API.
      return {
        for (final row in list.cast<Map<String, dynamic>>())
          row['service']?.toString() ?? '':
              double.tryParse(row['unitPrice']?.toString() ?? '') ?? 0,
      };
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<List<VerificationHistoryItem>> getHistory(String service) async {
    try {
      final response = await _dio.get(
        '/verification/history',
        queryParameters: {'service': service},
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

  // ---- Slip lookups (synchronous) ----

  Future<SlipApiResult> ninByNin({
    required String nin,
    required SlipTier tier,
    required String pin,
  }) => _postSlip(AppEndpoints.ninByNin, {
    'nin': nin,
    'tier': tier.apiValue,
    'pin': pin,
  });

  Future<SlipApiResult> ninByPhone({
    required String phone,
    required SlipTier tier,
    required String pin,
  }) => _postSlip(AppEndpoints.ninByPhone, {
    'phone': phone,
    'tier': tier.apiValue,
    'pin': pin,
  });

  Future<SlipApiResult> ninByDemographic({
    required String firstname,
    required String lastname,
    required String dob,
    String? gender,
    required String pin,
  }) => _postSlip(AppEndpoints.ninByDemographic, {
    'firstname': firstname,
    'lastname': lastname,
    'dob': dob,
    if (gender != null) 'gender': gender,
    'pin': pin,
  });

  Future<SlipApiResult> bvnSlip({
    required String bvn,
    required BvnTier tier,
    required String pin,
  }) => _postSlip(AppEndpoints.bvnSlip, {
    'bvn': bvn,
    'tier': tier.apiValue,
    'pin': pin,
  });

  Future<SlipApiResult> _postSlip(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.post(
        endpoint,
        data: body,
        options: _idempotent,
      );
      return SlipApiResult.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  // ---- Async services (submit + poll) ----

  Future<AsyncSubmitApiResult> submitDelinking({
    required String nin,
    required String email,
    required String pin,
  }) => _postAsync(AppEndpoints.ninDelinking, {
    'nin': nin,
    'email': email,
    'pin': pin,
  });

  Future<AsyncStatusApiResult> checkDelinking(String ticketId) =>
      _getAsync(AppEndpoints.ninDelinkingStatus(ticketId));

  Future<AsyncSubmitApiResult> submitNinValidation({
    required String nin,
    NinValidationType? validationType,
    required String pin,
  }) => _postAsync(AppEndpoints.ninValidation, {
    'nin': nin,
    if (validationType != null) 'validation_type': validationType.apiValue,
    'pin': pin,
  });

  Future<AsyncStatusApiResult> checkNinValidation(String ticketId) =>
      _getAsync(AppEndpoints.ninValidationStatus(ticketId));

  Future<AsyncSubmitApiResult> submitPersonalization({
    required String trackingId,
    required String pin,
  }) => _postAsync(AppEndpoints.ninPersonalization, {
    'tracking_id': trackingId,
    'pin': pin,
  });

  Future<AsyncStatusApiResult> checkPersonalization(String ticketId) =>
      _getAsync(AppEndpoints.ninPersonalizationStatus(ticketId));

  Future<AsyncSubmitApiResult> submitBvnRetrieval({
    required String firstName,
    required String lastName,
    required String phoneNumber,
    required String pin,
  }) => _postAsync(AppEndpoints.bvnRetrieval, {
    'first_name': firstName,
    'last_name': lastName,
    'phone_number': phoneNumber,
    'pin': pin,
  });

  Future<AsyncStatusApiResult> checkBvnRetrieval(String ticketId) =>
      _getAsync(AppEndpoints.bvnRetrievalStatus(ticketId));

  Future<AsyncSubmitApiResult> submitIpeClearance({
    required String trackingId,
    required String pin,
  }) => _postAsync(AppEndpoints.ipeClearance, {
    'tracking_id': trackingId,
    'pin': pin,
  });

  Future<AsyncStatusApiResult> checkIpeClearance(String ticketId) =>
      _getAsync(AppEndpoints.ipeClearanceStatus(ticketId));

  Future<AsyncSubmitApiResult> _postAsync(
    String endpoint,
    Map<String, dynamic> body,
  ) async {
    try {
      final response = await _dio.post(
        endpoint,
        data: body,
        options: _idempotent,
      );
      return AsyncSubmitApiResult.fromJson(
        response.data as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<AsyncStatusApiResult> _getAsync(String endpoint) async {
    try {
      final response = await _dio.get(endpoint);
      return AsyncStatusApiResult.fromJson(
        response.data as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

// ── Prices (fetched once, read by every screen) ─────────────────

final verificationPricesProvider =
    FutureProvider.autoDispose<Map<String, double>>((ref) {
      return ref.read(verificationRemoteProvider).getPrices();
    });

final verificationHistoryProvider = FutureProvider.autoDispose
    .family<List<VerificationHistoryItem>, String>((ref, service) {
      return ref.read(verificationRemoteProvider).getHistory(service);
    });

// Screens read the price for their service directly:
//   final prices = ref.watch(verificationPricesProvider);
//   final price = prices.valueOrNull?[VerificationService.xxx.key] ?? 0;

// ── Slip flow: submit state ──────────────────────────────────

class SlipFlowState {
  const SlipFlowState({
    this.isSubmitting = false,
    this.errorMessage,
    this.result,
  });

  final bool isSubmitting;
  final String? errorMessage;
  final SlipApiResult? result;

  SlipFlowState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    SlipApiResult? result,
    bool clearError = false,
    bool clearResult = false,
  }) {
    return SlipFlowState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      result: clearResult ? null : (result ?? this.result),
    );
  }
}

/// Drives any one of the four synchronous slip screens. Each screen supplies
/// its own `Future<SlipApiResult> Function()` closure (already carrying that
/// screen's form fields) to [submit].
class SlipFlowNotifier extends StateNotifier<SlipFlowState> {
  SlipFlowNotifier() : super(const SlipFlowState());

  Future<SlipApiResult?> submit(Future<SlipApiResult> Function() call) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await call();
      state = state.copyWith(isSubmitting: false, result: result);
      if (!result.success) {
        state = state.copyWith(errorMessage: result.message);
      }
      return result;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.toString());
      return null;
    }
  }

  void reset() => state = const SlipFlowState();
}

final slipFlowProvider =
    StateNotifierProvider.autoDispose<SlipFlowNotifier, SlipFlowState>(
      (ref) => SlipFlowNotifier(),
    );

// ── Async flow: submit + poll state ──────────────────────────

class AsyncFlowState {
  const AsyncFlowState({
    this.isSubmitting = false,
    this.isPolling = false,
    this.ticketId,
    this.reference,
    this.balanceAfter,
    this.status,
    this.response,
    this.errorMessage,
  });

  final bool isSubmitting;
  final bool isPolling;
  final String? ticketId;
  final String? reference;
  final double? balanceAfter;

  /// null until the first status check comes back; then `pending`,
  /// `success` or `failed`.
  final String? status;
  final Map<String, dynamic>? response;
  final String? errorMessage;

  bool get isSubmitted => ticketId != null;
  bool get isSettled => status == 'success' || status == 'failed';

  AsyncFlowState copyWith({
    bool? isSubmitting,
    bool? isPolling,
    String? ticketId,
    String? reference,
    double? balanceAfter,
    String? status,
    Map<String, dynamic>? response,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AsyncFlowState(
      isSubmitting: isSubmitting ?? this.isSubmitting,
      isPolling: isPolling ?? this.isPolling,
      ticketId: ticketId ?? this.ticketId,
      reference: reference ?? this.reference,
      balanceAfter: balanceAfter ?? this.balanceAfter,
      status: status ?? this.status,
      response: response ?? this.response,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// Drives any one of the five async submit+poll screens (Delinking, NIN
/// Validation, Personalization, BVN Retrieval, IPE Clearance). Each screen
/// supplies its own submit/check closures.
class AsyncFlowNotifier extends StateNotifier<AsyncFlowState> {
  AsyncFlowNotifier() : super(const AsyncFlowState());

  Future<bool> submit(Future<AsyncSubmitApiResult> Function() call) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await call();
      state = state.copyWith(
        isSubmitting: false,
        ticketId: result.ticketId,
        reference: result.reference,
        balanceAfter: result.balanceAfter,
        status: 'pending',
      );
      return true;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.toString());
      return false;
    }
  }

  /// Polls once. Screens wrap this in a periodic Timer (or a manual refresh
  /// button) — the ticket is server-side authoritative, so a single check is
  /// cheap and safe to call repeatedly.
  Future<void> checkStatus(
    Future<AsyncStatusApiResult> Function(String ticketId) call,
  ) async {
    final ticketId = state.ticketId;
    if (ticketId == null || state.isSettled) return;
    state = state.copyWith(isPolling: true, clearError: true);
    try {
      final result = await call(ticketId);
      state = state.copyWith(
        isPolling: false,
        status: result.status,
        response: result.response,
      );
    } catch (e) {
      state = state.copyWith(isPolling: false, errorMessage: e.toString());
    }
  }

  void reset() => state = const AsyncFlowState();
}

final asyncFlowProvider =
    StateNotifierProvider.autoDispose<AsyncFlowNotifier, AsyncFlowState>(
      (ref) => AsyncFlowNotifier(),
    );
