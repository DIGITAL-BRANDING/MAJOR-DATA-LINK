import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';

/// One JAMB service as offered by the backend (GET /jamb/services).
/// The list is live: services and prices are managed by admins, so nothing
/// about them is hardcoded here.
class JambService {
  const JambService({required this.id, required this.label, required this.price});

  final String id;
  final String label;
  final double price;

  factory JambService.fromJson(Map<String, dynamic> json) {
    final price = json['price'];
    return JambService(
      id: json['id']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      price: price is num ? price.toDouble() : double.tryParse(price?.toString() ?? '') ?? 0,
    );
  }
}

/// Services currently open to customers. Auto-disposes, so every visit gets
/// a fresh list (an admin may have just priced or switched a service on).
final jambServicesProvider = FutureProvider.autoDispose<List<JambService>>((ref) async {
  final dio = ref.read(dioClientProvider);
  try {
    final response = await dio.get(AppEndpoints.jambServices);
    final data = (response.data['data'] as List? ?? const []);
    return data
        .map((e) => JambService.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  } on DioException catch (e) {
    throw ErrorHandler.handleException(e);
  }
});

class JambState {
  const JambState({
    this.selectedId,
    this.registrationNumber = '',
    this.candidateName = '',
    this.examYear = '',
    this.isProcessing = false,
    this.errorMessage,
  });

  final String? selectedId;
  final String registrationNumber;
  final String candidateName;
  final String examYear;
  final bool isProcessing;
  final String? errorMessage;

  bool get canProceed =>
      selectedId != null &&
      registrationNumber.trim().length >= 4 &&
      candidateName.trim().length >= 3 &&
      RegExp(r'^\d{4}$').hasMatch(examYear.trim());

  JambState copyWith({
    String? selectedId,
    String? registrationNumber,
    String? candidateName,
    String? examYear,
    bool? isProcessing,
    String? errorMessage,
    bool clearError = false,
  }) {
    return JambState(
      selectedId: selectedId ?? this.selectedId,
      registrationNumber: registrationNumber ?? this.registrationNumber,
      candidateName: candidateName ?? this.candidateName,
      examYear: examYear ?? this.examYear,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class JambNotifier extends StateNotifier<JambState> {
  JambNotifier(this._ref) : super(const JambState());
  final Ref _ref;

  void selectService(String id) =>
      state = state.copyWith(selectedId: id, clearError: true);

  void setRegistrationNumber(String v) =>
      state = state.copyWith(registrationNumber: v, clearError: true);

  void setCandidateName(String v) =>
      state = state.copyWith(candidateName: v, clearError: true);

  void setExamYear(String v) =>
      state = state.copyWith(examYear: v, clearError: true);

  /// Sends the request with the transaction PIN the user just confirmed.
  /// The backend debits the wallet only after checking that PIN.
  Future<Map<String, dynamic>?> purchase({
    required String pin,
    required JambService service,
  }) async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);
    try {
      final dio = _ref.read(dioClientProvider);
      final response = await dio.post(
        AppEndpoints.jambRequests,
        data: {
          'service': service.id,
          'registration_number': state.registrationNumber.trim(),
          'candidate_full_name': state.candidateName.trim(),
          'exam_year': int.parse(state.examYear.trim()),
          'pin': pin,
        },
      );
      state = state.copyWith(isProcessing: false);
      // The debit changed the balance; drop the cached wallet figure so the
      // home/wallet screens refetch it (same behaviour as before this rewrite).
      await _ref.read(hiveStorageProvider).remove('wallet_balance');
      return Map<String, dynamic>.from(response.data as Map);
    } on DioException catch (e) {
      state = state.copyWith(
        isProcessing: false,
        errorMessage: ErrorHandler.handleException(e).message,
      );
      return null;
    }
  }

  void reset() => state = const JambState();
}

final jambNotifierProvider =
    StateNotifierProvider.autoDispose<JambNotifier, JambState>((ref) {
  return JambNotifier(ref);
});

