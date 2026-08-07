import '../../domain/entities/user_entity.dart';

class UserModel extends UserEntity {
  const UserModel({
    required super.id,
    required super.fullName,
    required super.email,
    required super.phone,
    super.photoUrl,
    super.walletBalance,
    super.referralCode,
    super.referralEarnings,
    super.kycStatus,
    super.isEmailVerified,
    super.isPhoneVerified,
    super.createdAt,
    super.virtualAccountNumber,
    super.virtualAccountBank,
    super.isAdmin,
    super.adminRole,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id']?.toString() ?? json['user_id']?.toString() ?? '',
      fullName: json['full_name']?.toString() ?? json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      phone:
          json['phone']?.toString() ?? json['phone_number']?.toString() ?? '',
      photoUrl: json['photo_url']?.toString() ?? json['avatar']?.toString(),
      walletBalance: _toDouble(json['wallet_balance'] ?? json['balance']),
      referralCode: json['referral_code']?.toString() ?? '',
      referralEarnings: _toDouble(json['referral_earnings']),
      kycStatus: _parseKycStatus(json['kyc_status']?.toString()),
      isEmailVerified:
          json['email_verified'] == true || json['email_verified'] == 1,
      isPhoneVerified:
          json['phone_verified'] == true || json['phone_verified'] == 1,
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      virtualAccountNumber: json['virtual_account_number']?.toString(),
      virtualAccountBank: json['virtual_account_bank']?.toString(),
      isAdmin:
          json['is_admin'] == true ||
          json['isAdmin'] == true ||
          json['admin_role'] != null ||
          json['adminRole'] != null,
      adminRole:
          json['admin_role']?.toString() ?? json['adminRole']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'full_name': fullName,
      'email': email,
      'phone': phone,
      'photo_url': photoUrl,
      'wallet_balance': walletBalance,
      'referral_code': referralCode,
      'referral_earnings': referralEarnings,
      'kyc_status': kycStatus.name,
      'email_verified': isEmailVerified,
      'phone_verified': isPhoneVerified,
      'created_at': createdAt?.toIso8601String(),
      'virtual_account_number': virtualAccountNumber,
      'virtual_account_bank': virtualAccountBank,
      'is_admin': isAdmin,
      'admin_role': adminRole,
    };
  }

  factory UserModel.fromEntity(UserEntity entity) {
    return UserModel(
      id: entity.id,
      fullName: entity.fullName,
      email: entity.email,
      phone: entity.phone,
      photoUrl: entity.photoUrl,
      walletBalance: entity.walletBalance,
      referralCode: entity.referralCode,
      referralEarnings: entity.referralEarnings,
      kycStatus: entity.kycStatus,
      isEmailVerified: entity.isEmailVerified,
      isPhoneVerified: entity.isPhoneVerified,
      createdAt: entity.createdAt,
      virtualAccountNumber: entity.virtualAccountNumber,
      virtualAccountBank: entity.virtualAccountBank,
      isAdmin: entity.isAdmin,
      adminRole: entity.adminRole,
    );
  }

  static double _toDouble(dynamic value) {
    if (value == null) return 0.0;
    if (value is double) return value;
    if (value is int) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0.0;
    return 0.0;
  }

  static KycStatus _parseKycStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return KycStatus.pending;
      case 'verified':
      case 'approved':
        return KycStatus.verified;
      case 'rejected':
      case 'failed':
        return KycStatus.rejected;
      default:
        return KycStatus.unverified;
    }
  }
}
