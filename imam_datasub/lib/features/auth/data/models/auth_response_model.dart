import 'user_model.dart';

class AuthResponseModel {
  const AuthResponseModel({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
    this.expiresIn,
    this.requiresOtp = false,
    this.requiresPinSetup = false,
    this.requiresLoginPinSetup = false,
  });

  final String accessToken;
  final String refreshToken;
  final UserModel user;
  final int? expiresIn;
  final bool requiresOtp;
  final bool requiresPinSetup;
  final bool requiresLoginPinSetup;

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;

    return AuthResponseModel(
      accessToken: data['access_token']?.toString() ??
          data['token']?.toString() ??
          '',
      refreshToken: data['refresh_token']?.toString() ?? '',
      user: UserModel.fromJson(
        data['user'] as Map<String, dynamic>? ?? data,
      ),
      expiresIn: data['expires_in'] is int
          ? data['expires_in'] as int
          : int.tryParse(data['expires_in']?.toString() ?? ''),
      requiresOtp: data['requires_otp'] == true,
      requiresPinSetup: data['requires_pin_setup'] == true ||
          data['has_pin'] == false,
      requiresLoginPinSetup: data['requires_login_pin_setup'] == true,
    );
  }

  DateTime get expiryDateTime => DateTime.now().add(
        Duration(seconds: expiresIn ?? 3600),
      );
}
