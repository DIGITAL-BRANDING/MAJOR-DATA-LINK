import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../providers/result_checker_provider.dart';

// ── Generic result checker screen ─────────────────────────
class ResultCheckerScreen extends ConsumerWidget {
  const ResultCheckerScreen({
    super.key,
    required this.examType,
    required this.notifierProvider,
  });

  final ExamType examType;
  final AutoDisposeStateNotifierProvider<ResultCheckerNotifier, ResultCheckerState>
      notifierProvider;

  Future<void> _handlePurchase(
    BuildContext context,
    WidgetRef ref,
    ResultCheckerState state,
  ) async {
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm purchase of ${state.quantity} ${examType.label} scratch card(s)',
    );
    if (!pinVerified || !context.mounted) return;

    final result = await ref.read(notifierProvider.notifier).purchasePin();
    if (!context.mounted) return;

    if (result != null && result.success) {
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: '${examType.label} Result Checker',
            amount: state.totalAmount,
            reference: result.reference,
            details: [
              MapEntry('Exam', examType.label),
              MapEntry('Quantity', '${state.quantity}'),
              if (result.pin != null) MapEntry('PIN', result.pin!),
              if (result.serial != null) MapEntry('Serial', result.serial!),
            ],
            balanceAfter: result.balanceAfter,
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(notifierProvider.notifier).reset();
            },
          ),
        ),
      );
    } else {
      context.showSnackBar(
        ref.read(notifierProvider).errorMessage ?? 'Purchase failed',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notifierProvider);

    return Scaffold(
      appBar: AppBar(title: Text('${examType.label} Result Checker')),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Info card ──────────────────────────────────
              KDCard(
                backgroundColor: AppColors.primary50,
                border: Border.all(color: AppColors.primary100),
                child: Row(
                  children: [
                    Icon(Icons.school_rounded,
                        color: context.colors.primary, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            examType.label,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: context.colors.primary,
                            ),
                          ),
                          Text(
                            examType.fullName,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.neutral500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              Text('Number of scratch cards',
                  style: context.textTheme.titleSmall),
              const SizedBox(height: 12),

              // ── Quantity selector ─────────────────────────
              Row(
                children: [
                  _QtyButton(
                    icon: Icons.remove_rounded,
                    onTap: () => ref
                        .read(notifierProvider.notifier)
                        .setQuantity(state.quantity - 1),
                    enabled: state.quantity > 1,
                  ),
                  const SizedBox(width: 20),
                  Container(
                    width: 60,
                    height: 52,
                    decoration: BoxDecoration(
                      color: context.isDark
                          ? AppColors.darkSurfaceVariant
                          : AppColors.lightSurfaceVariant,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        '${state.quantity}',
                        style: context.textTheme.headlineSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  _QtyButton(
                    icon: Icons.add_rounded,
                    onTap: () => ref
                        .read(notifierProvider.notifier)
                        .setQuantity(state.quantity + 1),
                    enabled: state.quantity < 10,
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // ── Price summary ─────────────────────────────
              KDCard(
                child: Column(
                  children: [
                    _PriceRow(
                      label: 'Unit price',
                      value: AppFormatters.formatAmount(state.unitPrice),
                    ),
                    _PriceRow(
                      label: 'Quantity',
                      value: '× ${state.quantity}',
                    ),
                    const Divider(height: 20),
                    _PriceRow(
                      label: 'Total',
                      value: AppFormatters.formatAmount(state.totalAmount),
                      isTotal: true,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              KDCard(
                backgroundColor: AppColors.warning50,
                border: Border.all(color: AppColors.warning100),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        color: AppColors.warning600, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'PIN(s) will be delivered to your wallet notification. Keep them safe — they cannot be reissued.',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.warning700),
                      ),
                    ),
                  ],
                ),
              ),

              const Spacer(),

              KDButton(
                label:
                    'Pay ${AppFormatters.formatAmount(state.totalAmount)}',
                onPressed: () => _handlePurchase(context, ref, state),
                isLoading: state.isProcessing,
                gradient: AppColors.primaryGradient,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _QtyButton extends StatelessWidget {
  const _QtyButton({
    required this.icon,
    required this.onTap,
    required this.enabled,
  });
  final IconData icon;
  final VoidCallback onTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: enabled ? context.colors.primary : AppColors.neutral200,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon,
            color: enabled ? Colors.white : AppColors.neutral400, size: 20),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
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
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: context.textTheme.bodyMedium?.copyWith(
              color: isTotal ? null : AppColors.neutral500,
              fontWeight: isTotal ? FontWeight.w700 : null,
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

// ── Concrete screen instances ──────────────────────────────
class WaecScreen extends StatelessWidget {
  const WaecScreen({super.key});
  @override
  Widget build(BuildContext context) => ResultCheckerScreen(
        examType: ExamType.waec,
        notifierProvider: waecNotifierProvider,
      );
}

class NecoScreen extends StatelessWidget {
  const NecoScreen({super.key});
  @override
  Widget build(BuildContext context) => ResultCheckerScreen(
        examType: ExamType.neco,
        notifierProvider: necoNotifierProvider,
      );
}

class NabtebScreen extends StatelessWidget {
  const NabtebScreen({super.key});
  @override
  Widget build(BuildContext context) => ResultCheckerScreen(
        examType: ExamType.nabteb,
        notifierProvider: nabtebNotifierProvider,
      );
}