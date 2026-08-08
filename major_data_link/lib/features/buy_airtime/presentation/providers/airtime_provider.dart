import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/di/injection.dart';
import '../../../buy_data/domain/entities/beneficiary_entity.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';
import '../../../buy_data/presentation/providers/buy_data_provider.dart'
    show beneficiaryLocalDataSourceProvider, selectedNetworkProvider;
import '../../data/datasources/airtime_remote_datasource.dart';
import '../../data/repositories/airtime_repository_impl.dart';

final airtimeRemoteDataSourceProvider =
    Provider<AirtimeRemoteDataSource>((ref) {
  return AirtimeRemoteDataSourceImpl(ref.read(dioClientProvider));
});

final airtimeRepositoryProvider = Provider<AirtimeRepository>((ref) {
  return AirtimeRepositoryImpl(
    remote: ref.read(airtimeRemoteDataSourceProvider),
    beneficiaryLocal: ref.read(beneficiaryLocalDataSourceProvider),
    networkInfo: ref.read(networkInfoProvider),
    hive: ref.read(hiveStorageProvider),
  );
});

final airtimeBeneficiariesProvider =
    FutureProvider.autoDispose<List<BeneficiaryEntity>>((ref) async {
  final repository = ref.read(airtimeRepositoryProvider);
  return repository.getBeneficiaries();
});

// Quick-pick amounts shown as chips
const List<double> kQuickAirtimeAmounts = [100, 200, 500, 1000, 2000, 5000];

class AirtimeState {
  const AirtimeState({
    this.amount = 0,
    this.phone = '',
    this.saveAsBeneficiary = false,
    this.isProcessing = false,
    this.errorMessage,
  });

  final double amount;
  final String phone;
  final bool saveAsBeneficiary;
  final bool isProcessing;
  final String? errorMessage;

  bool get canProceed => amount >= 50 && phone.length == 11;

  AirtimeState copyWith({
    double? amount,
    String? phone,
    bool? saveAsBeneficiary,
    bool? isProcessing,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AirtimeState(
      amount: amount ?? this.amount,
      phone: phone ?? this.phone,
      saveAsBeneficiary: saveAsBeneficiary ?? this.saveAsBeneficiary,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class AirtimeNotifier extends StateNotifier<AirtimeState> {
  AirtimeNotifier(this._ref) : super(const AirtimeState());
  final Ref _ref;

  void setAmount(double amount) =>
      state = state.copyWith(amount: amount, clearError: true);

  void setPhone(String phone) =>
      state = state.copyWith(phone: phone, clearError: true);

  void toggleSaveBeneficiary(bool value) =>
      state = state.copyWith(saveAsBeneficiary: value);

  void reset() => state = const AirtimeState();

  Future<AirtimePurchaseResult?> purchase(NetworkProvider network) async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);

    final repository = _ref.read(airtimeRepositoryProvider);
    final result = await repository.purchaseAirtime(
      network: network,
      phone: state.phone,
      amount: state.amount,
    );

    return result.fold(
      (failure) {
        state = state.copyWith(isProcessing: false, errorMessage: failure.message);
        return null;
      },
      (purchaseResult) async {
        if (purchaseResult.success && state.saveAsBeneficiary) {
          await repository.saveBeneficiary(phone: state.phone, network: network);
        }
        state = state.copyWith(isProcessing: false);
        return purchaseResult;
      },
    );
  }
}

final airtimeNotifierProvider =
    StateNotifierProvider.autoDispose<AirtimeNotifier, AirtimeState>((ref) {
  return AirtimeNotifier(ref);
});
