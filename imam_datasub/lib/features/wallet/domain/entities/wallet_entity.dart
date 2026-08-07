import 'package:equatable/equatable.dart';

class WalletEntity extends Equatable {
  const WalletEntity({
    required this.balance,
    this.bonusBalance = 0.0,
    this.virtualAccountNumber,
    this.virtualAccountBank,
    this.virtualAccountName,
    this.lastUpdated,
  });

  final double balance;
  final double bonusBalance;
  final String? virtualAccountNumber;
  final String? virtualAccountBank;
  final String? virtualAccountName;
  final DateTime? lastUpdated;

  double get totalBalance => balance + bonusBalance;

  static const empty = WalletEntity(balance: 0.0);

  WalletEntity copyWith({
    double? balance,
    double? bonusBalance,
    String? virtualAccountNumber,
    String? virtualAccountBank,
    String? virtualAccountName,
    DateTime? lastUpdated,
  }) {
    return WalletEntity(
      balance: balance ?? this.balance,
      bonusBalance: bonusBalance ?? this.bonusBalance,
      virtualAccountNumber: virtualAccountNumber ?? this.virtualAccountNumber,
      virtualAccountBank: virtualAccountBank ?? this.virtualAccountBank,
      virtualAccountName: virtualAccountName ?? this.virtualAccountName,
      lastUpdated: lastUpdated ?? this.lastUpdated,
    );
  }

  @override
  List<Object?> get props => [
        balance,
        bonusBalance,
        virtualAccountNumber,
        virtualAccountBank,
        virtualAccountName,
        lastUpdated,
      ];
}
