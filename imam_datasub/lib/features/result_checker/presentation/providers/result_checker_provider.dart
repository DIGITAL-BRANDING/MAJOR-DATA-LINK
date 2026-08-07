import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';

enum ExamType { waec, neco, nabteb }

extension ExamTypeX on ExamType {
  String get label {
    switch (this) {
      case ExamType.waec:
        return 'WAEC';
      case ExamType.neco:
        return 'NECO';
      case ExamType.nabteb:
        return 'NABTEB';
    }
  }

  String get code => label.toLowerCase();

  String get fullName {
    switch (this) {
      case ExamType.waec:
        return 'West African Examinations Council';
      case ExamType.neco:
        return 'National Examinations Council';
      case ExamType.nabteb:
        return 'National Business & Technical Examinations Board';
    }
  }

  double get fallbackPrice {
    switch (this) {
      case ExamType.waec:
        return 5150;
      case ExamType.neco:
        return 2150;
      case ExamType.nabteb:
        return 900;
    }
  }
}

class ResultCheckerResult {
  const ResultCheckerResult({
    required this.success,
    required this.reference,
    required this.message,
    this.pin,
    this.serial,
    this.balanceAfter,
  });

  final bool success;
  final String reference;
  final String message;
  final String? pin;
  final String? serial;
  final double? balanceAfter;

  factory ResultCheckerResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return ResultCheckerResult(
      success: json['status'] == true || json['status'] == 'success',
      reference: data['reference']?.toString() ?? '',
      message: json['message']?.toString() ?? '',
      pin: data['pin']?.toString(),
      serial: data['serial']?.toString(),
      balanceAfter: data['balance_after'] != null
          ? double.tryParse(data['balance_after'].toString())
          : null,
    );
  }
}

final resultCheckerRemoteProvider = Provider((ref) {
  return _ResultCheckerRemote(ref.read(dioClientProvider));
});

class _ResultCheckerRemote {
  const _ResultCheckerRemote(this._dio);
  final Dio _dio;

  Future<double> getUnitPrice(ExamType examType) async {
    try {
      final response = await _dio.get(AppEndpoints.resultPrice(examType.code));
      final data =
          response.data['data'] as Map<String, dynamic>? ?? response.data;
      return double.tryParse(data['unitPrice']?.toString() ?? '') ??
          double.tryParse(data['unit_price']?.toString() ?? '') ??
          examType.fallbackPrice;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  Future<ResultCheckerResult> purchasePin({
    required ExamType examType,
    required int quantity,
  }) async {
    try {
      final endpoint = switch (examType) {
        ExamType.waec => AppEndpoints.waecPin,
        ExamType.neco => AppEndpoints.necoPin,
        ExamType.nabteb => AppEndpoints.nabtebPin,
      };
      final response = await _dio.post(
        endpoint,
        data: {'quantity': quantity, 'exam_type': examType.label},
        options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
      );
      return ResultCheckerResult.fromJson(
        response.data as Map<String, dynamic>,
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}

class ResultCheckerState {
  const ResultCheckerState({
    this.quantity = 1,
    this.unitPrice = 0,
    this.isLoadingPrice = false,
    this.isProcessing = false,
    this.errorMessage,
  });

  final int quantity;
  final double unitPrice;
  final bool isLoadingPrice;
  final bool isProcessing;
  final String? errorMessage;

  double get totalAmount => unitPrice * quantity;

  ResultCheckerState copyWith({
    int? quantity,
    double? unitPrice,
    bool? isLoadingPrice,
    bool? isProcessing,
    String? errorMessage,
    bool clearError = false,
  }) {
    return ResultCheckerState(
      quantity: quantity ?? this.quantity,
      unitPrice: unitPrice ?? this.unitPrice,
      isLoadingPrice: isLoadingPrice ?? this.isLoadingPrice,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class ResultCheckerNotifier extends StateNotifier<ResultCheckerState> {
  ResultCheckerNotifier(this._ref, this._examType)
    : super(ResultCheckerState(unitPrice: _examType.fallbackPrice)) {
    loadPrice();
  }

  final Ref _ref;
  final ExamType _examType;

  Future<void> loadPrice() async {
    state = state.copyWith(isLoadingPrice: true, clearError: true);
    try {
      final price = await _ref
          .read(resultCheckerRemoteProvider)
          .getUnitPrice(_examType);
      state = state.copyWith(unitPrice: price, isLoadingPrice: false);
    } catch (_) {
      state = state.copyWith(
        unitPrice: _examType.fallbackPrice,
        isLoadingPrice: false,
      );
    }
  }

  void setQuantity(int qty) =>
      state = state.copyWith(quantity: qty.clamp(1, 10));

  Future<ResultCheckerResult?> purchasePin() async {
    state = state.copyWith(isProcessing: true, clearError: true);
    try {
      final ds = _ref.read(resultCheckerRemoteProvider);
      final result = await ds.purchasePin(
        examType: _examType,
        quantity: state.quantity,
      );
      if (result.success) {
        await _ref.read(hiveStorageProvider).remove('wallet_balance');
      }
      state = state.copyWith(isProcessing: false);
      return result;
    } catch (e) {
      state = state.copyWith(isProcessing: false, errorMessage: e.toString());
      return null;
    }
  }

  void reset() =>
      state = ResultCheckerState(unitPrice: _examType.fallbackPrice);
}

final waecNotifierProvider =
    StateNotifierProvider.autoDispose<
      ResultCheckerNotifier,
      ResultCheckerState
    >((ref) => ResultCheckerNotifier(ref, ExamType.waec));

final necoNotifierProvider =
    StateNotifierProvider.autoDispose<
      ResultCheckerNotifier,
      ResultCheckerState
    >((ref) => ResultCheckerNotifier(ref, ExamType.neco));

final nabtebNotifierProvider =
    StateNotifierProvider.autoDispose<
      ResultCheckerNotifier,
      ResultCheckerState
    >((ref) => ResultCheckerNotifier(ref, ExamType.nabteb));
