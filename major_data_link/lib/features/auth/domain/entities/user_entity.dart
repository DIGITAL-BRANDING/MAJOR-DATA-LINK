import 'package:equatable/equatable.dart';

enum KycStatus { unverified, pending, verified, rejected }

class UserEntity extends Equatable {
  const UserEntity({
    required this.id,
    required this.fullName,
    required this.email,
    required this.phone,
    this.photoUrl,
    this.walletBalance = 0.0,
    this.referralCode = '',
    this.referralEarnings = 0.0,
    this.kycStatus = KycStatus.unverified,
    this.isEmailVerified = false,
    this.isPhoneVerified = false,
    this.createdAt,
    this.virtualAccountNumber,
    this.virtualAccountBank,
    this.isAdmin = false,
    this.adminRole,
  });

  final String id;
  final String fullName;
  final String email;
  final String phone;
  final String? photoUrl;
  final double walletBalance;
  final String referralCode;
  final double referralEarnings;
  final KycStatus kycStatus;
  final bool isEmailVerified;
  final bool isPhoneVerified;
  final DateTime? createdAt;
  final String? virtualAccountNumber;
  final String? virtualAccountBank;
  final bool isAdmin;
  final String? adminRole;

  String get firstName => fullName.split(' ').first;

  String get initials {
    final parts = fullName.trim().split(' ');
    if (parts.isEmpty) return '';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
  }

  UserEntity copyWith({
    String? id,
    String? fullName,
    String? email,
    String? phone,
    String? photoUrl,
    double? walletBalance,
    String? referralCode,
    double? referralEarnings,
    KycStatus? kycStatus,
    bool? isEmailVerified,
    bool? isPhoneVerified,
    DateTime? createdAt,
    String? virtualAccountNumber,
    String? virtualAccountBank,
    bool? isAdmin,
    String? adminRole,
  }) {
    return UserEntity(
      id: id ?? this.id,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      photoUrl: photoUrl ?? this.photoUrl,
      walletBalance: walletBalance ?? this.walletBalance,
      referralCode: referralCode ?? this.referralCode,
      referralEarnings: referralEarnings ?? this.referralEarnings,
      kycStatus: kycStatus ?? this.kycStatus,
      isEmailVerified: isEmailVerified ?? this.isEmailVerified,
      isPhoneVerified: isPhoneVerified ?? this.isPhoneVerified,
      createdAt: createdAt ?? this.createdAt,
      virtualAccountNumber: virtualAccountNumber ?? this.virtualAccountNumber,
      virtualAccountBank: virtualAccountBank ?? this.virtualAccountBank,
      isAdmin: isAdmin ?? this.isAdmin,
      adminRole: adminRole ?? this.adminRole,
    );
  }

  static const empty = UserEntity(id: '', fullName: '', email: '', phone: '');

  bool get isEmpty => this == UserEntity.empty;
  bool get isNotEmpty => this != UserEntity.empty;

  @override
  List<Object?> get props => [
    id,
    fullName,
    email,
    phone,
    photoUrl,
    walletBalance,
    referralCode,
    referralEarnings,
    kycStatus,
    isEmailVerified,
    isPhoneVerified,
    createdAt,
    virtualAccountNumber,
    virtualAccountBank,
    isAdmin,
    adminRole,
  ];
}
