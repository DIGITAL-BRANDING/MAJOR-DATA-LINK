import 'package:flutter/foundation.dart';
import 'package:logger/logger.dart';

final appLogger = AppLogger._instance;

class AppLogger {
  AppLogger._();
  static final AppLogger _instance = AppLogger._();

  late final Logger _logger = Logger(
    printer: PrettyPrinter(
      methodCount: 2,
      errorMethodCount: 8,
      lineLength: 120,
      colors: true,
      printEmojis: true,
      dateTimeFormat: DateTimeFormat.onlyTimeAndSinceStart,
    ),
    filter: kDebugMode ? DevelopmentFilter() : ProductionFilter(),
  );

  void d(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.d(message, error: error, stackTrace: stackTrace);
  }

  void i(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.i(message, error: error, stackTrace: stackTrace);
  }

  void w(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.w(message, error: error, stackTrace: stackTrace);
  }

  void e(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.e(message, error: error, stackTrace: stackTrace);
  }

  void api(String method, String url, {Object? body, int? statusCode}) {
    if (kDebugMode) {
      _logger.d(
        '[$method] $url ${statusCode != null ? '→ $statusCode' : ''}',
        error: body,
      );
    }
  }
}
