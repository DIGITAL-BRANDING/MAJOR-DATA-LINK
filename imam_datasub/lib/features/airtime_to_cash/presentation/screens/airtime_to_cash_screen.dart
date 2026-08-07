import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/network_selector.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';
import '../../../buy_data/presentation/providers/buy_data_provider.dart'
    show selectedNetworkProvider;
import '../providers/atc_provider.dart';

class AirtimeToCashScreen extends ConsumerStatefulWidget {
  const AirtimeToCashScreen({super.key});

  @override
  ConsumerState<AirtimeToCashScreen> createState() =>
      _AirtimeToCashScreenState();
}

class _AirtimeToCashScreenState extends ConsumerState<AirtimeToCashScreen> {
  final _phoneController = TextEditingController();
  final _amountController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    context.hideKeyboard();
    final state = ref.read(atcNotifierProvider);
    final network = ref.read(selectedNetworkProvider);

    if (!state.canProceed) {
      context.showSnackBar('Enter a valid phone number and amount',
          isError: true);
      return;
    }

    final rate = ref.read(atcRateProvider);
    final payout = state.amount * rate;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ConfirmAtcSheet(
        network: network,
        airtimeAmount: state.amount,
        payoutAmount: payout,
        phone: _phoneController.text,
      ),
    );
    if (confirmed != true) return;

    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm airtime-to-cash conversion',
    );
    if (!pinVerified || !mounted) return;

    final result = await ref.read(atcNotifierProvider.notifier).submit(network);
    if (!mounted) return;

    if (result != null && result.success) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: 'Airtime to Cash',
            amount: result.payoutAmount ?? payout,
            reference: result.reference,
            details: [
              MapEntry('Network', network.label),
              MapEntry('Airtime amount',
                  AppFormatters.formatAmount(state.amount)),
              MapEntry(
                  'Phone', AppFormatters.formatPhone(_phoneController.text)),
            ],
          ),
        ),
      );
    } else {
      final error = ref.read(atcNotifierProvider).errorMessage;
      context.showSnackBar(error ?? 'Request failed. Please try again.',
          isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final network = ref.watch(selectedNetworkProvider);
    final state = ref.watch(atcNotifierProvider);
    final rate = ref.watch(atcRateProvider);
    final payout = state.amount * rate;

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.airtimeToCash)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.screenPaddingH, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KDCard(
                backgroundColor: AppColors.warning50,
                border: Border.all(color: AppColors.warning100),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        color: AppColors.warning600, size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'You receive ${(rate * 100).toStringAsFixed(0)}% of the airtime value as cash. Processing takes up to 30 minutes.',
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.warning700),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),
              Text(AppStrings.selectNetwork,
                  style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              NetworkSelector(
                selected: network,
                onChanged: (n) =>
                    ref.read(selectedNetworkProvider.notifier).state = n,
              ),

              const SizedBox(height: 24),
              Text(AppStrings.enterPhoneNumber,
                  style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              KDPhoneField(
                controller: _phoneController,
                onChanged: (v) =>
                    ref.read(atcNotifierProvider.notifier).setPhone(v),
                validator: AppValidators.phone,
              ),

              const SizedBox(height: 20),
              Text('Airtime amount', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              KDAmountField(
                controller: _amountController,
                onChanged: (v) {
                  final parsed = double.tryParse(v) ?? 0;
                  ref.read(atcNotifierProvider.notifier).setAmount(parsed);
                },
                validator: (v) => AppValidators.amount(v, min: 100),
              ),

              if (state.amount > 0) ...[
                const SizedBox(height: 16),
                KDCard(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('You will receive',
                          style: context.textTheme.bodyMedium),
                      Text(
                        AppFormatters.formatAmount(payout),
                        style: context.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.success600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: KDButton(
            label: AppStrings.proceed,
            onPressed: state.canProceed ? _handleSubmit : null,
            isLoading: state.isProcessing,
            gradient: AppColors.primaryGradient,
          ),
        ),
      ),
    );
  }
}

class _ConfirmAtcSheet extends StatelessWidget {
  const _ConfirmAtcSheet({
    required this.network,
    required this.airtimeAmount,
    required this.payoutAmount,
    required this.phone,
  });

  final NetworkProvider network;
  final double airtimeAmount;
  final double payoutAmount;
  final String phone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        8,
        24,
        32 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
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
          const SizedBox(height: 20),
          Text('Confirm conversion',
              style: context.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 20),
          _Row('Network', network.label),
          _Row('Phone', AppFormatters.formatPhone(phone)),
          _Row('Airtime amount', AppFormatters.formatAmount(airtimeAmount)),
          const Divider(height: 28),
          _Row('You receive', AppFormatters.formatAmount(payoutAmount),
              isTotal: true),
          const SizedBox(height: 24),
          KDButton(
            label: AppStrings.confirm,
            onPressed: () => Navigator.of(context).pop(true),
            gradient: AppColors.primaryGradient,
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text(AppStrings.cancel),
          ),
        ],
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.isTotal = false});
  final String label;
  final String value;
  final bool isTotal;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: context.textTheme.bodyMedium
                  ?.copyWith(color: isTotal ? null : AppColors.neutral500)),
          Text(
            value,
            style: context.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: isTotal ? 18 : 14,
              color: isTotal ? AppColors.success600 : null,
            ),
          ),
        ],
      ),
    );
  }
}
