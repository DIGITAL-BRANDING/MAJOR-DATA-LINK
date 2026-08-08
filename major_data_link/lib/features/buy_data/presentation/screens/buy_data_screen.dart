import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/data_plan_card.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/network_selector.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../../../wallet/presentation/providers/wallet_provider.dart';
import '../../data/datasources/buy_data_remote_datasource.dart'
    show DataTypeOption;
import '../../domain/entities/beneficiary_entity.dart';
import '../../domain/entities/data_plan_entity.dart';
import '../providers/buy_data_provider.dart';

class BuyDataScreen extends ConsumerStatefulWidget {
  const BuyDataScreen({super.key});

  @override
  ConsumerState<BuyDataScreen> createState() => _BuyDataScreenState();
}

class _BuyDataScreenState extends ConsumerState<BuyDataScreen> {
  final _phoneController = TextEditingController();
  final _phoneFocusNode = FocusNode();

  @override
  void dispose() {
    _phoneController.dispose();
    _phoneFocusNode.dispose();
    super.dispose();
  }

  void _onPhoneChanged(String value) {
    ref.read(buyDataNotifierProvider.notifier).setPhone(value);

    // Auto-detect network from phone prefix
    if (value.length >= 4) {
      final detected = NetworkProviderX.detectFromPhone(value);
      if (detected != null) {
        ref.read(selectedNetworkProvider.notifier).state = detected;
      }
    }
  }

  void _selectBeneficiary(BeneficiaryEntity beneficiary) {
    _phoneController.text = beneficiary.value;
    ref.read(buyDataNotifierProvider.notifier).setPhone(beneficiary.value);
    if (beneficiary.network != null) {
      ref.read(selectedNetworkProvider.notifier).state =
          NetworkProviderX.fromCode(beneficiary.network!);
    }
  }

