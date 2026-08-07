import 'package:equatable/equatable.dart';

enum NetworkProvider { mtn, glo, airtel, nineMobile }

extension NetworkProviderX on NetworkProvider {
  String get label {
    switch (this) {
      case NetworkProvider.mtn:
        return 'MTN';
      case NetworkProvider.glo:
        return 'Glo';
      case NetworkProvider.airtel:
        return 'Airtel';
      case NetworkProvider.nineMobile:
        return '9mobile';
    }
  }

  String get code {
    switch (this) {
      case NetworkProvider.mtn:
        return 'MTN';
      case NetworkProvider.glo:
        return 'GLO';
      case NetworkProvider.airtel:
        return 'AIRTEL';
      case NetworkProvider.nineMobile:
        return '9MOBILE';
    }
  }

  static NetworkProvider fromCode(String code) {
    switch (code.toUpperCase()) {
      case 'MTN':
        return NetworkProvider.mtn;
      case 'GLO':
        return NetworkProvider.glo;
      case 'AIRTEL':
        return NetworkProvider.airtel;
      case '9MOBILE':
      case 'NINEMOBILE':
        return NetworkProvider.nineMobile;
      default:
        return NetworkProvider.mtn;
    }
  }

  /// Detect network from Nigerian phone number prefix
  static NetworkProvider? detectFromPhone(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 4) return null;
    final prefix = digits.substring(0, 4);

    const mtnPrefixes = [
      '0803',
      '0806',
      '0813',
      '0816',
      '0810',
      '0814',
      '0903',
      '0906',
      '0913',
      '0916',
    ];
    const gloPrefixes = ['0805', '0807', '0815', '0811', '0905', '0915'];
    const airtelPrefixes = [
      '0802',
      '0808',
      '0812',
      '0701',
      '0902',
      '0901',
      '0904',
      '0907',
      '0912',
    ];
    const nineMobilePrefixes = ['0809', '0817', '0818', '0908', '0909'];

    if (mtnPrefixes.contains(prefix)) return NetworkProvider.mtn;
    if (gloPrefixes.contains(prefix)) return NetworkProvider.glo;
    if (airtelPrefixes.contains(prefix)) return NetworkProvider.airtel;
    if (nineMobilePrefixes.contains(prefix)) return NetworkProvider.nineMobile;
    return null;
  }
}

enum DataPlanCategory { sme, gifting, corporate, awoof, direct }

class DataPlanEntity extends Equatable {
  const DataPlanEntity({
    required this.id,
    required this.network,
    required this.size,
    required this.validity,
    required this.price,
    required this.category,
    this.planTypeRaw,
    this.originalPrice,
    this.description,
  });

  final String id;
  final NetworkProvider network;
  final String size; // "1GB", "2.5GB"
  final String validity; // "30 days"
  final double price;
  final DataPlanCategory category;
  // Exact Data Type label as returned by the backend (e.g. "SME2",
  // "CORPORATE GIFTING") - drives the Alrahuz-style Data Type picker, which
  // needs the precise 6-way distinction rather than the collapsed
  // [DataPlanCategory] enum below.
  final String? planTypeRaw;
  final double? originalPrice; // for showing discount strike-through
  final String? description;

  bool get hasDiscount => originalPrice != null && originalPrice! > price;

  double get discountPercent {
    if (!hasDiscount) return 0;
    return ((originalPrice! - price) / originalPrice!) * 100;
  }

  factory DataPlanEntity.fromJson(
    Map<String, dynamic> json,
    NetworkProvider network,
  ) {
    final rawName =
        json['name']?.toString() ??
        json['plan_name']?.toString() ??
        json['size']?.toString() ??
        json['data_size']?.toString() ??
        '';
    final parsed = _parsePlanName(rawName);
    final rawValidity = json['validity']?.toString() ?? '';

    final rawPlanType = json['planType']?.toString();

    return DataPlanEntity(
      id: json['id']?.toString() ?? json['plan_id']?.toString() ?? '',
      network: network,
      size: parsed.size,
      validity: _cleanValidity(rawValidity.isEmpty ? '30 days' : rawValidity),
      price: _toDouble(json['price'] ?? json['amount'] ?? json['plan_amount']),
      category: _parseCategory(rawPlanType ?? parsed.category),
      planTypeRaw: (rawPlanType != null && rawPlanType.isNotEmpty)
          ? rawPlanType
          : (parsed.category.isNotEmpty ? parsed.category : null),
      originalPrice: json['original_price'] != null
          ? _toDouble(json['original_price'])
          : null,
      description: json['description']?.toString() ?? parsed.category,
    );
  }

  static ({String size, String category}) _parsePlanName(String name) {
    final parts = name.split(' - ');
    final category = parts.length > 1 ? parts.first.trim() : '';
    final rawSize = parts.length > 1 ? parts.sublist(1).join(' - ') : name;
    return (size: _normalizeSize(rawSize.trim()), category: category);
  }

  static String _normalizeSize(String value) {
    final match = RegExp(
      r'(\d+(?:\.\d+)?)\s*(GB|MB)',
      caseSensitive: false,
    ).firstMatch(value);
    if (match == null) return value;
    final number = double.tryParse(match.group(1) ?? '') ?? 0;
    final unit = (match.group(2) ?? '').toUpperCase();
    final cleanNumber = number == number.roundToDouble()
        ? number.toInt().toString()
        : number.toString();
    return '$cleanNumber$unit';
  }

  static String _cleanValidity(String value) {
    return value
        .replaceAll(RegExp(r'\{.*?\}'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0.0;
    if (v is double) return v;
    if (v is int) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0.0;
    return 0.0;
  }

  static DataPlanCategory _parseCategory(String? cat) {
    switch (cat?.toLowerCase()) {
      case 'gifting':
        return DataPlanCategory.gifting;
      case 'corporate':
      case 'corporate gifting':
        return DataPlanCategory.corporate;
      case 'awoof':
        return DataPlanCategory.awoof;
      case 'direct':
      case 'data share':
      case 'data coupons':
        return DataPlanCategory.direct;
      default:
        return DataPlanCategory.sme;
    }
  }

  @override
  List<Object?> get props => [
    id,
    network,
    size,
    validity,
    price,
    category,
    originalPrice,
  ];
}
