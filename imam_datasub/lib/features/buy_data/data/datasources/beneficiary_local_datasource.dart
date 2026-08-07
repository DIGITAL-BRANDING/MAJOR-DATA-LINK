import 'package:uuid/uuid.dart';
import '../../../../core/storage/hive_storage.dart';
import '../../domain/entities/beneficiary_entity.dart';

abstract class BeneficiaryLocalDataSource {
  Future<List<BeneficiaryEntity>> getBeneficiaries(BeneficiaryType type);
  Future<void> saveBeneficiary(BeneficiaryEntity beneficiary);
  Future<void> deleteBeneficiary(String id);
}

class BeneficiaryLocalDataSourceImpl implements BeneficiaryLocalDataSource {
  BeneficiaryLocalDataSourceImpl(this._hive);
  final HiveStorage _hive;

  static const _uuid = Uuid();

  @override
  Future<List<BeneficiaryEntity>> getBeneficiaries(
    BeneficiaryType type,
  ) async {
    final box = _hive.userBox; // reuse user box namespace via prefix keys
    final raw = box.get('beneficiaries_${type.name}') as List<dynamic>?;
    if (raw == null) return [];
    return raw
        .map((e) =>
            BeneficiaryEntity.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList()
      ..sort((a, b) => (b.createdAt ?? DateTime(0))
          .compareTo(a.createdAt ?? DateTime(0)));
  }

  @override
  Future<void> saveBeneficiary(BeneficiaryEntity beneficiary) async {
    final box = _hive.userBox;
    final key = 'beneficiaries_${beneficiary.type.name}';
    final existing = box.get(key) as List<dynamic>? ?? [];

    final list = existing
        .map((e) =>
            BeneficiaryEntity.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();

    // Avoid duplicates by value
    list.removeWhere((b) => b.value == beneficiary.value);

    final toSave = BeneficiaryEntity(
      id: beneficiary.id.isEmpty ? _uuid.v4() : beneficiary.id,
      type: beneficiary.type,
      value: beneficiary.value,
      label: beneficiary.label,
      network: beneficiary.network,
      provider: beneficiary.provider,
      createdAt: DateTime.now(),
    );

    list.insert(0, toSave);

    // Cap at 20 most recent
    final capped = list.take(20).toList();
    await box.put(key, capped.map((b) => b.toJson()).toList());
  }

  @override
  Future<void> deleteBeneficiary(String id) async {
    for (final type in BeneficiaryType.values) {
      final box = _hive.userBox;
      final key = 'beneficiaries_${type.name}';
      final existing = box.get(key) as List<dynamic>? ?? [];
      final list = existing
          .map((e) =>
              BeneficiaryEntity.fromJson(Map<String, dynamic>.from(e as Map)))
          .where((b) => b.id != id)
          .toList();
      await box.put(key, list.map((b) => b.toJson()).toList());
    }
  }
}
