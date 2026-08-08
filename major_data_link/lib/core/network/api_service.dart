import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';
import '../error/error_handler.dart';
import '../error/failures.dart';
import '../utils/logger.dart';

abstract class ApiService {
  Future<Either<Failure, T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParams,
    T Function(dynamic)? fromJson,
  });

  Future<Either<Failure, T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParams,
    T Function(dynamic)? fromJson,
  });

  Future<Either<Failure, T>> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  });

  Future<Either<Failure, T>> patch<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  });

  Future<Either<Failure, T>> delete<T>(
    String path, {
    T Function(dynamic)? fromJson,
  });

  Future<Either<Failure, T>> upload<T>(
    String path, {
    required FormData formData,
    T Function(dynamic)? fromJson,
    void Function(int, int)? onProgress,
  });
}

class DioApiService implements ApiService {
  const DioApiService(this._dio);

  final Dio _dio;

  @override
  Future<Either<Failure, T>> get<T>(
    String path, {
    Map<String, dynamic>? queryParams,
    T Function(dynamic)? fromJson,
  }) =>
      _execute<T>(
        () => _dio.get(path, queryParameters: queryParams),
        fromJson: fromJson,
      );

  @override
  Future<Either<Failure, T>> post<T>(
    String path, {
    dynamic data,
    Map<String, dynamic>? queryParams,
    T Function(dynamic)? fromJson,
  }) =>
      _execute<T>(
        () => _dio.post(path, data: data, queryParameters: queryParams),
        fromJson: fromJson,
      );

  @override
  Future<Either<Failure, T>> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) =>
      _execute<T>(
        () => _dio.put(path, data: data),
        fromJson: fromJson,
      );

  @override
  Future<Either<Failure, T>> patch<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) =>
      _execute<T>(
        () => _dio.patch(path, data: data),
        fromJson: fromJson,
      );

  @override
  Future<Either<Failure, T>> delete<T>(
    String path, {
    T Function(dynamic)? fromJson,
  }) =>
      _execute<T>(
        () => _dio.delete(path),
        fromJson: fromJson,
      );

  @override
  Future<Either<Failure, T>> upload<T>(
    String path, {
    required FormData formData,
    T Function(dynamic)? fromJson,
    void Function(int, int)? onProgress,
  }) =>
      _execute<T>(
        () => _dio.post(
          path,
          data: formData,
          options: Options(contentType: 'multipart/form-data'),
          onSendProgress: onProgress,
        ),
        fromJson: fromJson,
      );

  Future<Either<Failure, T>> _execute<T>(
    Future<Response> Function() request, {
    T Function(dynamic)? fromJson,
  }) async {
    try {
      final response = await request();

      // Handle non-success status codes that passed validateStatus
      if (response.statusCode != null &&
          response.statusCode! >= 400 &&
          response.statusCode! < 500) {
        final exception = ErrorHandler.handleException(
          DioException(
            requestOptions: response.requestOptions,
            response: response,
            type: DioExceptionType.badResponse,
          ),
        );
        return Left(ErrorHandler.exceptionToFailure(exception));
      }

      final data = response.data;

      if (fromJson != null) {
        try {
          return Right(fromJson(data));
        } catch (e, st) {
          appLogger.e('JSON parsing failed for ${response.requestOptions.path}',
              error: e, stackTrace: st);
          return const Left(UnknownFailure(message: 'Failed to parse response'));
        }
      }

      return Right(data as T);
    } on DioException catch (e) {
      final exception = ErrorHandler.handleException(e);
      return Left(ErrorHandler.exceptionToFailure(exception));
    } catch (e, st) {
      appLogger.e('Unexpected API error', error: e, stackTrace: st);
      return Left(UnknownFailure(message: e.toString()));
    }
  }
}

/// Standard API response wrapper matching Alrahuz API format
class ApiResponse<T> {
  const ApiResponse({
    required this.status,
    required this.message,
    this.data,
    this.errors,
  });

  final bool status;
  final String message;
  final T? data;
  final Map<String, dynamic>? errors;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic)? fromData,
  ) {
    return ApiResponse<T>(
      status: json['status'] == true || json['status'] == 'success',
      message: json['message']?.toString() ?? '',
      data: json['data'] != null && fromData != null
          ? fromData(json['data'])
          : json['data'] as T?,
      errors: json['errors'] as Map<String, dynamic>?,
    );
  }

  bool get isSuccess => status;
}
