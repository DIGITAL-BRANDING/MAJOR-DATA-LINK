import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/network_selector.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../../../buy_data/domain/entities/beneficiary_entity.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';
import '../../../buy_data/presentation/providers/buy_data_provider.dart'
    show selectedNetworkProvider;
import '../../../wallet/presentation/providers/wallet_provider.dart';
import '../providers/airtime_provider.dart';

class BuyAirtimeScreen extends ConsumerStatefulWidget {
  const BuyAirtimeScreen({super.key});

  @override
  ConsumerState<BuyAirtimeScreen> createState() => _BuyAirtimeScreenState();
}

class _BuyAirtimeScreenState extends ConsumerState<BuyAirtimeScreen> {
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  void _onPhoneChanged(String value) {
    ref.read(airtimeNotifierProvider.notifier).setPhone(value);
    if (value.length >= 4) {
      final detected = NetworkProviderX.detectFromPhone(value);
      if (detected != null) {
        ref.read(selectedNetworkProvider.notifier).state = detected;
      }
    }
  }

  void _selectQuickAmount(double amount) {
    _amountController.text = amount.toStringAsFixed(0);
    ref.read(airtimeNotifierProvider.notifier).setAmount(amount);
  }

  Future<void> _showBeneficiarySheet() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AirtimeBeneficiarySheet(
        onSelect: (b) {
          _phoneController.text = b.value;
          ref.read(airtimeNotifierProvider.notifier).setPhone(b.value);
          if (b.network != null) {
            ref.read(selectedNetworkProvider.notifier).state =
                NetworkProviderX.fromCode(b.network!);
          }
        },
      ),
    );
  }

  Future<void> _handlePurchase() async {
    context.hideKeyboard();
    final state = ref.read(airtimeNotifierProvider);
    final network = ref.read(selectedNetworkProvider);

    if (!state.canProceed) {
      context.showSnackBar('Enter a valid phone number and amount',
          isError: true);
      return;
    }

    final walletBalance =
        ref.read(walletNotifierProvider).valueOrNull?.totalBalance ?? 0;
    if (walletBalance < state.amount) {
      context.showSnackBar(AppStrings.insufficientBalance, isError: true);
      return;
    }

    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm airtime purchase of ${AppFormatters.formatAmount(state.amount)} for ${_phoneController.text}',
    );
    if (!pinVerified || !mounted) return;

    final result =
        await ref.read(airtimeNotifierProvider.notifier).purchase(network);

    if (!mounted) return;

    if (result != null && result.success) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: '${network.label} Airtime',
            amount: state.amount,
            reference: result.reference,
            balanceAfter: result.balanceAfter,
            details: [
              MapEntry('Network', network.label),
              MapEntry(
                  'Phone', AppFormatters.formatPhone(_phoneController.text)),
            ],
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(airtimeNotifierProvider.notifier).reset();
              _phoneController.clear();
              _amountController.clear();
            },
          ),
        ),
      );
    } else {
      final error = ref.read(airtimeNotifierProvider).errorMessage;
      context.showSnackBar(error ?? 'Purchase failed. Please try again.',
          isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final network = ref.watch(selectedNetworkProvider);
    final state = ref.watch(airtimeNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.buyAirtime)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 12),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH),
                child: Text(AppStrings.selectNetwork,
                    style: context.textTheme.titleSmall),
              ),
              const SizedBox(height: 10),
              NetworkSelector(
                selected: network,
                onChanged: (n) =>
                    ref.read(selectedNetworkProvider.notifier).state = n,
              ),

              const SizedBox(height: 24),

              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(AppStrings.enterPhoneNumber,
                            style: context.textTheme.titleSmall),
                        GestureDetector(
                          onTap: _showBeneficiarySheet,
                          child: Row(
                            children: [
                              Icon(Icons.people_outline_rounded,
                                  size: 16, color: context.colors.primary),
                              const SizedBox(width: 4),
                              Text(
                                'Beneficiaries',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: context.colors.primary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    KDPhoneField(
                      controller: _phoneController,
                      onChanged: _onPhoneChanged,
                      validator: AppValidators.phone,
                    ),

                    const SizedBox(height: 24),

                    Text(AppStrings.amount, style: context.textTheme.titleSmall),
                    const SizedBox(height: 10),
                    KDAmountField(
                      controller: _amountController,
                      onChanged: (v) {
                        final parsed = double.tryParse(v) ?? 0;
                        ref
                            .read(airtimeNotifierProvider.notifier)
                            .setAmount(parsed);
                      },
                      validator: (v) => AppValidators.amount(v, min: 50),
                    ),

                    const SizedBox(height: 12),

                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: kQuickAirtimeAmounts.map((amount) {
                        final isSelected = state.amount == amount;
                        return GestureDetector(
                          onTap: () => _selectQuickAmount(amount),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 9),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? context.colors.primary
                                  : AppColors.primary50,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              AppFormatters.formatAmount(amount),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? Colors.white
                                    : context.colors.primary,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),

                    const SizedBox(height: 16),

                    Row(
                      children: [
                        SizedBox(
                          width: 22,
                          height: 22,
                          child: Checkbox(
                            value: state.saveAsBeneficiary,
                            onChanged: (v) => ref
                                .read(airtimeNotifierProvider.notifier)
                                .toggleSaveBeneficiary(v ?? false),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(AppStrings.saveBeneficiary,
                            style: context.textTheme.bodySmall),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: KDButton(
            label: state.amount > 0
                ? 'Pay ${AppFormatters.formatAmount(state.amount)}'
                : AppStrings.proceed,
            onPressed: state.canProceed ? _handlePurchase : null,
            isLoading: state.isProcessing,
            gradient: AppColors.primaryGradient,
          ),
        ),
      ),
    );
  }
}

class _AirtimeBeneficiarySheet extends ConsumerWidget {
  const _AirtimeBeneficiarySheet({required this.onSelect});
  final void Function(BeneficiaryEntity) onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final beneficiariesAsync = ref.watch(airtimeBeneficiariesProvider);

    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.7),
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: AppColors.neutral300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),
          Text(AppStrings.beneficiaries,
              style: context.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          Flexible(
            child: beneficiariesAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (beneficiaries) {
                if (beneficiaries.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Text('No saved beneficiaries yet'),
                  );
                }
                return ListView.separated(
                  shrinkWrap: true,
                  itemCount: beneficiaries.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final b = beneficiaries[index];
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const CircleAvatar(
                        backgroundColor: AppColors.primary100,
                        child: Icon(Icons.phone_android_rounded,
                            color: AppColors.primary700, size: 18),
                      ),
                      title: Text(AppFormatters.formatPhone(b.value)),
                      subtitle: b.network != null ? Text(b.network!) : null,
                      onTap: () {
                        onSelect(b);
                        Navigator.of(context).pop();
                      },
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
