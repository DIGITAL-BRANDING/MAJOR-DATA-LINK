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
  void initState() {
    super.initState();
    // This service has a materially different completion time from instant
    // verification. Show the information once whenever this screen is opened,
    // before a customer commits funds or submits a request.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _showServiceNotice();
    });
  }

  Future<void> _showServiceNotice() async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(
            Icons.info_outline_rounded,
            color: AppColors.primary500,
            size: 48,
        ),
        title: const Text(
            'Important Service Notice',
            textAlign: TextAlign.center,
        ),
        content: const Text(
            'NIN Validation is a NIMC service for a NIN that is inactive, '
            'not working, or showing “Record Not Found”.\n\n'
            'Most requests are completed within 48 working hours.\n\n'
            'Choose Modification when NIMC has updated a name, date of birth, '
            'or phone number but the old details are still displayed. '
            'Modification requests can take up to two weeks, depending on NIMC.',
            textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
            KDButton(
              label: 'I Understand',
              onPressed: () => Navigator.of(dialogContext).pop(),
            ),
        ],
      ),
    );
  }

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
    final price = prices.valueOrNull?[_type.serviceKey] ?? 0;
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
                  'Validate a NIN against a specific issue type. Price '
                  'depends on the type chosen.',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 8),
                const Text('Service completion: 6–72 hours.', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
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
                VerificationHistoryCard(service: _type.serviceKey),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
