import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';

// ── JAMB service types ─────────────────────────────────────
enum JambServiceType { pin, result, profileCode }

extension JambServiceTypeX on JambServiceType {
  String get label {
    switch (this) {
      case JambServiceType.pin:
        return 'JAMB PIN';
      case JambServiceType.result:
        return 'Check Result';
      case JambServiceType.profileCode:
        return 'Profile Code';
    }
  }

  double get price {
    switch (this) {
      case JambServiceType.pin:
        return 3500;
      case JambServiceType.result:
        return 1000;
      case JambServiceType.profileCode:
        return 700;
    }
  }
}

// ── Remote data source ─────────────────────────────────────
final jambRemoteProvider = Provider((ref) {
  return _JambRemote(ref.read(dioClientProvider));
});

class _JambRemote {
  const _JambRemote(this._dio);
  final Dio _dio;

  Future<Map<String, dynamic>> purchaseService({
    required JambServiceType serviceType,
    required String regNumber,
  }) async {
    try {
      final endpoint = switch (serviceType) {
        JambServiceType.pin => AppEndpoints.jambPin,
        JambServiceType.result => AppEndpoints.jambResult,
        JambServiceType.profileCode => AppEndpoints.jambProfile,
      };
      final response = await _dio.post(
        endpoint,
        data: {
          'service_type': serviceType.name,
          'reg_number': regNumber,
          'amount': serviceType.price,
        },
      );
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

// ── State ──────────────────────────────────────────────────
class JambState {
  const JambState({
    this.serviceType = JambServiceType.pin,
    this.regNumber = '',
    this.isProcessing = false,
    this.errorMessage,
  });

  final JambServiceType serviceType;
  final String regNumber;
  final bool isProcessing;
  final String? errorMessage;

  bool get canProceed => regNumber.length >= 10;

  JambState copyWith({
    JambServiceType? serviceType,
    String? regNumber,
    bool? isProcessing,
    String? errorMessage,
    bool clearError = false,
  }) {
    return JambState(
      serviceType: serviceType ?? this.serviceType,
      regNumber: regNumber ?? this.regNumber,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class JambNotifier extends StateNotifier<JambState> {
  JambNotifier(this._ref) : super(const JambState());
  final Ref _ref;

  void setServiceType(JambServiceType type) =>
      state = state.copyWith(serviceType: type, regNumber: '', clearError: true);

  void setRegNumber(String v) =>
      state = state.copyWith(regNumber: v, clearError: true);

  Future<Map<String, dynamic>?> purchase() async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);
    try {
      final ds = _ref.read(jambRemoteProvider);
      final result = await ds.purchaseService(
        serviceType: state.serviceType,
        regNumber: state.regNumber,
      );
      if (result['status'] == true) {
        await _ref.read(hiveStorageProvider).remove('wallet_balance');
      }
      state = state.copyWith(isProcessing: false);
      return result;
    } catch (e) {
      state = state.copyWith(isProcessing: false, errorMessage: e.toString());
      return null;
    }
  }

  void reset() => state = const JambState();
}

final jambNotifierProvider =
    StateNotifierProvider.autoDispose<JambNotifier, JambState>((ref) {
  return JambNotifier(ref);
});
