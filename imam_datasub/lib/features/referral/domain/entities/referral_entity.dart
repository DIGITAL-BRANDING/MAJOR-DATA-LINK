import 'package:equatable/equatable.dart';
import '../../../../core/config/app_config.dart';

class ReferralEntity extends Equatable {
  const ReferralEntity({
    required this.referralCode,
    required this.totalReferrals,
    required this.totalEarned,
    required this.pendingCommission,
    required this.paidCommission,
    this.referees = const [],
    this.commissionRate = 0.02,
    this.minWithdrawal = 500,
    this.isEnabled = true,
  });

  final String referralCode;
  final int totalReferrals;
  final double totalEarned;
  final double pendingCommission;
  final double paidCommission;
  final List<RefereeEntity> referees;

  /// Fraction of a referee's purchase paid as commission (0.02 = 2%).
  /// Admin-configurable server-side - always read this instead of hardcoding
  /// a rate, since it can change.
  final double commissionRate;

  /// Minimum commission (in naira) that can be withdrawn to the wallet.
  /// Admin-configurable server-side - always read this instead of hardcoding
  /// a minimum, since it can change.
  final double minWithdrawal;

  /// Whether the referral program is currently active. When false, the
  /// withdraw action should be disabled/hidden with an explanatory message.
  final bool isEnabled;

  String get shareLink =>
      '${AppConfig.referralLinkBaseUrl}/ref/$referralCode';

  factory ReferralEntity.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return ReferralEntity(
      referralCode: data['referral_code']?.toString() ?? '',
      totalReferrals:
          int.tryParse(data['total_referrals']?.toString() ?? '0') ?? 0,
      totalEarned: _toDouble(data['total_earned']),
      pendingCommission: _toDouble(data['pending_commission']),
      paidCommission: _toDouble(data['paid_commission']),
      commissionRate: _rateOrDefault(data['commission_rate']),
      minWithdrawal: _minWithdrawalOrDefault(data['min_withdrawal']),
      isEnabled: data['is_enabled'] as bool? ?? true,
      referees: (data['referees'] as List<dynamic>? ?? [])
          .map((e) =>
              RefereeEntity.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }

  // The backend always sends these now, but fall back to sane defaults if
  // an old cached response or a field is ever missing/zero.
  static double _rateOrDefault(dynamic v) {
    final value = _toDouble(v);
    return value > 0 ? value : 0.02;
  }

  static double _minWithdrawalOrDefault(dynamic v) {
    final value = _toDouble(v);
    return value > 0 ? value : 500;
  }

  static const empty = ReferralEntity(
    referralCode: '',
    totalReferrals: 0,
    totalEarned: 0,
    pendingCommission: 0,
    paidCommission: 0,
  );

  @override
  List<Object?> get props => [
        referralCode,
        totalReferrals,
        totalEarned,
        pendingCommission,
        paidCommission,
        commissionRate,
        minWithdrawal,
        isEnabled,
      ];
}

class RefereeEntity extends Equatable {
  const RefereeEntity({
    required this.name,
    required this.joinedAt,
    required this.totalTransactions,
    required this.commissionEarned,
  });

  final String name;
  final DateTime joinedAt;
  final int totalTransactions;
  final double commissionEarned;

  factory RefereeEntity.fromJson(Map<String, dynamic> json) {
    return RefereeEntity(
      name: json['name']?.toString() ?? 'User',
      joinedAt: DateTime.tryParse(json['joined_at']?.toString() ?? '') ??
          DateTime.now(),
      totalTransactions:
          int.tryParse(json['total_transactions']?.toString() ?? '0') ?? 0,
      commissionEarned: double.tryParse(
              json['commission_earned']?.toString() ?? '0') ??
          0.0,
    );
  }

  @override
  List<Object?> get props =>
      [name, joinedAt, totalTransactions, commissionEarned];
}
