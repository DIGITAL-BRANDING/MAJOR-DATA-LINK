import 'package:equatable/equatable.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../../buy_data/data/datasources/beneficiary_local_datasource.dart';
import '../../../buy_data/domain/entities/beneficiary_entity.dart';
import '../../../buy_data/presentation/providers/buy_data_provider.dart'
    show beneficiaryLocalDataSourceProvider;

enum CableProviderType { dstv, gotv, startimes }

extension CableProviderTypeX on CableProviderType {
  String get label {
    switch (this) {
      case CableProviderType.dstv:
        return 'DStv';
      case CableProviderType.gotv:
        return 'GOtv';
      case CableProviderType.startimes:
        return 'StarTimes';
    }
  }

  String get code => name.toUpperCase();
}

class CablePlan extends Equatable {
  const CablePlan({
    required this.id,
    required this.name,
    required this.price,
    required this.validity,
  });

  final String id;
  final String name;
  final double price;
  final String validity;

  factory CablePlan.fromJson(Map<String, dynamic> json) {
    return CablePlan(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? json['plan_name']?.toString() ?? '',
      price: double.tryParse(json['price']?.toString() ?? '') ?? 0,
      validity: json['validity']?.toString() ?? '1 month',
    );
  }

  @override
  List<Object?> get props => [id, name, price, validity];
}

class SmartcardValidationResult extends Equatable {
  const SmartcardValidationResult({
    required this.isValid,
    required this.customerName,
  });

  final bool isValid;
  final String customerName;

  @override
  List<Object?> get props => [isValid, customerName];
}

// ── Data source ────────────────────────────────────────────
final cableRemoteDataSourceProvider = Provider((ref) {
  return _CableRemoteDataSource(ref.read(dioClientProvider));
});

class _CableRemoteDataSource {
  const _CableRemoteDataSource(this._dio);
  final Dio _dio;

  Future<List<CablePlan>> getPlans(CableProviderType provider) async {
    try {
      final response = await _dio.get(AppEndpoints.cablePlans(provider.code));
      final list = (response.data['data'] ?? response.data) as List<dynamic>;
      return list.map((e) => CablePlan.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<SmartcardValidationResult> validateSmartcard({
    required CableProviderType provider,
    required String smartcardNumber,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.validateSmartcard,
        data: {'provider': provider.code, 'smartcard_number': smartcardNumber},
      );
      final data = response.data['data'] as Map<String, dynamic>? ?? {};
      return SmartcardValidationResult(
        isValid: response.data['status'] == true,
        customerName: data['customer_name']?.toString() ?? '',
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<Map<String, dynamic>> subscribe({
    required CableProviderType provider,
    required String smartcardNumber,
    required String planId,
    required double amount,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.subscribeCable,
        data: {
          'provider': provider.code,
          'smartcard_number': smartcardNumber,
          'plan_id': planId,
          'amount': amount,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

// ── Plans provider ─────────────────────────────────────────
final cablePlansProvider = FutureProvider.autoDispose
    .family<List<CablePlan>, CableProviderType>((ref, provider) async {
  final ds = ref.read(cableRemoteDataSourceProvider);
  return ds.getPlans(provider);
});

final selectedCableProviderProvider =
    StateProvider.autoDispose<CableProviderType>((ref) => CableProviderType.dstv);

final cableBeneficiariesProvider =
    FutureProvider.autoDispose<List<BeneficiaryEntity>>((ref) async {
  final local = ref.read(beneficiaryLocalDataSourceProvider);
  return local.getBeneficiaries(BeneficiaryType.cable);
});

// ── State ──────────────────────────────────────────────────
class CableState {
  const CableState({
    this.smartcardNumber = '',
    this.selectedPlan,
    this.validationResult,
    this.isValidating = false,
    this.isProcessing = false,
    this.saveAsBeneficiary = false,
    this.errorMessage,
  });

  final String smartcardNumber;
  final CablePlan? selectedPlan;
  final SmartcardValidationResult? validationResult;
  final bool isValidating;
  final bool isProcessing;
  final bool saveAsBeneficiary;
  final String? errorMessage;

  bool get isValidated => validationResult?.isValid == true;
  bool get canProceed =>
      isValidated && selectedPlan != null && smartcardNumber.length >= 9;

  CableState copyWith({
    String? smartcardNumber,
    CablePlan? selectedPlan,
    SmartcardValidationResult? validationResult,
    bool? isValidating,
    bool? isProcessing,
    bool? saveAsBeneficiary,
    String? errorMessage,
    bool clearError = false,
    bool clearValidation = false,
  }) {
    return CableState(
      smartcardNumber: smartcardNumber ?? this.smartcardNumber,
      selectedPlan: selectedPlan ?? this.selectedPlan,
      validationResult:
          clearValidation ? null : (validationResult ?? this.validationResult),
      isValidating: isValidating ?? this.isValidating,
      isProcessing: isProcessing ?? this.isProcessing,
      saveAsBeneficiary: saveAsBeneficiary ?? this.saveAsBeneficiary,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CableNotifier extends StateNotifier<CableState> {
  CableNotifier(this._ref) : super(const CableState());
  final Ref _ref;

  void setSmartcard(String value) {
    state = state.copyWith(
      smartcardNumber: value,
      clearValidation: true,
      clearError: true,
    );
  }

  void selectPlan(CablePlan plan) =>
      state = state.copyWith(selectedPlan: plan);

  void toggleSaveBeneficiary(bool value) =>
      state = state.copyWith(saveAsBeneficiary: value);

  Future<void> validateSmartcard(CableProviderType provider) async {
    if (state.smartcardNumber.length < 9) return;
    state = state.copyWith(isValidating: true, clearError: true);

    try {
      final ds = _ref.read(cableRemoteDataSourceProvider);
      final result = await ds.validateSmartcard(
        provider: provider,
        smartcardNumber: state.smartcardNumber,
      );
      state = state.copyWith(isValidating: false, validationResult: result);
      if (!result.isValid) {
        state = state.copyWith(
            errorMessage: 'Could not validate this smartcard number');
      }
    } catch (e) {
      state = state.copyWith(
        isValidating: false,
        errorMessage: 'Validation failed. Please check the number.',
      );
    }
  }

  Future<Map<String, dynamic>?> subscribe(CableProviderType provider) async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);

    try {
      final ds = _ref.read(cableRemoteDataSourceProvider);
      final result = await ds.subscribe(
        provider: provider,
        smartcardNumber: state.smartcardNumber,
        planId: state.selectedPlan!.id,
        amount: state.selectedPlan!.price,
      );

      if (result['status'] == true) {
        await _ref.read(hiveStorageProvider).remove('wallet_balance');
        if (state.saveAsBeneficiary) {
          await _ref.read(beneficiaryLocalDataSourceProvider).saveBeneficiary(
                BeneficiaryEntity(
                  id: '',
                  type: BeneficiaryType.cable,
                  value: state.smartcardNumber,
                  label: state.validationResult?.customerName ??
                      state.smartcardNumber,
                  provider: provider.code,
                ),
              );
        }
      }
      state = state.copyWith(isProcessing: false);
      return result;
    } catch (e) {
      state = state.copyWith(isProcessing: false, errorMessage: e.toString());
      return null;
    }
  }

  void reset() => state = const CableState();
}

final cableNotifierProvider =
    StateNotifierProvider.autoDispose<CableNotifier, CableState>((ref) {
  return CableNotifier(ref);
});