import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/security/secure_screen_mixin.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../providers/verification_provider.dart';
import '../widgets/async_ticket_poller.dart';
import '../widgets/verification_result_cards.dart';

class NinValidationScreen extends ConsumerStatefulWidget {
  const NinValidationScreen({super.key});
  @override
  ConsumerState<NinValidationScreen> createState() =>
      _NinValidationScreenState();
}

class _NinValidationScreenState extends ConsumerState<NinValidationScreen>
    with AsyncTicketPoller<NinValidationScreen>, SecureScreenMixin {
  final _ninController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  NinValidationType _type = NinValidationType.ninValidation;

  @override
  void dispose() {
    _ninController.dispose();
    super.dispose();
  }

  @override
  Future<void> checkStatus() => ref
      .read(asyncFlowProvider.notifier)
      .checkStatus(
        (id) => ref.read(verificationRemoteProvider).checkNinValidation(id),
      );

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm NIN validation (${_type.label}) — ${price.toNaira}',
    );
    if (pin == null || !mounted) return;

    final ok = await ref
        .read(asyncFlowProvider.notifier)
        .submit(
          () => ref
              .read(verificationRemoteProvider)
              .submitNinValidation(
                nin: _ninController.text.trim(),
                validationType: _type,
                pin: pin,
              ),
        );
    if (ok) startPolling();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(asyncFlowProvider);
    final prices = ref.watch(verificationPricesProvider);
    final price =
        prices.valueOrNull?[VerificationService.ninValidation.key] ?? 0;
    final locked = state.isSubmitted;

    return Scaffold(
      appBar: AppBar(title: const Text('NIN Validation')),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Validate a NIN against a specific issue type. Price is the '
                  'same regardless of the type chosen.',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _ninController,
                  label: 'NIN Number',
                  hint: '11-digit National Identification Number',
                  keyboardType: TextInputType.number,
                  enabled: !locked,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  validator: (v) => (v == null || v.trim().length != 11)
                      ? 'Enter a valid 11-digit NIN'
                      : null,
                ),
                const SizedBox(height: 16),
                Text('Validation Type', style: context.textTheme.titleSmall),
                const SizedBox(height: 10),
                DropdownButtonFormField<NinValidationType>(
                  initialValue: _type,
                  decoration: InputDecoration(
                    filled: true,
                    fillColor: context.isDark
                        ? AppColors.darkSurfaceVariant
                        : AppColors.lightSurfaceVariant,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 14,
                    ),
                  ),
                  items: NinValidationType.values
                      .map(
                        (t) => DropdownMenuItem(value: t, child: Text(t.label)),
                      )
                      .toList(),
                  onChanged: locked
                      ? null
                      : (t) {
                          if (t != null) setState(() => _type = t);
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
                if (state.isSubmitted) ...[
                  const SizedBox(height: 20),
                  AsyncTicketStatusCard(state: state, onRefresh: checkStatus),
                ],
                const SizedBox(height: 24),
                if (!locked)
                  KDButton(
                    label: 'Submit Request — ${price.toNaira}',
                    isLoading: state.isSubmitting,
                    onPressed: () => _submit(price),
                  )
                else
                  KDButton(
                    label: 'Start New Request',
                    backgroundColor: Colors.transparent,
                    foregroundColor: context.colors.primary,
                    onPressed: () {
                      ref.read(asyncFlowProvider.notifier).reset();
                      _ninController.clear();
                      stopPolling();
                    },
                  ),
                const SizedBox(height: 24),
                const VerificationHistoryCard(service: 'NIN_VALIDATION'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