  Future<void> _showDataTypeSheet(NetworkProvider network) async {
    final typesAsync = ref.read(dataTypesProvider(network));
    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _DataTypeSheet(
        network: network,
        initialTypes: typesAsync.valueOrNull,
      ),
    );
    if (selected != null) {
      ref.read(selectedCategoryProvider.notifier).state = selected;
      ref.read(buyDataNotifierProvider.notifier).clearSelectedPlan();
    }
  }

  Future<void> _showBeneficiarySheet() async {
    final beneficiariesAsync = ref.read(dataBeneficiariesProvider);
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _BeneficiarySheet(onSelect: _selectBeneficiary),
    );
  }

  Future<void> _handlePurchase() async {
    context.hideKeyboard();
    final state = ref.read(buyDataNotifierProvider);
    final network = ref.read(selectedNetworkProvider);

    if (!state.canProceed) {
      context.showSnackBar('Please select a plan and enter a phone number',
          isError: true);
      return;
    }

    final walletBalance =
        ref.read(walletNotifierProvider).valueOrNull?.totalBalance ?? 0;

    if (walletBalance < state.selectedPlan!.price) {
      context.showSnackBar(AppStrings.insufficientBalance, isError: true);
      return;
    }

    // Show confirmation bottom sheet with details first
    final confirmed = await _showConfirmSheet(state.selectedPlan!, network);
    if (confirmed != true) return;

    // PIN confirmation
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm purchase of ${state.selectedPlan!.size} for ${_phoneController.text}',
    );
    if (!pinVerified || !mounted) return;

    final result =
        await ref.read(buyDataNotifierProvider.notifier).purchase(network);

    if (!mounted) return;

    if (result != null && result.success) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: '${network.label} ${state.selectedPlan!.size} Data',
            amount: state.selectedPlan!.price,
            reference: result.reference,
            balanceAfter: result.balanceAfter,
            details: [
              MapEntry('Network', network.label),
              MapEntry('Plan', state.selectedPlan!.size),
              MapEntry('Phone', AppFormatters.formatPhone(_phoneController.text)),
            ],
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(buyDataNotifierProvider.notifier).reset();
              _phoneController.clear();
            },
          ),
        ),
      );
    } else {
      final error = ref.read(buyDataNotifierProvider).errorMessage;
      context.showSnackBar(
        error ?? 'Purchase failed. Please try again.',
        isError: true,
      );
    }
  }

  Future<bool?> _showConfirmSheet(
    DataPlanEntity plan,
    NetworkProvider network,
  ) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => Padding(
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
            Text(
              AppStrings.purchaseDetails,
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 20),
            _DetailRow(label: AppStrings.network, value: network.label),
            _DetailRow(label: AppStrings.plan, value: plan.size),
            _DetailRow(label: 'Validity', value: plan.validity),
            _DetailRow(
              label: AppStrings.phone,
              value: _phoneController.text,
            ),
            const Divider(height: 28),
            _DetailRow(
              label: AppStrings.amount,
              value: AppFormatters.formatAmount(plan.price),
              isTotal: true,
            ),
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
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final network = ref.watch(selectedNetworkProvider);
    final category = ref.watch(selectedCategoryProvider);
    final plansAsync = category == null
        ? const AsyncValue<List<DataPlanEntity>>.loading()
        : ref.watch(
            dataPlansProvider((network: network, category: category)));
    final buyState = ref.watch(buyDataNotifierProvider);

    // Default to the first available Data Type once the list loads for this
    // network (mirrors Alrahuz defaulting to a preselected category).
    ref.listen(dataTypesProvider(network), (prev, next) {
      next.whenData((types) {
        if (types.isNotEmpty && ref.read(selectedCategoryProvider) == null) {
          ref.read(selectedCategoryProvider.notifier).state =
              types.first.category;
        }
      });
    });

    // Clear the selected plan if the network changes - a plan from the old
    // network's catalog no longer applies.
    ref.listen(selectedNetworkProvider, (prev, next) {
      if (prev != null && prev != next) {
        ref.read(buyDataNotifierProvider.notifier).clearSelectedPlan();
      }
    });

    // Sync phone field with provider on external updates (e.g. beneficiary pick)
    ref.listen(buyDataNotifierProvider, (prev, next) {
      if (next.phone != _phoneController.text) {
        _phoneController.value = _phoneController.value.copyWith(
          text: next.phone,
        );
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.buyData)),
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
                child: Text(
                  AppStrings.selectNetwork,
                  style: context.textTheme.titleSmall,
                ),
              ),
              const SizedBox(height: 10),
              NetworkSelector(
                selected: network,
                onChanged: (n) =>
                    ref.read(selectedNetworkProvider.notifier).state = n,
              ),

              const SizedBox(height: 20),

              // ── Phone Number ──────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          AppStrings.enterPhoneNumber,
                          style: context.textTheme.titleSmall,
                        ),
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
                      focusNode: _phoneFocusNode,
                      onChanged: _onPhoneChanged,
                      validator: AppValidators.phone,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        SizedBox(
                          width: 22,
                          height: 22,
                          child: Checkbox(
                            value: buyState.saveAsBeneficiary,
                            onChanged: (v) => ref
                                .read(buyDataNotifierProvider.notifier)
                                .toggleSaveBeneficiary(v ?? false),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          AppStrings.saveBeneficiary,
                          style: context.textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ── Data Type ──────────────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Data Types', style: context.textTheme.titleSmall),
                    const SizedBox(height: 10),
                    InkWell(
                      onTap: () => _showDataTypeSheet(network),
                      borderRadius: BorderRadius.circular(AppDimensions.radiusMD),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: category != null
                                ? context.colors.primary
                                : AppColors.neutral300,
                          ),
                          borderRadius:
                              BorderRadius.circular(AppDimensions.radiusMD),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              category ?? 'Select data type',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: category != null
                                    ? FontWeight.w600
                                    : FontWeight.w400,
                                color: category != null
                                    ? null
                                    : AppColors.neutral500,
                              ),
                            ),
                            const Icon(Icons.keyboard_arrow_down_rounded),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ── Data Plans Grid ───────────────────────────
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH),
                child: Text(
                  AppStrings.selectPlan,
                  style: context.textTheme.titleSmall,
                ),
              ),
              const SizedBox(height: 10),
              Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppDimensions.screenPaddingH),
                child: plansAsync.when(
                  loading: () => const DataPlanShimmer(itemCount: 6),
                  error: (error, _) => KDErrorState(
                    message: 'Failed to load data plans',
                    onRetry: () => category != null
                        ? ref.invalidate(dataPlansProvider(
                            (network: network, category: category)))
                        : ref.invalidate(dataTypesProvider(network)),
                  ),
                  data: (plans) {
                    if (plans.isEmpty) {
                      return const KDEmptyState(
                        title: 'No plans available',
                        message: 'Please check back later for this network.',
                        icon: Icons.wifi_off_rounded,
                      );
                    }
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        // 1.5 was too tight: on narrower phones (~360dp wide)
                        // the resulting cell height (~103px) was shorter than
                        // DataPlanCard's actual content (~112px+ once the
                        // description wraps to 2 lines and/or the discount
                        // badge is present), causing a bottom RenderFlex
                        // overflow on every card in the grid. 1.3 gives
                        // enough headroom on small screens while still
                        // looking compact on larger ones.
                        childAspectRatio: 1.3,
                      ),
                      itemCount: plans.length,
                      itemBuilder: (context, index) {
                        final plan = plans[index];
                        return DataPlanCard(
                          plan: plan,
                          isSelected: buyState.selectedPlan?.id == plan.id,
                          onTap: () => ref
                              .read(buyDataNotifierProvider.notifier)
                              .selectPlan(plan),
                        )
                            .animate(delay: Duration(milliseconds: index * 30))
                            .fadeIn(duration: 250.ms)
                            .scale(begin: const Offset(0.95, 0.95));
                      },
                    );
                  },
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
            label: buyState.selectedPlan != null
                ? 'Pay ${AppFormatters.formatAmount(buyState.selectedPlan!.price)}'
                : AppStrings.proceed,
            onPressed: buyState.canProceed ? _handlePurchase : null,
            isLoading: buyState.isProcessing,
            gradient: AppColors.primaryGradient,
          ),
        ),
      ),
    );
  }
}

