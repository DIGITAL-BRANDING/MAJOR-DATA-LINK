import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/error/error_handler.dart';
import '../models/wallet_model.dart';

abstract class WalletRemoteDataSource {
  Future<WalletModel> getBalance();
  Future<WalletModel> getVirtualAccount();
  Future<Map<String, dynamic>> fundWallet({
    required double amount,
    required String paymentMethod,
  });
  Future<Map<String, dynamic>> createDynamicFunding({required double amount});
  Future<Map<String, dynamic>> redeemCoupon({required String code});
  Future<Map<String, dynamic>> verifyFunding({required String reference});
  Future<void> requestWithdrawal({
    required double amount,
    required String bankAccountNumber,
    required String bankCode,
    required String pin,
  });
}

class WalletRemoteDataSourceImpl implements WalletRemoteDataSource {
  const WalletRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<WalletModel> getBalance() async {
    try {
      final response = await _dio.get(AppEndpoints.walletBalance);
      return WalletModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<WalletModel> getVirtualAccount() async {
    try {
      final response = await _dio.get(AppEndpoints.virtualAccount);
      return WalletModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> fundWallet({
    required double amount,
    required String paymentMethod,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        AppEndpoints.fundWallet,
        data: {'amount': amount, 'payment_method': paymentMethod},
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> createDynamicFunding({
    required double amount,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        AppEndpoints.fundWalletDynamic,
        data: {'amount': amount},
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> redeemCoupon({required String code}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        AppEndpoints.redeemCoupon,
        data: {'code': code},
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> verifyFunding({
    required String reference,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        AppEndpoints.fundWalletVerify,
        data: {'reference': reference},
      );
      return response.data ?? <String, dynamic>{};
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<void> requestWithdrawal({
    required double amount,
    required String bankAccountNumber,
    required String bankCode,
    required String pin,
  }) async {
    try {
      await _dio.post(
        AppEndpoints.withdrawalRequest,
        data: {
          'amount': amount,
          'account_number': bankAccountNumber,
          'bank_code': bankCode,
          'pin': pin,
        },
      );
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}
