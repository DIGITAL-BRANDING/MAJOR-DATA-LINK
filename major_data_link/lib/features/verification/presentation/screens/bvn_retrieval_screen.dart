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
import '../widgets/async_ticket_poller.dart';
import '../widgets/verification_result_cards.dart';

class BvnRetrievalScreen extends ConsumerStatefulWidget {
  const BvnRetrievalScreen({super.key});
  @override
  ConsumerState<BvnRetrievalScreen> createState() => _BvnRetrievalScreenState();
}

class _BvnRetrievalScreenState extends ConsumerState<BvnRetrievalScreen>
    with AsyncTicketPoller<BvnRetrievalScreen>, SecureScreenMixin {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Future<void> checkStatus() => ref
      .read(asyncFlowProvider.notifier)
      .checkStatus(
        (id) => ref.read(verificationRemoteProvider).checkBvnRetrieval(id),
      );

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm BVN retrieval request — ${price.toNaira}',
    );
    if (pin == null || !mounted) return;

    final ok = await ref
        .read(asyncFlowProvider.notifier)
        .submit(
          () => ref
              .read(verificationRemoteProvider)
              .submitBvnRetrieval(
                firstName: _firstNameController.text.trim(),
                lastName: _lastNameController.text.trim(),
                phoneNumber: _phoneController.text.trim(),
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
        prices.valueOrNull?[VerificationService.bvnRetrieval.key] ?? 0;
    final locked = state.isSubmitted;

    return Scaffold(
      appBar: AppBar(title: const Text('BVN Retrieval')),
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
                  "Look up a BVN by the owner's name and registered phone "
                  'number when the BVN itself is unknown.',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _firstNameController,
                  label: 'First Name',
                  textCapitalization: TextCapitalization.words,
                  enabled: !locked,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _lastNameController,
                  label: 'Last Name',
                  textCapitalization: TextCapitalization.words,
                  enabled: !locked,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _phoneController,
                  label: 'Phone Number',
                  hint: '11-digit phone number registered to the BVN',
                  keyboardType: TextInputType.phone,
                  enabled: !locked,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                  validator: (v) =>
                      (v == null || !v.trim().isValidNigerianPhone)
                      ? 'Enter a valid 11-digit phone number'
                      : null,
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
                      _firstNameController.clear();
                      _lastNameController.clear();
                      _phoneController.clear();
                      stopPolling();
                    },
                  ),
                const SizedBox(height: 24),
                const VerificationHistoryCard(service: 'BVN_RETRIEVAL'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
