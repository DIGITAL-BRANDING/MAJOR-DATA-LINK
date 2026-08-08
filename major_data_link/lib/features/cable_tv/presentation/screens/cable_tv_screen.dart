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
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../providers/cable_provider.dart';

class CableTvScreen extends ConsumerStatefulWidget {
  const CableTvScreen({super.key});

  @override
  ConsumerState<CableTvScreen> createState() => _CableTvScreenState();
}

class _CableTvScreenState extends ConsumerState<CableTvScreen> {
  final _smartcardController = TextEditingController();

  @override
  void dispose() {
    _smartcardController.dispose();
    super.dispose();
  }

  Future<void> _handleSubscribe() async {
    context.hideKeyboard();
    final state = ref.read(cableNotifierProvider);
    final provider = ref.read(selectedCableProviderProvider);

    if (!state.canProceed) return;

    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm ${provider.label} subscription for ${state.validationResult?.customerName ?? ""}',
    );
    if (!pinVerified || !mounted) return;

    final result =
        await ref.read(cableNotifierProvider.notifier).subscribe(provider);
    if (!mounted) return;

    if (result != null && result['status'] == true) {
      final data = result['data'] as Map<String, dynamic>? ?? {};
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: '${provider.label} Subscription',
            amount: state.selectedPlan!.price,
            reference: data['reference']?.toString() ?? '',
            details: [
              MapEntry('Provider', provider.label),
              MapEntry('Plan', state.selectedPlan!.name),
              MapEntry('Smartcard', state.smartcardNumber),
              MapEntry('Customer', state.validationResult?.customerName ?? ''),
            ],
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(cableNotifierProvider.notifier).reset();
              _smartcardController.clear();
            },
          ),
        ),
      );
    } else {
      context.showSnackBar(
        ref.read(cableNotifierProvider).errorMessage ?? 'Subscription failed',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = ref.watch(selectedCableProviderProvider);
    final state = ref.watch(cableNotifierProvider);
    final plansAsync = ref.watch(cablePlansProvider(provider));

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.cableTv)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
              horizontal: AppDimensions.screenPaddingH, vertical: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Select provider', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              Row(
                children: CableProviderType.values.map((p) {
                  final isSelected = p == provider;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () {
                        ref.read(selectedCableProviderProvider.notifier).state = p;
                        ref.read(cableNotifierProvider.notifier).reset();
                        _smartcardController.clear();
                      },
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? context.colors.primary
                              : AppColors.primary50,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          p.label,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            color: isSelected ? Colors.white : context.colors.primary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),

              const SizedBox(height: 24),
              Text('Smartcard number', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              KDTextField(
                controller: _smartcardController,
                hint: 'Enter smartcard / IUC number',
                prefixIcon: Icons.confirmation_number_outlined,
                keyboardType: TextInputType.number,
                onChanged: (v) =>
                    ref.read(cableNotifierProvider.notifier).setSmartcard(v),
                validator: AppValidators.smartcard,
                suffixIcon: state.isValidating ? null : Icons.check_circle_outline,
                onSuffixTap: state.smartcardNumber.length >= 9
                    ? () => ref
                        .read(cableNotifierProvider.notifier)
                        .validateSmartcard(provider)
                    : null,
              ),

              if (state.isValidating) ...[
                const SizedBox(height: 10),
                const Row(
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    SizedBox(width: 8),
                    Text('Validating smartcard...',
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
                        child: Text(
                          state.validationResult!.customerName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.success700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (!state.isValidating &&
                  state.validationResult != null &&
                  !state.isValidated) ...[
                const SizedBox(height: 12),
                KDCard(
                  backgroundColor: AppColors.error50,
                  border: Border.all(color: AppColors.error100),
                  child: const Row(
                    children: [
                      Icon(Icons.error_outline_rounded,
                          color: AppColors.error600, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Invalid smartcard number',
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.error700),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (state.isValidated) ...[
                const SizedBox(height: 24),
                Text(AppStrings.selectPlan, style: context.textTheme.titleSmall),
                const SizedBox(height: 10),
                plansAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                  error: (_, __) => KDErrorState(
                    message: 'Failed to load plans',
                    onRetry: () => ref.invalidate(cablePlansProvider(provider)),
                  ),
                  data: (plans) => Column(
                    children: plans
                        .map((plan) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: GestureDetector(
                                onTap: () => ref
                                    .read(cableNotifierProvider.notifier)
                                    .selectPlan(plan),
                                child: KDCard(
                                  backgroundColor:
                                      state.selectedPlan?.id == plan.id
                                          ? AppColors.primary50
                                          : null,
                                  border: state.selectedPlan?.id == plan.id
                                      ? Border.all(color: context.colors.primary)
                                      : null,
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(plan.name,
                                                style: const TextStyle(
                                                    fontWeight: FontWeight.w700)),
                                            Text(plan.validity,
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    color: AppColors.neutral500)),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        AppFormatters.formatAmount(plan.price),
                                        style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          color: context.colors.primary,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ))
                        .toList(),
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
            label: state.selectedPlan != null
                ? 'Pay ${AppFormatters.formatAmount(state.selectedPlan!.price)}'
                : AppStrings.proceed,
            onPressed: state.canProceed ? _handleSubscribe : null,
            isLoading: state.isProcessing,
            gradient: AppColors.primaryGradient,
          ),
        ),
      ),
    );
  }
}
