import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/error/error_handler.dart';
import '../../domain/entities/banner_entity.dart';

abstract class HomeRemoteDataSource {
  Future<List<BannerEntity>> getBanners();
  Future<Map<String, dynamic>> getDataPrices();
}

class HomeRemoteDataSourceImpl implements HomeRemoteDataSource {
  const HomeRemoteDataSourceImpl(this._dio);
  final Dio _dio;

  @override
  Future<List<BannerEntity>> getBanners() async {
    try {
      final response = await _dio.get(AppEndpoints.banners);
      final list = (response.data['data'] ?? response.data) as List<dynamic>;
      return list
          .map((e) => BannerEntity.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }

  @override
  Future<Map<String, dynamic>> getDataPrices() async {
    try {
      final response = await _dio.get(AppEndpoints.dataNetworks);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ErrorHandler.handleException(e);
    }
  }
}
