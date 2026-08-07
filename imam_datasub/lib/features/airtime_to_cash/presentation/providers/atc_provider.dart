import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/error/exceptions.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';

class AtcResult {
  const AtcResult({required this.success, required this.reference, required this.message, this.payoutAmount});
  final bool success;
  final String reference;
  final String message;
  final double? payoutAmount;

  factory AtcResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return AtcResult(
      success: json['status'] == true || json['status'] == 'success',
      reference: data['reference']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      payoutAmount: data['payout_amount'] != null
          ? double.tryParse(data['payout_amount'].toString())
          : null,
    );
  }
}

final atcRateProvider = Provider<double>((_) => 0.85); // 85% payout rate, configurable via remote config

class AtcState {
  const AtcState({
    this.amount = 0,
    this.phone = '',
    this.isProcessing = false,
    this.errorMessage,
  });

  final double amount;
  final String phone;
  final bool isProcessing;
  final String? errorMessage;

  bool get canProceed => amount >= 100 && phone.length == 11;

  AtcState copyWith({
    double? amount,
    String? phone,
    bool? isProcessing,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AtcState(
      amount: amount ?? this.amount,
      phone: phone ?? this.phone,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class AtcNotifier extends StateNotifier<AtcState> {
  AtcNotifier(this._ref) : super(const AtcState());
  final Ref _ref;

  void setAmount(double amount) => state = state.copyWith(amount: amount, clearError: true);
  void setPhone(String phone) => state = state.copyWith(phone: phone, clearError: true);
  void reset() => state = const AtcState();

  Future<AtcResult?> submit(NetworkProvider network) async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);

    final dio = _ref.read(dioClientProvider);
    final hive = _ref.read(hiveStorageProvider);

    try {
      final response = await dio.post(
        AppEndpoints.airtimeToCash,
        data: {
          'network': network.code,
          'phone': state.phone,
          'amount': state.amount,
        },
      );
      final result = AtcResult.fromJson(response.data as Map<String, dynamic>);
      if (result.success) {
        await hive.remove('wallet_balance');
      }
      state = state.copyWith(isProcessing: false);
      return result;
    } on DioException catch (e) {
      final exception = ErrorHandler.handleException(e);
      state = state.copyWith(isProcessing: false, errorMessage: exception.message);
      return null;
    } catch (e) {
      state = state.copyWith(isProcessing: false, errorMessage: e.toString());
      return null;
    }
  }
}

final atcNotifierProvider = StateNotifierProvider.autoDispose<AtcNotifier, AtcState>((ref) {
  return AtcNotifier(ref);
});