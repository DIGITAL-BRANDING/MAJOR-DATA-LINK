import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

const _enrolmentTypes = <String>[
  'Agency Banking',
  'MICRO FINANCE BANK',
  'FIRST BANK',
  'ACCESS BANK',
  'HERITAGE BANK',
  'ENTERPRISE BANK',
  'BOA BANK',
  'LAPO BANK',
  'NIBSS',
];

/// Native BVN modification flow. The enrolment institution is intentionally
/// chosen before the correction type so it stays attached to every request.
class BvnModificationScreen extends ConsumerStatefulWidget {
  const BvnModificationScreen({super.key});

  @override
  ConsumerState<BvnModificationScreen> createState() =>
      _BvnModificationScreenState();
}

class _BvnModificationScreenState extends ConsumerState<BvnModificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _controllers = <String, TextEditingController>{};
  List<Map<String, dynamic>> _types = const [];
  Map<String, double> _prices = const {};
  Map<String, dynamic>? _selected;
  String? _enrolmentType;
  String? _imageDataUrl;
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  String? _reference;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final client = ref.read(dioClientProvider);
      final results = await Future.wait([
        client.get(AppEndpoints.bvnModificationTypes),
        client.get(AppEndpoints.bvnModificationPrices),
      ]);
      final types = (results[0].data['data'] as List<dynamic>)
          .map((item) => Map<String, dynamic>.from(item as Map))
          .toList();
      final prices = <String, double>{
        for (final item in results[1].data['data'] as List<dynamic>)
          item['type'].toString(): (item['unitPrice'] as num).toDouble(),
      };
      if (mounted)
        setState(() {
          _types = types;
          _prices = prices;
          _loading = false;
        });
    } catch (_) {
      if (mounted)
        setState(() {
          _error =
              'Unable to load BVN modification services. Please refresh and try again.';
          _loading = false;
        });
    }
  }

  void _chooseType(Map<String, dynamic> type) {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
    for (final raw in type['fields'] as List<dynamic>) {
      final field = Map<String, dynamic>.from(raw as Map);
      final key = field['key'].toString();
      if (key != 'enrollment_type' && field['input'] != 'image')
        _controllers[key] = TextEditingController();
    }
    setState(() {
      _selected = type;
      _imageDataUrl = null;
      _error = null;
      _reference = null;
    });
  }

  Future<void> _pickImage() async {
    final picked = await FilePicker.pickFiles(
      type: FileType.image,
      withData: true,
    );
    final bytes = picked?.files.single.bytes;
    if (bytes == null) return;
    if (bytes.length > 4 * 1024 * 1024) {
      setState(() => _error = 'ID card photo must be smaller than 4MB.');
      return;
    }
    final extension = (picked!.files.single.extension ?? 'jpeg').toLowerCase();
    final mime = extension == 'png'
        ? 'png'
        : extension == 'webp'
        ? 'webp'
        : 'jpeg';
    setState(() {
      _imageDataUrl = 'data:image/$mime;base64,${base64Encode(bytes)}';
      _error = null;
    });
  }

  String? _required(String? value, {bool digitsOnly = false}) {
    final clean = value?.trim() ?? '';
    if (clean.isEmpty) return 'Required';
    if (digitsOnly &&
        (clean.length != 11 || !RegExp(r'^\d{11}$').hasMatch(clean)))
      return 'Enter exactly 11 digits';
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate() ||
        _selected == null ||
        _enrolmentType == null)
      return;
    final imageField = (_selected!['fields'] as List<dynamic>).cast<Map>().any(
      (field) => field['input'] == 'image' && field['required'] == true,
    );
    if (imageField && _imageDataUrl == null) {
      setState(() => _error = 'Please attach your National ID card photo.');
      return;
    }
    final price = _prices[_selected!['id'].toString()] ?? 0;
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm BVN Modification',
      subtitle:
          '₦${price.toStringAsFixed(0)} will be deducted from your wallet',
    );
    if (pin == null || !mounted) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final data = <String, dynamic>{
        'enrollment_type': _enrolmentType,
        'pin': pin,
        for (final entry in _controllers.entries)
          entry.key: entry.value.text.trim(),
      };
      if (_imageDataUrl != null) data['id_card_image'] = _imageDataUrl;
      final result = await ref
          .read(dioClientProvider)
          .post(
            AppEndpoints.bvnModificationSubmit(_selected!['id'].toString()),
            data: data,
          );
      if (mounted)
        setState(
          () => _reference = result.data['data']['reference']?.toString(),
        );
    } catch (error) {
      if (mounted)
        setState(
          () => _error =
              'Request failed. Please check your details and try again.',
        );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return Scaffold(
      appBar: AppBar(title: const Text('BVN Modification')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            KDCard(
              backgroundColor: AppColors.primary50,
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BVN Modification',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Requests are reviewed and processed manually. Select where the BVN was enrolled before choosing the correction type.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!, style: const TextStyle(color: Colors.red)),
              ),
            if (_reference != null)
              KDCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Request submitted successfully',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text('Reference: $_reference'),
                    TextButton(
                      onPressed: () => setState(() {
                        _selected = null;
                        _reference = null;
                      }),
                      child: const Text('Submit another request'),
                    ),
                  ],
                ),
              )
            else if (_enrolmentType == null) ...[
              const Text(
                'BVN Enrolment Type',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                decoration: const InputDecoration(
                  labelText: 'Select agency, bank, or NIBSS',
                ),
                items: _enrolmentTypes
                    .map(
                      (item) =>
                          DropdownMenuItem(value: item, child: Text(item)),
                    )
                    .toList(),
                onChanged: (value) => setState(() => _enrolmentType = value),
              ),
            ] else if (_selected == null) ...[
              Text(
                'Enrolment type: $_enrolmentType',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              TextButton(
                onPressed: () => setState(() => _enrolmentType = null),
                child: const Text('Change enrolment type'),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select modification type',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 10),
              ..._types.map((type) {
                final price = _prices[type['id'].toString()];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: KDButton(
                    label:
                        '${type['title']}  ${price == null ? '' : '₦${price.toStringAsFixed(0)}'}',
                    onPressed: () => _chooseType(type),
                  ),
                );
              }),
            ] else ...[
              Text(
                'Enrolment type: $_enrolmentType',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              TextButton(
                onPressed: () => setState(() => _selected = null),
                child: const Text('Change modification type'),
              ),
              const SizedBox(height: 8),
              Text(
                _selected!['title'].toString(),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                'Service fee: ₦${(_prices[_selected!['id'].toString()] ?? 0).toStringAsFixed(0)}',
              ),
              const SizedBox(height: 16),
              Form(
                key: _formKey,
                child: Column(
                  children: [
                    for (final raw in _selected!['fields'] as List<dynamic>)
                      _field(Map<String, dynamic>.from(raw as Map)),
                    const SizedBox(height: 12),
                    KDButton(
                      label: 'Continue to PIN confirmation',
                      isLoading: _submitting,
                      onPressed: _submitting ? null : _submit,
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _field(Map<String, dynamic> field) {
    final key = field['key'].toString();
    if (key == 'enrollment_type') return const SizedBox.shrink();
    final label = field['label'].toString();
    final required = field['required'] == true;
    if (field['input'] == 'image')
      return ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(label),
        subtitle: Text(
          _imageDataUrl == null
              ? 'Tap to select a clear photo'
              : 'Photo selected',
        ),
        trailing: OutlinedButton(
          onPressed: _pickImage,
          child: Text(_imageDataUrl == null ? 'Select' : 'Change'),
        ),
      );
    if (field['input'] == 'select') {
      final options = (field['options'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList();
      return Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: DropdownButtonFormField<String>(
          decoration: InputDecoration(labelText: label),
          items: options
              .map(
                (option) =>
                    DropdownMenuItem(value: option, child: Text(option)),
              )
              .toList(),
          onChanged: (value) => _controllers[key]!.text = value ?? '',
          validator: required ? _required : null,
        ),
      );
    }
    final numeric =
        field['input'] == 'bvn' ||
        field['input'] == 'nin' ||
        field['input'] == 'phone';
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: TextFormField(
        controller: _controllers[key],
        decoration: InputDecoration(labelText: label),
        keyboardType: numeric
            ? TextInputType.number
            : field['input'] == 'date'
            ? TextInputType.datetime
            : TextInputType.text,
        validator: required
            ? (value) => _required(value, digitsOnly: numeric)
            : null,
      ),
    );
  }
}
