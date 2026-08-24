import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../buy_data/domain/entities/data_plan_entity.dart';

class AdminUserSummary {
  const AdminUserSummary({
    required this.id,
    required this.email,
    required this.fullName,
    required this.role,
  });

  final String id;
  final String email;
  final String fullName;
  final String role;

  factory AdminUserSummary.fromJson(Map<String, dynamic> json) {
    return AdminUserSummary(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      fullName:
          json['fullName']?.toString() ?? json['full_name']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
    );
  }
}

class CustomerActivityBundle {
  const CustomerActivityBundle({
    required this.days,
    required this.summary,
    required this.topCustomers,
    required this.recentPurchases,
  });
  final int days;
  final CustomerActivitySummary summary;
  final List<CustomerUsageRow> topCustomers;
  final List<CustomerPurchaseRow> recentPurchases;

  factory CustomerActivityBundle.fromJson(
    Map<String, dynamic> json,
  ) => CustomerActivityBundle(
    days: int.tryParse(json['period_days']?.toString() ?? '') ?? 30,
    summary: CustomerActivitySummary.fromJson(
      Map<String, dynamic>.from(json['summary'] as Map? ?? const {}),
    ),
    topCustomers: ((json['top_customers'] ?? const []) as List)
        .map(
          (e) => CustomerUsageRow.fromJson(Map<String, dynamic>.from(e as Map)),
        )
        .toList(),
    recentPurchases: ((json['recent_purchases'] ?? const []) as List)
        .map(
          (e) =>
              CustomerPurchaseRow.fromJson(Map<String, dynamic>.from(e as Map)),
        )
        .toList(),
  );
}

class CustomerActivitySummary {
  const CustomerActivitySummary({
    required this.activeCustomers,
    required this.successfulPurchases,
    required this.totalUsage,
  });
  final int activeCustomers, successfulPurchases;
  final double totalUsage;
  factory CustomerActivitySummary.fromJson(Map<String, dynamic> json) =>
      CustomerActivitySummary(
        activeCustomers:
            int.tryParse(json['active_customers']?.toString() ?? '') ?? 0,
        successfulPurchases:
            int.tryParse(json['successful_purchases']?.toString() ?? '') ?? 0,
        totalUsage: _customerNum(json['total_usage']),
      );
}

class CustomerUsageRow {
  const CustomerUsageRow({
    required this.name,
    required this.email,
    required this.purchases,
    required this.totalUsage,
    this.lastPurchaseAt,
  });
  final String name, email;
  final int purchases;
  final double totalUsage;
  final DateTime? lastPurchaseAt;
  factory CustomerUsageRow.fromJson(Map<String, dynamic> json) =>
      CustomerUsageRow(
        name: json['full_name']?.toString() ?? 'Unknown user',
        email: json['email']?.toString() ?? '',
        purchases: int.tryParse(json['purchases']?.toString() ?? '') ?? 0,
        totalUsage: _customerNum(json['total_usage']),
        lastPurchaseAt: DateTime.tryParse(
          json['last_purchase_at']?.toString() ?? '',
        ),
      );
}

class CustomerPurchaseRow {
  const CustomerPurchaseRow({
    required this.name,
    required this.type,
    required this.description,
    required this.amount,
    required this.createdAt,
  });
  final String name, type, description;
  final double amount;
  final DateTime createdAt;
  factory CustomerPurchaseRow.fromJson(Map<String, dynamic> json) =>
      CustomerPurchaseRow(
        name: json['full_name']?.toString() ?? 'Unknown user',
        type: json['type']?.toString() ?? '',
        description: json['description']?.toString() ?? '',
        amount: _customerNum(json['amount']),
        createdAt:
            DateTime.tryParse(json['created_at']?.toString() ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0),
      );
}

double _customerNum(dynamic value) => value is num
    ? value.toDouble()
    : double.tryParse(value?.toString() ?? '') ?? 0;

class DataPriceRow {
  const DataPriceRow({
    required this.id,
    required this.providerPlanId,
    required this.network,
    required this.name,
    required this.providerCost,
    required this.sellingPrice,
    required this.profit,
    required this.isActive,
    this.planType,
    this.validity,
  });

  final String id;
  final String providerPlanId;
  final String network;
  final String name;
  final String? planType;
  final String? validity;
  final double providerCost;
  final double sellingPrice;
  final double profit;
  final bool isActive;

