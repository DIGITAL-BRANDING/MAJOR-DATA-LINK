import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/security/secure_screen_mixin.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../providers/verification_provider.dart';
import '../widgets/tier_selector.dart';
import '../widgets/verification_result_cards.dart';

// Note: NIN-by-Phone has no VNIN tier server-side (see SlipTier.exclude
// in verification.routes.ts) — only these three are offered here.
const _priceKeyFor = {
  SlipTier.premium: VerificationService.ninPhoneSlipPremium,
  SlipTier.standard: VerificationService.ninPhoneSlipStandard,
  SlipTier.regular: VerificationService.ninPhoneSlipRegular,
};

class NinByPhoneScreen extends ConsumerStatefulWidget {
  const NinByPhoneScreen({super.key});
  @override
  ConsumerState<NinByPhoneScreen> createState() => _NinByPhoneScreenState();
}

class _NinByPhoneScreenState extends ConsumerState<NinByPhoneScreen>
    with SecureScreenMixin {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  SlipTier _tier = SlipTier.standard;

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm ${_tier.label} NIN slip lookup — ${price.toNaira}',
    );
    if (!pinVerified || !mounted) return;

    await ref.read(slipFlowProvider.notifier).submit(
          () => ref.read(verificationRemoteProvider).ninByPhone(
                phone: _phoneController.text.trim(),
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
      appBar: AppBar(title: const Text('NIN by Phone')),
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
                TierSelector<SlipTier>(
                  tiers: const [
                    SlipTier.premium,
                    SlipTier.standard,
                    SlipTier.regular,
                  ],
                  selected: _tier,
                  labelOf: (t) => t.label,
                  onChanged: (t) => setState(() => _tier = t),
                ),
                const SizedBox(height: 20),
                KDTextField(
                  controller: _phoneController,
                  label: 'Phone Number',
                  hint: '11-digit phone number registered to the NIN',
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  validator: (v) {
                    if (v == null || !v.trim().isValidNigerianPhone) {
                      return 'Enter a valid 11-digit phone number';
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
