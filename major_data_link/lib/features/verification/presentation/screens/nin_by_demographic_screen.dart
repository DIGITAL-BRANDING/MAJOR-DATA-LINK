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
import '../widgets/verification_result_cards.dart';

class NinByDemographicScreen extends ConsumerStatefulWidget {
  const NinByDemographicScreen({super.key});
  @override
  ConsumerState<NinByDemographicScreen> createState() =>
      _NinByDemographicScreenState();
}

class _NinByDemographicScreenState
    extends ConsumerState<NinByDemographicScreen>
    with SecureScreenMixin {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _dobController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  String? _gender;

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25),
      firstDate: DateTime(1920),
      lastDate: now,
    );
    if (picked != null) {
      final dd = picked.day.toString().padLeft(2, '0');
      final mm = picked.month.toString().padLeft(2, '0');
      _dobController.text = '$dd-$mm-${picked.year}';
    }
  }

  Future<void> _submit(double price) async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle: 'Confirm NIN lookup by demographic details — ${price.toNaira}',
    );
    if (!pinVerified || !mounted) return;

    await ref.read(slipFlowProvider.notifier).submit(
          () => ref.read(verificationRemoteProvider).ninByDemographic(
                firstname: _firstNameController.text.trim(),
                lastname: _lastNameController.text.trim(),
                dob: _dobController.text.trim(),
                gender: _gender,
              ),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(slipFlowProvider);
    final prices = ref.watch(verificationPricesProvider);
    final price =
        prices.valueOrNull?[VerificationService.ninDemographic.key] ?? 0;

    return Scaffold(
      appBar: AppBar(title: const Text('NIN by Demographic')),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                KDTextField(
                  controller: _firstNameController,
                  label: 'First Name',
                  textCapitalization: TextCapitalization.words,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _lastNameController,
                  label: 'Last Name',
                  textCapitalization: TextCapitalization.words,
                  validator: (v) =>
                      (v == null || v.trim().isEmpty) ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                KDTextField(
                  controller: _dobController,
                  label: 'Date of Birth',
                  hint: 'DD-MM-YYYY',
                  readOnly: true,
                  onTap: _pickDob,
                  suffixIcon: Icons.calendar_today_rounded,
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? 'Select a date of birth'
                      : null,
                ),
                const SizedBox(height: 16),
                Text('Gender (optional)', style: context.textTheme.titleSmall),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: const Text('Male'),
                      selected: _gender == 'MALE',
                      onSelected: (_) => setState(() => _gender = 'MALE'),
                    ),
                    ChoiceChip(
                      label: const Text('Female'),
                      selected: _gender == 'FEMALE',
                      onSelected: (_) => setState(() => _gender = 'FEMALE'),
                    ),
                  ],
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
