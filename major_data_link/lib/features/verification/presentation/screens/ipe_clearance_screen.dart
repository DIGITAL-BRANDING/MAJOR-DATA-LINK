import 'package:flutter/material.dart';
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

class IpeClearanceScreen extends ConsumerStatefulWidget {
  const IpeClearanceScreen({super.key});
  @override
  ConsumerState<IpeClearanceScreen> createState() =>
      _IpeClearanceScreenState();
}

class _IpeClearanceScreenState extends ConsumerState<IpeClearanceScreen>
    with AsyncTicketPoller<IpeClearanceScreen>, SecureScreenMixin {
  final _trackingIdController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _trackingIdController.dispose();
    super.dispose();
  }

  @override
  Future<void> checkStatus() => ref.read(asyncFlowProvider.notifier).checkStatus(
        (id) => ref.read(verificationRemoteProvider).checkIpeClearance(id),
      );

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm IPE clearance request — ${price.toNaira}',
    );
    if (!pinVerified || !mounted) return;

    final ok = await ref.read(asyncFlowProvider.notifier).submit(
          () => ref.read(verificationRemoteProvider).submitIpeClearance(
                trackingId: _trackingIdController.text.trim(),
              ),
        );
    if (ok) startPolling();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(asyncFlowProvider);
    final prices = ref.watch(verificationPricesProvider);
    final price =
        prices.valueOrNull?[VerificationService.ipeClearance.key] ?? 0;
    final locked = state.isSubmitted;

    return Scaffold(
      appBar: AppBar(title: const Text('IPE Clearance')),
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
                  'Submit a tracking ID for IPE clearance processing.',
                  style: const TextStyle(fontSize: 12),
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _trackingIdController,
                  label: 'Tracking ID',
                  hint: '1–20 alphanumeric characters',
                  maxLength: 20,
                  enabled: !locked,
                  validator: (v) {
                    final value = v?.trim() ?? '';
                    if (value.isEmpty || value.length > 20) {
                      return 'Enter a tracking ID (max 20 characters)';
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
                      _trackingIdController.clear();
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
