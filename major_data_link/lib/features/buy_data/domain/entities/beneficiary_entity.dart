import 'package:equatable/equatable.dart';

enum BeneficiaryType { data, airtime, cable, electricity }

class BeneficiaryEntity extends Equatable {
  const BeneficiaryEntity({
    required this.id,
    required this.type,
    required this.value, // phone number, smartcard, or meter number
    required this.label,
    this.network,
    this.provider,
    this.createdAt,
  });

  final String id;
  final BeneficiaryType type;
  final String value;
  final String label;
  final String? network;
  final String? provider;
  final DateTime? createdAt;

  factory BeneficiaryEntity.fromJson(Map<String, dynamic> json) {
    return BeneficiaryEntity(
      id: json['id']?.toString() ?? '',
      type: _parseType(json['type']?.toString()),
      value: json['value']?.toString() ?? json['phone']?.toString() ?? '',
      label: json['label']?.toString() ?? json['name']?.toString() ?? '',
      network: json['network']?.toString(),
      provider: json['provider']?.toString(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type.name,
        'value': value,
        'label': label,
        'network': network,
        'provider': provider,
        'created_at': createdAt?.toIso8601String(),
      };

  static BeneficiaryType _parseType(String? type) {
    switch (type) {
      case 'airtime':
        return BeneficiaryType.airtime;
      case 'cable':
        return BeneficiaryType.cable;
      case 'electricity':
        return BeneficiaryType.electricity;
      default:
        return BeneficiaryType.data;
    }
  }

  @override
  List<Object?> get props =>
      [id, type, value, label, network, provider, createdAt];
}
