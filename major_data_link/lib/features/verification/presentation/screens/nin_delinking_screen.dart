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

class NinDelinkingScreen extends ConsumerStatefulWidget {
  const NinDelinkingScreen({super.key});
  @override
  ConsumerState<NinDelinkingScreen> createState() =>
      _NinDelinkingScreenState();
}

class _NinDelinkingScreenState extends ConsumerState<NinDelinkingScreen>
    with AsyncTicketPoller<NinDelinkingScreen>, SecureScreenMixin {
  final _ninController = TextEditingController();
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _ninController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  @override
  Future<void> checkStatus() => ref.read(asyncFlowProvider.notifier).checkStatus(
        (id) => ref.read(verificationRemoteProvider).checkDelinking(id),
      );

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm NIN delinking request — ${price.toNaira}',
    );
    if (!pinVerified || !mounted) return;

    final ok = await ref.read(asyncFlowProvider.notifier).submit(
          () => ref.read(verificationRemoteProvider).submitDelinking(
                nin: _ninController.text.trim(),
                email: _emailController.text.trim(),
              ),
        );
    if (ok) startPolling();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(asyncFlowProvider);
    final prices = ref.watch(verificationPricesProvider);
    final price =
        prices.valueOrNull?[VerificationService.ninDelinking.key] ?? 0;
    final locked = state.isSubmitted;

    return Scaffold(
      appBar: AppBar(title: const Text('NIN Delinking')),
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
                  'Unlink an email address from a NIN. This is processed by '
                  'an admin — submit, then check back for the outcome.',
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
                KDTextField(
                  controller: _emailController,
                  label: 'Email to Delink',
                  keyboardType: TextInputType.emailAddress,
                  enabled: !locked,
                  validator: (v) => (v == null || !v.trim().isValidEmail)
                      ? 'Enter a valid email address'
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
                  AsyncTicketStatusCard(
                    state: state,
                    onRefresh: checkStatus,
                  ),
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
                      _emailController.clear();
                      stopPolling();
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
