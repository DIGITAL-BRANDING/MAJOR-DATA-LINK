import '../../domain/entities/wallet_entity.dart';

class WalletModel extends WalletEntity {
  const WalletModel({
    required super.balance,
    super.bonusBalance,
    super.virtualAccountNumber,
    super.virtualAccountBank,
    super.virtualAccountName,
    super.lastUpdated,
  });

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return WalletModel(
      balance: _toDouble(data['balance'] ?? data['wallet_balance']),
      bonusBalance: _toDouble(data['bonus_balance']),
      virtualAccountNumber: data['virtual_account_number']?.toString(),
      virtualAccountBank: data['virtual_account_bank']?.toString(),
      virtualAccountName: data['virtual_account_name']?.toString(),
      lastUpdated: DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
        'balance': balance,
        'bonus_balance': bonusBalance,
        'virtual_account_number': virtualAccountNumber,
        'virtual_account_bank': virtualAccountBank,
        'virtual_account_name': virtualAccountName,
        'last_updated': lastUpdated?.toIso8601String(),
      };

  factory WalletModel.fromCache(Map<String, dynamic> json) {
    return WalletModel(
      balance: _toDouble(json['balance']),
      bonusBalance: _toDouble(json['bonus_balance']),
      virtualAccountNumber: json['virtual_account_number']?.toString(),
      virtualAccountBank: json['virtual_account_bank']?.toString(),
      virtualAccountName: json['virtual_account_name']?.toString(),
      lastUpdated: json['last_updated'] != null
          ? DateTime.tryParse(json['last_updated'].toString())
          : null,
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }
}
