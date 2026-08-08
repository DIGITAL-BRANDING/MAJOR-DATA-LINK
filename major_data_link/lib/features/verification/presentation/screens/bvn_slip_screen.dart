import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../providers/verification_provider.dart';
import '../widgets/tier_selector.dart';
import '../widgets/verification_result_cards.dart';

const _priceKeyFor = {
  BvnTier.premium: VerificationService.bvnSlipPremium,
  BvnTier.standard: VerificationService.bvnSlipStandard,
};

class BvnSlipScreen extends ConsumerStatefulWidget {
  const BvnSlipScreen({super.key});
  @override
  ConsumerState<BvnSlipScreen> createState() => _BvnSlipScreenState();
}

class _BvnSlipScreenState extends ConsumerState<BvnSlipScreen> {
  final _bvnController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  BvnTier _tier = BvnTier.standard;

  @override
  void dispose() {
    _bvnController.dispose();
    super.dispose();
  }

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm ${_tier.label} BVN slip lookup — ${price.toNaira}',
    );
    if (!pinVerified || !mounted) return;

    await ref.read(slipFlowProvider.notifier).submit(
          () => ref.read(verificationRemoteProvider).bvnSlip(
                bvn: _bvnController.text.trim(),
                tier: _tier,
              ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(slipFlowProvider);
    final prices = ref.watch(verificationPricesProvider);
    final price = prices.valueOrNull?[_priceKeyFor[_tier]!.key] ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('BVN Slip')),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Slip tier', style: context.textTheme.titleSmall),
                const SizedBox(height: 10),
                TierSelector<BvnTier>(
                  tiers: const [BvnTier.premium, BvnTier.standard],
                  selected: _tier,
                  labelOf: (t) => t.label,
                  onChanged: (t) => setState(() => _tier = t),
                ),
                const SizedBox(height: 20),
                KDTextField(
                  controller: _bvnController,
                  label: 'BVN Number',
                  hint: '11-digit Bank Verification Number',
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  validator: (v) {
                    if (v == null || v.trim().length != 11) {
                      return 'Enter a valid 11-digit BVN';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                KDCard(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Price'),
                      Text(
                        prices.isLoading ? '…' : price.toNaira,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
                if (state.result != null) ...[
                  const SizedBox(height: 20),
                  SlipResultCard(result: state.result!),
                ],
                const SizedBox(height: 24),
                KDButton(
                  label: 'Generate Slip — ${price.toNaira}',
                  isLoading: state.isSubmitting,
                  onPressed: () => _submit(price),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
