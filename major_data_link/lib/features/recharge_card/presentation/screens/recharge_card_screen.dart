import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';

// ── Denomination entity ────────────────────────────────────
class CardDenomination {
  const CardDenomination({required this.label, required this.price});
  final String label;
  final double price;
}

const kRechargeCardDenominations = [
  CardDenomination(label: '₦100', price: 100),
  CardDenomination(label: '₦200', price: 200),
  CardDenomination(label: '₦500', price: 500),
  CardDenomination(label: '₦1,000', price: 1000),
  CardDenomination(label: '₦2,000', price: 2000),
  CardDenomination(label: '₦5,000', price: 5000),
];

// ── State ──────────────────────────────────────────────────
class CardPrintingState {
  const CardPrintingState({
    this.selectedDenomination,
    this.network = 'MTN',
    this.quantity = 1,
    this.isProcessing = false,
    this.errorMessage,
  });

  final CardDenomination? selectedDenomination;
  final String network;
  final int quantity;
  final bool isProcessing;
  final String? errorMessage;

  double get totalAmount =>
      (selectedDenomination?.price ?? 0) * quantity;

  bool get canProceed => selectedDenomination != null && quantity >= 1;

  CardPrintingState copyWith({
    CardDenomination? selectedDenomination,
    String? network,
    int? quantity,
    bool? isProcessing,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CardPrintingState(
      selectedDenomination:
          selectedDenomination ?? this.selectedDenomination,
      network: network ?? this.network,
      quantity: quantity ?? this.quantity,
      isProcessing: isProcessing ?? this.isProcessing,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CardPrintingNotifier extends StateNotifier<CardPrintingState> {
  CardPrintingNotifier(this._ref, this._isRecharge)
      : super(const CardPrintingState());

  final Ref _ref;
  final bool _isRecharge;

  void selectDenomination(CardDenomination d) =>
      state = state.copyWith(selectedDenomination: d, clearError: true);

  void setNetwork(String n) => state = state.copyWith(network: n);

  void setQuantity(int qty) =>
      state = state.copyWith(quantity: qty.clamp(1, 50));

  Future<Map<String, dynamic>?> generate() async {
    if (!state.canProceed) return null;
    state = state.copyWith(isProcessing: true, clearError: true);

    try {
      final dio = _ref.read(dioClientProvider);
      final endpoint = _isRecharge
          ? AppEndpoints.generateRechargeCard
          : AppEndpoints.generateDataCard;
      final response = await dio.post(
        endpoint,
        data: {
          'network': state.network,
          'amount': state.selectedDenomination!.price,
          'quantity': state.quantity,
        },
      );
      if (response.data['status'] == true) {
        await _ref.read(hiveStorageProvider).remove('wallet_balance');
      }
      state = state.copyWith(isProcessing: false);
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      final ex = ErrorHandler.handleException(e);
      state = state.copyWith(isProcessing: false, errorMessage: ex.message);
      return null;
    }
  }

  void reset() => state = const CardPrintingState();
}

final rechargeCardNotifierProvider = StateNotifierProvider.autoDispose<
    CardPrintingNotifier, CardPrintingState>((ref) {
  return CardPrintingNotifier(ref, true);
});

final dataCardNotifierProvider = StateNotifierProvider.autoDispose<
    CardPrintingNotifier, CardPrintingState>((ref) {
  return CardPrintingNotifier(ref, false);
});

// ── Generic card printing screen ──────────────────────────
class _CardPrintingScreen extends ConsumerWidget {
  const _CardPrintingScreen({
    required this.title,
    required this.notifierProvider,
    required this.isRecharge,
  });

  final String title;
  final AutoDisposeStateNotifierProvider<CardPrintingNotifier, CardPrintingState>
      notifierProvider;
  final bool isRecharge;

  Future<void> _handleGenerate(
    BuildContext context,
    WidgetRef ref,
    CardPrintingState state,
  ) async {
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm generation of ${state.quantity} × ${state.selectedDenomination!.label} cards',
    );
    if (!pinVerified || !context.mounted) return;

    final result =
        await ref.read(notifierProvider.notifier).generate();
    if (!context.mounted) return;

    if (result != null && result['status'] == true) {
      final data = result['data'] as Map<String, dynamic>? ?? {};
      final cards = data['cards'] as List<dynamic>? ?? [];

      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => _CardResultScreen(
            title: title,
            cards: cards
                .map((c) => c is Map<String, dynamic>
                    ? {
                        'serial': c['serial']?.toString() ?? '',
                        'pin': c['pin']?.toString() ?? '',
                      }
                    : <String, String>{})
                .toList(),
            denomination: state.selectedDenomination!.label,
            reference: data['reference']?.toString() ?? '',
          ),
        ),
      );
    } else {
      context.showSnackBar(
        ref.read(notifierProvider).errorMessage ?? 'Generation failed',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(notifierProvider);

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Select network', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              Row(
                children: ['MTN', 'GLO', 'AIRTEL', '9MOBILE'].map((n) {
                  final isSelected = state.network == n;
                  return Expanded(
                    child: GestureDetector(
                      onTap: () =>
                          ref.read(notifierProvider.notifier).setNetwork(n),
                      child: Container(
                        margin: const EdgeInsets.only(right: 8),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? context.colors.primary
                              : AppColors.primary50,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          n,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? Colors.white
                                : context.colors.primary,
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              Text('Select denomination',
                  style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: kRechargeCardDenominations.map((d) {
                  final isSelected =
                      state.selectedDenomination?.price == d.price;
                  return GestureDetector(
                    onTap: () => ref
                        .read(notifierProvider.notifier)
                        .selectDenomination(d),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? context.colors.primary
                            : AppColors.primary50,
                        borderRadius: BorderRadius.circular(10),
                        border: isSelected
                            ? null
                            : Border.all(color: AppColors.primary100),
                      ),
                      child: Text(
                        d.label,
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: isSelected ? Colors.white : context.colors.primary,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 24),
              Text('Quantity (1–50)', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              Row(
                children: [
                  _QtyBtn(
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
                            fontWeight: FontWeight.w800),
                      ),
                    ),
                  ),
                  const SizedBox(width: 20),
                  _QtyBtn(
                    icon: Icons.add_rounded,
                    onTap: () => ref
                        .read(notifierProvider.notifier)
                        .setQuantity(state.quantity + 1),
                    enabled: state.quantity < 50,
                  ),
                ],
              ),
              if (state.canProceed) ...[
                const SizedBox(height: 24),
                KDCard(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total amount'),
                      Text(
                        AppFormatters.formatAmount(state.totalAmount),
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 18,
                          color: context.colors.primary,
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
            label: state.canProceed
                ? 'Generate ${state.quantity} card(s) — ${AppFormatters.formatAmount(state.totalAmount)}'
                : 'Select denomination to continue',
            onPressed: state.canProceed
                ? () => _handleGenerate(context, ref, state)
                : null,
            isLoading: state.isProcessing,
            gradient: AppColors.primaryGradient,
          ),
        ),
      ),
    );
  }
}

class _QtyBtn extends StatelessWidget {
  const _QtyBtn({
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
      child: Container(
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

// ── Card result screen ─────────────────────────────────────
class _CardResultScreen extends StatelessWidget {
  const _CardResultScreen({
    required this.title,
    required this.cards,
    required this.denomination,
    required this.reference,
  });

  final String title;
  final List<Map<String, String>> cards;
  final String denomination;
  final String reference;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('$title — $denomination')),
      body: Column(
        children: [
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              itemCount: cards.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final card = cards[index];
                final pin = card['pin'] ?? '';
                final serial = card['serial'] ?? '';
                return KDCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Card ${index + 1}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                                color: AppColors.neutral500,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              AppFormatters.formatRechargePin(pin),
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                letterSpacing: 2,
                              ),
                            ),
                            if (serial.isNotEmpty)
                              Text('SN: $serial',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.neutral500)),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_rounded, size: 18),
                        onPressed: () => pin.copyToClipboard(context,
                            message: 'PIN copied'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            child: KDButton(
              label: 'Done',
              onPressed: () => Navigator.of(context).pop(),
              gradient: AppColors.primaryGradient,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Public screen classes used in router ──────────────────
class RechargeCardScreen extends StatelessWidget {
  const RechargeCardScreen({super.key});
  @override
  Widget build(BuildContext context) => _CardPrintingScreen(
        title: 'Recharge Card Printing',
        notifierProvider: rechargeCardNotifierProvider,
        isRecharge: true,
      );
}

class DataCardScreen extends StatelessWidget {
  const DataCardScreen({super.key});
  @override
  Widget build(BuildContext context) => _CardPrintingScreen(
        title: 'Data Card Printing',
        notifierProvider: dataCardNotifierProvider,
        isRecharge: false,
      );
}