  factory DataPriceRow.fromJson(Map<String, dynamic> json) {
    return DataPriceRow(
      id: json['id']?.toString() ?? '',
      providerPlanId: json['provider_plan_id']?.toString() ?? '',
      network: json['network']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      planType: json['plan_type']?.toString(),
      validity: json['validity']?.toString(),
      providerCost: _num(json['provider_cost']),
      sellingPrice: _num(json['selling_price']),
      profit: _num(json['profit']),
      isActive: json['is_active'] == true,
    );
  }

  static double _num(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class ServicePriceRow {
  const ServicePriceRow({
    required this.service,
    required this.label,
    required this.providerCost,
    required this.sellingPrice,
    required this.isActive,
  });

  final String service;
  final String label;
  final double providerCost;
  final double? sellingPrice;
  final bool isActive;

  factory ServicePriceRow.fromJson(Map<String, dynamic> json) {
    return ServicePriceRow(
      service: json['service']?.toString() ?? '',
      label: json['label']?.toString() ?? json['service']?.toString() ?? '',
      providerCost: _num(json['provider_cost']),
      sellingPrice: json['selling_price'] == null
          ? null
          : _num(json['selling_price']),
      isActive: json['is_active'] == true,
    );
  }

  static double _num(dynamic value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class ProviderFundingAccount {
  const ProviderFundingAccount({
    required this.accountNumber,
    required this.accountName,
    required this.bankName,
  });

  final String accountNumber;
  final String accountName;
  final String bankName;

  factory ProviderFundingAccount.fromJson(Map<String, dynamic> json) {
    return ProviderFundingAccount(
      accountNumber: json['account_number']?.toString() ?? '',
      accountName: json['account_name']?.toString() ?? '',
      bankName: json['bank_name']?.toString() ?? '',
    );
  }
}

class ProviderBalanceBundle {
  const ProviderBalanceBundle({
    required this.rows,
    required this.fundingAccount,
  });

  final List<ProviderBalanceRow> rows;
  final ProviderFundingAccount fundingAccount;
}

class ProviderBalanceRow {
  const ProviderBalanceRow({
    required this.provider,
    required this.balance,
    required this.lastCheckedAt,
  });

  final String provider;
  final double balance;
  final DateTime lastCheckedAt;

  factory ProviderBalanceRow.fromJson(Map<String, dynamic> json) {
    return ProviderBalanceRow(
      provider: json['provider']?.toString() ?? '',
      balance:
          (json['balance'] as num?)?.toDouble() ??
          double.tryParse(json['balance']?.toString() ?? '') ??
          0,
      lastCheckedAt:
          DateTime.tryParse(json['last_checked_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class BroadcastEntity {
  const BroadcastEntity({
    required this.id,
    required this.title,
    required this.body,
    required this.audience,
    required this.recipientCount,
    required this.readCount,
    required this.sentBy,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final String audience;
  final int recipientCount;
  final int readCount;
  final String sentBy;
  final DateTime createdAt;

  factory BroadcastEntity.fromJson(Map<String, dynamic> json) {
    return BroadcastEntity(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      body: json['body']?.toString() ?? '',
      audience: json['audience']?.toString() ?? 'ALL_USERS',
      recipientCount:
          int.tryParse(json['recipient_count']?.toString() ?? '0') ?? 0,
      readCount: int.tryParse(json['read_count']?.toString() ?? '0') ?? 0,
      sentBy: json['sent_by']?.toString() ?? '',
      createdAt:
          DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
    );
  }
}

class AdminPricingRepository {
  const AdminPricingRepository(this._dio);

  final Dio _dio;

  Future<AdminUserSummary?> getAdminMe() async {
    try {
      final response = await _dio.get(AppEndpoints.adminMe);
      final data = response.data['data'] as Map<String, dynamic>? ?? {};
      final admin = data['admin'] as Map<String, dynamic>?;
      return admin == null ? null : AdminUserSummary.fromJson(admin);
    } on DioException {
      return null;
    }
  }

  Future<List<DataPriceRow>> getDataPrices(NetworkProvider network) async {
    final response = await _dio.get(
      AppEndpoints.adminDataPrices(network: network.code),
    );
    final list = (response.data['data'] ?? const []) as List<dynamic>;
    return list
        .map(
          (item) =>
              DataPriceRow.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<List<DataPriceRow>> syncDataPrices(NetworkProvider network) async {
    final response = await _dio.post(
      AppEndpoints.adminSyncDataPrices(network.code),
    );
    final list = (response.data['data'] ?? const []) as List<dynamic>;
    return list
        .map(
          (item) =>
              DataPriceRow.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<void> updatePrice({
    required String id,
    double? sellingPrice,
    bool? isActive,
    bool resetToDefault = false,
  }) async {
    await _dio.patch(
      AppEndpoints.adminDataPrice(id),
      data: {
        if (resetToDefault) 'selling_price': null,
        if (!resetToDefault && sellingPrice != null)
          'selling_price': sellingPrice,
        if (isActive != null) 'is_active': isActive,
      },
    );
  }

  Future<void> applyMarkup({
    required NetworkProvider network,
    required double markupNaira,
    required double markupPercent,
  }) async {
    await _dio.post(
      AppEndpoints.adminApplyDataMarkup,
      data: {
        'network': network.code,
        'markup_naira': markupNaira,
        'markup_percent': markupPercent,
      },
    );
  }

  Future<List<ServicePriceRow>> getServicePrices() async {
    final response = await _dio.get(AppEndpoints.adminServicePrices);
    final list = (response.data['data'] ?? const []) as List<dynamic>;
    return list
        .map(
          (item) =>
              ServicePriceRow.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<void> updateServicePriceRow({
    required String service,
    double? sellingPrice,
    double? providerCost,
    bool? isActive,
    bool resetToDefault = false,
  }) async {
    await _dio.patch(
      AppEndpoints.adminServicePrice(service),
      data: {
        if (resetToDefault) 'selling_price': null,
        if (!resetToDefault && sellingPrice != null)
          'selling_price': sellingPrice,
        if (providerCost != null) 'provider_cost': providerCost,
        if (isActive != null) 'is_active': isActive,
      },
    );
  }

  ProviderBalanceBundle _providerBalanceBundleFromResponse(Response response) {
    final body = response.data is Map<String, dynamic>
        ? response.data as Map<String, dynamic>
        : Map<String, dynamic>.from(response.data as Map);
    final list = (body['data'] ?? const []) as List<dynamic>;
    final funding = body['funding_account'] is Map
        ? ProviderFundingAccount.fromJson(
            Map<String, dynamic>.from(body['funding_account'] as Map),
          )
        : const ProviderFundingAccount(
            accountNumber: '6651219714',
            accountName: 'ALRAHUZDATA - IMAM-DATASUB',
            bankName: 'Palmpay Automated Bank Transfer',
          );
    return ProviderBalanceBundle(
      rows: list
          .map(
            (item) => ProviderBalanceRow.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      fundingAccount: funding,
    );
  }

  Future<ProviderBalanceBundle> getProviderBalances() async {
    final response = await _dio.get(AppEndpoints.adminProviderBalance);
    return _providerBalanceBundleFromResponse(response);
  }

  Future<ProviderBalanceBundle> refreshProviderBalance() async {
    final response = await _dio.post(AppEndpoints.adminRefreshProviderBalance);
    return _providerBalanceBundleFromResponse(response);
  }

  Future<CustomerActivityBundle> getCustomerActivity({int days = 30}) async {
    final response = await _dio.get(
      AppEndpoints.adminCustomerActivity(days: days),
    );
    return CustomerActivityBundle.fromJson(
      Map<String, dynamic>.from(response.data['data'] as Map),
    );
  }

  Future<List<BroadcastEntity>> getBroadcastHistory() async {
    final response = await _dio.get(AppEndpoints.adminNotificationBroadcast);
    final list = (response.data['data'] ?? const []) as List<dynamic>;
    return list
        .map(
          (item) =>
              BroadcastEntity.fromJson(Map<String, dynamic>.from(item as Map)),
        )
        .toList();
  }

  Future<int> sendBroadcast({
    required String title,
    required String body,
    String audience = 'ALL_USERS',
  }) async {
    final response = await _dio.post(
      AppEndpoints.adminNotificationBroadcast,
      data: {'title': title, 'body': body, 'audience': audience},
    );
    final data = response.data['data'] as Map<String, dynamic>? ?? {};
    return int.tryParse(data['recipient_count']?.toString() ?? '0') ?? 0;
  }
}
