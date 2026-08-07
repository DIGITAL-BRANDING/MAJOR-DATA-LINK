import 'package:equatable/equatable.dart';

enum TxType {
  data,
  airtime,
  cable,
  electricity,
  fund,
  transfer,
  referral,
  recharge,
  waec,
  neco,
  nabteb,
  jamb,
  sms,
  withdrawal,
}

enum TxStatus { success, pending, failed }

class TransactionEntity extends Equatable {
  const TransactionEntity({
    required this.id,
    required this.type,
    required this.status,
    required this.title,
    required this.subtitle,
    required this.amount,
    required this.isCredit,
    required this.date,
    this.reference,
    this.recipientPhone,
    this.network,
    this.balanceBefore,
    this.balanceAfter,
    this.metadata,
  });

  final String id;
  final TxType type;
  final TxStatus status;
  final String title;
  final String subtitle;
  final double amount;
  final bool isCredit;
  final DateTime date;
  final String? reference;
  final String? recipientPhone;
  final String? network;
  final double? balanceBefore;
  final double? balanceAfter;
  final Map<String, dynamic>? metadata;

  factory TransactionEntity.fromJson(Map<String, dynamic> json) {
    return TransactionEntity(
      id: json['id']?.toString() ?? json['reference']?.toString() ?? '',
      type: _parseType(json['type']?.toString()),
      status: _parseStatus(json['status']?.toString()),
      title: json['title']?.toString() ?? json['description']?.toString() ?? '',
      subtitle: json['subtitle']?.toString() ??
          json['recipient']?.toString() ??
          json['phone']?.toString() ??
          '',
      amount: _toDouble(json['amount']),
      isCredit: json['is_credit'] == true ||
          json['type']?.toString() == 'fund' ||
          json['type']?.toString() == 'referral',
      date: DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
      reference: json['reference']?.toString(),
      recipientPhone: json['phone']?.toString(),
      network: json['network']?.toString(),
      balanceBefore: json['balance_before'] != null
          ? _toDouble(json['balance_before'])
          : null,
      balanceAfter: json['balance_after'] != null
          ? _toDouble(json['balance_after'])
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }

  static TxType _parseType(String? type) {
    switch (type?.toLowerCase()) {
      case 'data':
        return TxType.data;
      case 'airtime':
        return TxType.airtime;
      case 'cable':
      case 'cable_tv':
        return TxType.cable;
      case 'electricity':
        return TxType.electricity;
      case 'fund':
      case 'wallet_fund':
        return TxType.fund;
      case 'transfer':
        return TxType.transfer;
      case 'referral':
        return TxType.referral;
      case 'recharge':
      case 'recharge_card':
        return TxType.recharge;
      case 'waec':
        return TxType.waec;
      case 'neco':
        return TxType.neco;
      case 'nabteb':
        return TxType.nabteb;
      case 'jamb':
        return TxType.jamb;
      case 'sms':
      case 'bulk_sms':
        return TxType.sms;
      case 'withdrawal':
        return TxType.withdrawal;
      default:
        return TxType.data;
    }
  }

  static TxStatus _parseStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'success':
      case 'successful':
      case 'completed':
        return TxStatus.success;
      case 'pending':
      case 'processing':
        return TxStatus.pending;
      default:
        return TxStatus.failed;
    }
  }

  @override
  List<Object?> get props => [
        id,
        type,
        status,
        title,
        subtitle,
        amount,
        isCredit,
        date,
        reference,
        recipientPhone,
        network,
        balanceBefore,
        balanceAfter,
      ];
}
