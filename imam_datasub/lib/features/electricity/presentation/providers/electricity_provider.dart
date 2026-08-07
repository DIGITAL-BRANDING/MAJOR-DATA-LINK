import 'package:equatable/equatable.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../../buy_data/data/datasources/beneficiary_local_datasource.dart';
import '../../../buy_data/domain/entities/beneficiary_entity.dart';
import '../../../buy_data/presentation/providers/buy_data_provider.dart'
    show beneficiaryLocalDataSourceProvider;

enum MeterType { prepaid, postpaid }

class MeterValidationResult extends Equatable {
  const MeterValidationResult({
    required this.isValid,
    required this.customerName,
    required this.address,
  });

  final bool isValid;
  final String customerName;
  final String address;

  @override
  List<Object?> get props => [isValid, customerName, address];
}

final electricityRemoteDataSourceProvider = Provider((ref) {
  return _ElectricityRemoteDataSource(ref.read(dioClientProvider));
});

class _ElectricityRemoteDataSource {
  const _ElectricityRemoteDataSource(this._dio);
  final Dio _dio;

  Future<MeterValidationResult> validateMeter({
    required String discoCode,
    required String meterNumber,
    required MeterType meterType,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.validateMeter,
        data: {
          'disco': discoCode,
          'meter_number': meterNumber,
          'meter_type': meterType.name,
        },
      );
      final data = response.data['data'] as Map<String, dynamic>? ?? {};
      return MeterValidationResult(
        isValid: response.data['status'] == true,
        customerName: data['customer_name']?.toString() ?? '',
        address: data['address']?.toString() ?? '',
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<Map<String, dynamic>> purchase({
    required String discoCode,
    required String meterNumber,
    required MeterType meterType,
    required double amount,
  }) async {
    try {
      final response = await _dio.post(
        AppEndpoints.purchaseElectricity,
        data: {
          'disco': discoCode,
          'meter_number': meterNumber,
          'meter_type': meterType.name,
          'amount': amount,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

final selectedDiscoProvider =
    StateProvider.autoDispose<String>((ref) => AppConfig.electricityProviders.first);

final electricityBeneficiariesProvider =
    FutureProvider.autoDispose<List<BeneficiaryEntity>>((ref) async {
  final local = ref.read(beneficiaryLocalDataSourceProvider);
  return local.getBeneficiaries(BeneficiaryType.electricity);
});

class ElectricityState {
  const ElectricityState({
    this.meterNumber = '',
    this.meterType = MeterType.prepaid,
    this.amount = 0,
    this.validationResult,
    this.isValidating = false,
    this.isProcessing = false,
    this.saveAsBeneficiary = false,
    this.errorMessage,
  });

  final String meterNumber;
  final MeterType meterType;
  final double amount;
  final MeterValidationResult? validationResult;
  final bool isValidating;
  final bool isProcessing;
  final bool saveAsBeneficiary;
  final String? errorMessage;

  bool get isValidated => validationResult?.isValid == true;
  bool get canProceed => isValidated && amount >= 500;

  ElectricityState copyWith({
    String? meterNumber,
    MeterType? meterType,
    double? amount,
    MeterValidationResult? validationResult,
    bool? isValidating,
    bool? isProcessing,
    bool? saveAsBeneficiary,
    String? errorMessage,
    bool clearError = false,
    bool clearValidation = false,
  }) {
    return ElectricityState(
      meterNumber: meterNumber ?? this.meterNumber,
      meterType: meterType ?? this.meterType,
      amount: amount ?? this.amount,
      validationResult:
          clearValidation ? null : (validationResult ?? this.validationResult),
      isValidating: isValidating ?? this.isValidating,
      isProcessing: isProcessing ?? this.isProcessing,
      saveAsBeneficiary: saveAsBeneficiary ?? this.saveAsBeneficiary,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ElectricityNotifier extends StateNotifier<ElectricityState> {
  ElectricityNotifier(this._ref) : super(const ElectricityState());
  final Ref _ref;

  void setMeterNumber(String value) => state = state.copyWith(
      meterNumber: value, clearValidation: true, clearError: true);

  void setMeterType(MeterType type) =>
      state = state.copyWith(meterType: type, clearValidation: true);

  void setAmount(double amount) => state = state.copyWith(amount: amount);

  void toggleSaveBeneficiary(bool v) =>
      state = state.copyWith(saveAsBeneficiary: v);

  Future<void> validateMeter(String discoCode) async {
    if (state.meterNumber.length < 10) return;
    state = state.copyWith(isValidating: true, clearError: true);

    try {
      final ds = _ref.read(electricityRemoteDataSourceProvider);
      final result = await ds.validateMeter(
        discoCode: discoCode,
        meterNumber: state.meterNumber,
        meterType: state.meterType,
      );
      state = state.copyWith(isValidating: false, validationResult: result);
      if (!result.isValid) {
        state =
            state.copyWith(errorMessage: 'Could not validate this meter number');
      }
    } catch (e) {
      state = state.copyWith(
        isValidating: false,
        errorMessage: 'Validation failed. Please check the meter number.',
      );
    }
  }

  Future<Map<String, dynamic>?> purchase(String discoCode) async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);

    try {
      final ds = _ref.read(electricityRemoteDataSourceProvider);
      final result = await ds.purchase(
        discoCode: discoCode,
        meterNumber: state.meterNumber,
        meterType: state.meterType,
        amount: state.amount,
      );
      if (result['status'] == true) {
        await _ref.read(hiveStorageProvider).remove('wallet_balance');
        if (state.saveAsBeneficiary) {
          await _ref.read(beneficiaryLocalDataSourceProvider).saveBeneficiary(
                BeneficiaryEntity(
                  id: '',
                  type: BeneficiaryType.electricity,
                  value: state.meterNumber,
                  label: state.validationResult?.customerName ?? state.meterNumber,
                  provider: discoCode,
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

  void reset() => state = const ElectricityState();
}

final electricityNotifierProvider = StateNotifierProvider.autoDispose<
    ElectricityNotifier, ElectricityState>((ref) {
  return ElectricityNotifier(ref);
});