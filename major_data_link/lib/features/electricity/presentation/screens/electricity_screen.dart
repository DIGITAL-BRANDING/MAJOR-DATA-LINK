import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../providers/electricity_provider.dart';

class ElectricityScreen extends ConsumerStatefulWidget {
  const ElectricityScreen({super.key});

  @override
  ConsumerState<ElectricityScreen> createState() => _ElectricityScreenState();
}

class _ElectricityScreenState extends ConsumerState<ElectricityScreen> {
  final _meterController = TextEditingController();
  final _amountController = TextEditingController();

  @override
  void dispose() {
    _meterController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _handlePurchase() async {
    context.hideKeyboard();
    final state = ref.read(electricityNotifierProvider);
    final disco = ref.read(selectedDiscoProvider);

    if (!state.canProceed) return;

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _ConfirmSheet(
        disco: disco,
        meterNumber: state.meterNumber,
        meterType: state.meterType,
        customerName: state.validationResult?.customerName ?? '',
        amount: state.amount,
      ),
    );
    if (confirmed != true) return;

    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm electricity payment for $disco',
    );
    if (!pinVerified || !mounted) return;

    final result =
        await ref.read(electricityNotifierProvider.notifier).purchase(disco);
    if (!mounted) return;

    if (result != null && result['status'] == true) {
      final data = result['data'] as Map<String, dynamic>? ?? {};
      final token = data['token']?.toString();
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: '$disco Electricity',
            amount: state.amount,
            reference: data['reference']?.toString() ?? '',
            details: [
              MapEntry('Disco', disco),
              MapEntry('Meter number', state.meterNumber),
              MapEntry('Customer', state.validationResult?.customerName ?? ''),
              if (token != null) MapEntry('Token', token),
            ],
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(electricityNotifierProvider.notifier).reset();
              _meterController.clear();
              _amountController.clear();
            },
          ),
        ),
      );
    } else {
      context.showSnackBar(
        ref.read(electricityNotifierProvider).errorMessage ?? 'Payment failed',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final disco = ref.watch(selectedDiscoProvider);
    final state = ref.watch(electricityNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.electricity)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.screenPaddingH, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Select distribution company',
                  style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: disco,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: context.isDark
                      ? AppColors.darkSurfaceVariant
                      : AppColors.lightSurfaceVariant,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                items: AppConfig.electricityProviders
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) {
                    ref.read(selectedDiscoProvider.notifier).state = v;
                    ref.read(electricityNotifierProvider.notifier).reset();
                    _meterController.clear();
                  }
                },
              ),

              const SizedBox(height: 20),
              Text('Meter type', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              Row(
                children: MeterType.values.map((type) {
                  final isSelected = state.meterType == type;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () => ref
                          .read(electricityNotifierProvider.notifier)
                          .setMeterType(type),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? context.colors.primary
                              : AppColors.primary50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          type == MeterType.prepaid ? 'Prepaid' : 'Postpaid',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isSelected ? Colors.white : context.colors.primary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 20),
              Text('Meter number', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              KDTextField(
                controller: _meterController,
                hint: 'Enter meter number',
                prefixIcon: Icons.electric_meter_outlined,
                keyboardType: TextInputType.number,
                onChanged: (v) => ref
                    .read(electricityNotifierProvider.notifier)
                    .setMeterNumber(v),
                validator: AppValidators.meterNumber,
                suffixIcon: state.isValidating ? null : Icons.check_circle_outline,
                onSuffixTap: state.meterNumber.length >= 10
                    ? () => ref
                        .read(electricityNotifierProvider.notifier)
                        .validateMeter(disco)
                    : null,
              ),

              if (state.isValidating) ...[
                const SizedBox(height: 10),
                const Row(
                  children: [
                    SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                    SizedBox(width: 8),
                    Text('Validating meter...',
                        style: TextStyle(fontSize: 12, color: AppColors.neutral500)),
                  ],
                ),
              ],

              if (state.isValidated) ...[
                const SizedBox(height: 12),
                KDCard(
                  backgroundColor: AppColors.success50,
                  border: Border.all(color: AppColors.success100),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_rounded,
                          color: AppColors.success600, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              state.validationResult!.customerName,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.success700),
                            ),
                            if (state.validationResult!.address.isNotEmpty)
                              Text(
                                state.validationResult!.address,
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.success700),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (state.isValidated) ...[
                const SizedBox(height: 20),
                Text(AppStrings.amount, style: context.textTheme.titleSmall),
                const SizedBox(height: 10),
                KDAmountField(
                  controller: _amountController,
                  onChanged: (v) {
                    final parsed = double.tryParse(v) ?? 0;
                    ref
                        .read(electricityNotifierProvider.notifier)
                        .setAmount(parsed);
                  },
                  validator: (v) => AppValidators.amount(v, min: 500),
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
                            .read(electricityNotifierProvider.notifier)
                            .toggleSaveBeneficiary(v ?? false),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(AppStrings.saveBeneficiary,
                        style: context.textTheme.bodySmall),
                  ],
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

class _ConfirmSheet extends StatelessWidget {
  const _ConfirmSheet({
    required this.disco,
    required this.meterNumber,
    required this.meterType,
    required this.customerName,
    required this.amount,
  });

  final String disco;
  final String meterNumber;
  final MeterType meterType;
  final String customerName;
  final double amount;

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
          Text(AppStrings.purchaseDetails,
              style: context.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 20),
          _row(context, 'Disco', disco),
          _row(context, 'Meter type',
              meterType == MeterType.prepaid ? 'Prepaid' : 'Postpaid'),
          _row(context, 'Meter number', meterNumber),
          _row(context, 'Customer', customerName),
          const Divider(height: 28),
          _row(context, AppStrings.amount, AppFormatters.formatAmount(amount),
              isTotal: true),
          const SizedBox(height: 24),
          KDButton(
            label: AppStrings.proceed,
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

  Widget _row(BuildContext context, String label, String value,
      {bool isTotal = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: context.textTheme.bodyMedium
                  ?.copyWith(color: isTotal ? null : AppColors.neutral500)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: context.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: isTotal ? 18 : 14,
                color: isTotal ? context.colors.primary : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
