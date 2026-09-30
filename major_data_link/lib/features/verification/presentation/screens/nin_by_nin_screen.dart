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

enum NinVerificationVariant { defaultRoute, v1, v2 }

const _normalPriceKeyFor = {
  SlipTier.premium: VerificationService.ninSlipPremium,
  SlipTier.standard: VerificationService.ninSlipStandard,
  SlipTier.regular: VerificationService.ninSlipRegular,
  SlipTier.vnin: VerificationService.ninSlipVnin,
  SlipTier.personal: VerificationService.ninPersonalInfoSlip,
};

const _v1PriceKeyFor = {
  SlipTier.premium: VerificationService.ninVerificationV1Premium,
  SlipTier.standard: VerificationService.ninVerificationV1Standard,
  SlipTier.regular: VerificationService.ninVerificationV1Regular,
  SlipTier.vnin: VerificationService.ninVerificationV1Vnin,
  SlipTier.personal: VerificationService.ninVerificationV1Personal,
};

const _v2PriceKeyFor = {
  SlipTier.premium: VerificationService.ninVerificationV2Premium,
  SlipTier.standard: VerificationService.ninVerificationV2Standard,
  SlipTier.regular: VerificationService.ninVerificationV2Regular,
  SlipTier.vnin: VerificationService.ninVerificationV2Vnin,
  SlipTier.personal: VerificationService.ninVerificationV2Personal,
};

class NinByNinScreen extends ConsumerStatefulWidget {
  const NinByNinScreen({
    super.key,
    this.variant = NinVerificationVariant.defaultRoute,
  });

  final NinVerificationVariant variant;
  @override
  ConsumerState<NinByNinScreen> createState() => _NinByNinScreenState();
}

class _NinByNinScreenState extends ConsumerState<NinByNinScreen>
    with SecureScreenMixin {
  final _ninController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  SlipTier _tier = SlipTier.standard;

  Map<SlipTier, VerificationService> get _priceKeyFor =>
      switch (widget.variant) {
        NinVerificationVariant.defaultRoute => _normalPriceKeyFor,
        NinVerificationVariant.v1 => _v1PriceKeyFor,
        NinVerificationVariant.v2 => _v2PriceKeyFor,
      };

  String get _title => switch (widget.variant) {
    NinVerificationVariant.defaultRoute => 'NIN by NIN',
    NinVerificationVariant.v1 => 'NIN Verification V1',
    NinVerificationVariant.v2 => 'NIN Verification V2',
  };

  @override
  void dispose() {
    _ninController.dispose();
    super.dispose();
  }

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm ${_tier.label} NIN slip lookup — ${price.toNaira}',
    );
    if (pin == null || !mounted) return;

    await ref.read(slipFlowProvider.notifier).submit(() {
      final remote = ref.read(verificationRemoteProvider);
      return switch (widget.variant) {
        NinVerificationVariant.defaultRoute => remote.ninByNin(
          nin: _ninController.text.trim(),
          tier: _tier,
          pin: pin,
        ),
        NinVerificationVariant.v1 => remote.ninVerificationV1(
          nin: _ninController.text.trim(),
          tier: _tier,
          pin: pin,
        ),
        NinVerificationVariant.v2 => remote.ninVerificationV2(
          nin: _ninController.text.trim(),
          tier: _tier,
          pin: pin,
        ),
      };
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(slipFlowProvider);
    final prices = ref.watch(verificationPricesProvider);
    final price = prices.valueOrNull?[_priceKeyFor[_tier]!.key] ?? 0;
    final availability = ref
        .watch(verificationAvailabilityProvider)
        .valueOrNull;
    final family = switch (widget.variant) {
      NinVerificationVariant.v1 => 'NIN_VERIFICATION_V1',
      NinVerificationVariant.v2 => 'NIN_VERIFICATION_V2',
      NinVerificationVariant.defaultRoute => null,
    };
    final variantAvailable =
        family == null ||
        availability == null ||
        availability.entries.any(
          (entry) => entry.key.startsWith('${family}_') && entry.value,
        );

    if (!variantAvailable) {
      return Scaffold(
        appBar: AppBar(title: Text(_title)),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(AppDimensions.screenPaddingH),
            child: Text(
              'This service is currently not available. Please choose another NIN verification option.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(title: Text(_title)),
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
                    SlipTier.vnin,
                    SlipTier.personal,
                  ],
                  selected: _tier,
                  labelOf: (t) => t.label,
                  onChanged: (t) => setState(() => _tier = t),
                ),
                const SizedBox(height: 20),
                KDTextField(
                  controller: _ninController,
                  label: 'NIN Number',
                  hint: '11-digit National Identification Number',
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  validator: (v) {
                    if (v == null || v.trim().length != 11) {
                      return 'Enter a valid 11-digit NIN';
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
                const SizedBox(height: 24),
                VerificationHistoryCard(service: _priceKeyFor[_tier]!.key),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
