import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/config/app_config.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

class BvnLicenseOnboardingScreen extends ConsumerStatefulWidget {
  const BvnLicenseOnboardingScreen({super.key});
  @override
  ConsumerState<BvnLicenseOnboardingScreen> createState() =>
      _BvnLicenseOnboardingState();
}

class _BvnLicenseOnboardingState
    extends ConsumerState<BvnLicenseOnboardingScreen> {
  final _form = GlobalKey<FormState>();
  final _fields = <String, TextEditingController>{};
  String? _zone;
  bool _consent = false;
  bool _busy = false;
  String? _trackingId;
  static const zones = [
    'North Central',
    'North East',
    'North West',
    'South East',
    'South South',
    'South West',
  ];
  static const names = {
    'agent_location': 'Agent Location',
    'agent_bvn': 'Agent BVN',
    'account_number': 'Account Number',
    'bank_name': 'Bank Name',
    'first_name': 'First Name',
    'last_name': 'Last Name',
    'email': 'Email Address',
    'phone_number': 'Phone Number',
    'date_of_birth': 'Date of Birth',
    'address': 'Address',
    'lga': 'LGA',
    'state_of_residence': 'State of Residence',
  };
  @override
  void initState() {
    super.initState();
    for (final key in names.keys) {
      _fields[key] = TextEditingController();
    }
  }

  @override
  void dispose() {
    for (final c in _fields.values) c.dispose();
    super.dispose();
  }

  String? req(String? v) {
    if (v == null || v.trim().isEmpty) return 'Required';
    return null;
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate() || _zone == null || !_consent) return;
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm BVN License Request',
      subtitle: '₦10,000 will be deducted from your wallet',
    );
    if (pin == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final data = <String, dynamic>{
        for (final e in _fields.entries) e.key: e.value.text.trim(),
        'geo_political_zone': _zone,
        'consent': true,
        'pin': pin,
      };
      final response = await ref
          .read(dioClientProvider)
          .post(
            '${AppConfig.baseUrl}/verification/bvn/license-onboarding',
            data: data,
          );
      setState(
        () => _trackingId = response.data['data']['trackingId']?.toString(),
      );
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Request failed: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('BVN License Onboarding')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text(
              'Service fee: ₦10,000',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ...names.entries.map(
              (e) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: KDTextField(
                  controller: _fields[e.key]!,
                  label: e.value,
                  validator: req,
                ),
              ),
            ),
            DropdownButtonFormField<String>(
              value: _zone,
              decoration: const InputDecoration(
                labelText: 'Geo Political Zone',
              ),
              items: zones
                  .map((z) => DropdownMenuItem(value: z, child: Text(z)))
                  .toList(),
              onChanged: (v) => setState(() => _zone = v),
              validator: (v) => v == null ? 'Required' : null,
            ),
            CheckboxListTile(
              value: _consent,
              onChanged: (v) => setState(() => _consent = v ?? false),
              title: const Text(
                'I confirm that all information provided is accurate.',
              ),
              controlAffinity: ListTileControlAffinity.leading,
            ),
            if (_trackingId != null)
              KDCard(
                child: Text(
                  'Tracking ID\n$_trackingId',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            KDButton(
              label: _busy ? 'Submitting...' : 'Submit Request',
              onPressed: _busy ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