// ── Data Type picker bottom sheet (mirrors Alrahuz's own UI) ─────────
class _DataTypeSheet extends ConsumerWidget {
  const _DataTypeSheet({required this.network, this.initialTypes});

  final NetworkProvider network;
  final List<DataTypeOption>? initialTypes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final typesAsync = ref.watch(dataTypesProvider(network));

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.neutral300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Select Data Type',
            textAlign: TextAlign.center,
            style: context.textTheme.titleLarge?.copyWith(
              color: AppColors.neutral500,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Flexible(
            child: typesAsync.when(
              loading: () => initialTypes != null
                  ? _typeList(context, initialTypes!)
                  : const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()),
                    ),
              error: (_, __) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: KDErrorState(
                  message: 'Could not load data types',
                  onRetry: () => ref.invalidate(dataTypesProvider(network)),
                ),
              ),
              data: (types) {
                if (types.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: KDEmptyState(
                      title: 'No data types available',
                      message: 'Please check back later for this network.',
                      icon: Icons.category_outlined,
                    ),
                  );
                }
                return _typeList(context, types);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _typeList(BuildContext context, List<DataTypeOption> types) {
    return ListView.separated(
      shrinkWrap: true,
      itemCount: types.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final type = types[index];
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            type.category,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
          ),
          trailing: const Icon(Icons.chevron_right_rounded),
          onTap: () => Navigator.of(context).pop(type.category),
        );
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isTotal = false,
  });

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
          Text(
            label,
            style: context.textTheme.bodyMedium?.copyWith(
              color: isTotal ? null : AppColors.neutral500,
              fontWeight: isTotal ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
          Text(
            value,
            style: context.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: isTotal ? 18 : 14,
              color: isTotal ? context.colors.primary : null,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Beneficiary picker bottom sheet ───────────────────────
class _BeneficiarySheet extends ConsumerWidget {
  const _BeneficiarySheet({required this.onSelect});
  final void Function(BeneficiaryEntity) onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final beneficiariesAsync = ref.watch(dataBeneficiariesProvider);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.7,
      ),
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
          Text(
            AppStrings.beneficiaries,
            style: context.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
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
                    child: KDEmptyState(
                      title: 'No saved beneficiaries',
                      message:
                          'Numbers you save during purchase will appear here.',
                      icon: Icons.people_outline_rounded,
                    ),
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
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primary100,
                        child: Text(
                          b.value.isNotEmpty ? b.value.substring(0, 2) : '',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary700,
                          ),
                        ),
                      ),
                      title: Text(
                        AppFormatters.formatPhone(b.value),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle:
                          b.network != null ? Text(b.network!) : null,
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
