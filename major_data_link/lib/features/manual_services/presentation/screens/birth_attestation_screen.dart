import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

/// Birth attestation with the same dynamic form as the web app: the field list
/// (labels, sections, required flags, input types, select options) comes from
/// GET /birth-attestation/fields, so the app never drifts from the backend.
class BirthAttestationScreen extends ConsumerStatefulWidget {
  const BirthAttestationScreen({super.key});

  @override
  ConsumerState<BirthAttestationScreen> createState() =>
      _BirthAttestationScreenState();
}

class _BirthField {
  _BirthField.fromJson(Map<String, dynamic> j)
      : key = j['key']?.toString() ?? '',
        label = j['label']?.toString() ?? '',
        isRequired = j['required'] == true,
        input = j['input']?.toString() ?? 'text',
        options = ((j['options'] as List?) ?? const [])
            .map((e) => e.toString())
            .toList(),
        section = j['section']?.toString() ?? 'Details';

  final String key;
  final String label;
  final bool isRequired;
  final String input; // text | date | nin | select | image
  final List<String> options;
  final String section;
}

class _BirthAttestationScreenState
    extends ConsumerState<BirthAttestationScreen> {
  final _formKey = GlobalKey<FormState>();
  final Map<String, TextEditingController> _text = {};
  final Map<String, String?> _select = {};
  final Map<String, String?> _images = {}; // key -> data URL
  final Map<String, String?> _imageNames = {};
  List<_BirthField> _fields = const [];
  double? _price;
  List<Map<String, dynamic>> _history = const [];
  bool _loading = true;
  bool _busy = false;
  bool _consent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _text.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    final dio = ref.read(dioClientProvider);
    try {
      final results = await Future.wait([
        dio.get(AppEndpoints.birthFields),
        dio.get(AppEndpoints.birthPrice),
        dio.get(AppEndpoints.birthHistory),
      ]);
      if (!mounted) return;
      final fields = (results[0].data['data'] as List? ?? const [])
          .map((e) => _BirthField.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      for (final f in fields) {
        if (f.input == 'select') continue;
        if (f.input == 'image') continue;
        _text.putIfAbsent(f.key, () => TextEditingController());
      }
      setState(() {
        _fields = fields;
        _price = ((results[1].data['data'] as Map?)?['unit_price'] as num?)?.toDouble();
        _history = (results[2].data['data'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = 'Could not load the form. Pull to retry.'; });
    }
  }

  Future<void> _pickDate(String key) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 20),
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked == null) return;
    _text.putIfAbsent(key, () => TextEditingController()).text =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    setState(() {});
  }

  Future<void> _pickImage(String key) async {
    final picked = await FilePicker.pickFiles(
      type: FileType.image,
      withData: true,
    );
    final file = picked?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return;
    if (bytes.length > 4 * 1024 * 1024) {
      setState(() => _error = 'Photo must be under 4MB.');
      return;
    }
    final ext = (file.extension ?? 'jpeg').toLowerCase();
    final mime = ext == 'png' ? 'png' : ext == 'webp' ? 'webp' : 'jpeg';
    setState(() {
      _error = null;
      _images[key] = 'data:image/$mime;base64,${base64Encode(bytes)}';
      _imageNames[key] = file.name;
    });
  }

  String? _valueOf(_BirthField f) {
    switch (f.input) {
      case 'select':
        return _select[f.key];
      case 'image':
        return _images[f.key];
      default:
        final t = _text[f.key]?.text.trim() ?? '';
        return t.isEmpty ? null : t;
    }
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    for (final f in _fields.where((f) => f.isRequired)) {
      if (_valueOf(f) == null) {
        setState(() => _error = '${f.label} is required.');
        return;
      }
    }
    if (!_consent) {
      setState(() => _error = 'Please tick the consent box before continuing.');
      return;
    }
    context.hideKeyboard();
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm Birth Attestation',
      subtitle: _price == null
          ? 'Confirm this request'
          : 'Confirm ${AppFormatters.formatAmount(_price!)}',
    );
    if (pin == null || !mounted) return;

    setState(() => _busy = true);
    try {
      // Optional fields are sent as '' when empty - the backend accepts that
      // for every optional input type, and it is what the web app sends.
      final body = <String, dynamic>{
        for (final f in _fields) f.key: _valueOf(f) ?? '',
        'pin': pin,
      };
      final r = await ref.read(dioClientProvider).post(
            AppEndpoints.birthSubmit,
            data: body,
            options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
          );
      if (!mounted) return;
      final reference = (r.data['data'] as Map?)?['reference']?.toString();
      final message = r.data['message']?.toString() ?? 'Request submitted.';
      for (final c in _text.values) {
        c.clear();
      }
      setState(() {
        _select.clear();
        _images.clear();
        _imageNames.clear();
        _consent = false;
      });
      context.showSnackBar(reference == null ? message : '$message Ref: $reference');
      _load();
    } on DioException catch (e) {
      final data = e.response?.data;
      setState(() => _error = data is Map && data['message'] != null
          ? data['message'].toString()
          : 'Request failed. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(_BirthField f) {
    switch (f.input) {
      case 'select':
        return DropdownButtonFormField<String>(
          value: _select[f.key],
          decoration: InputDecoration(labelText: f.label + (f.isRequired ? ' *' : '')),
          items: f.options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          validator: (v) => f.isRequired && v == null ? 'Required' : null,
          onChanged: (v) => setState(() => _select[f.key] = v),
        );
      case 'image':
        return KDCard(
          onTap: _busy ? null : () => _pickImage(f.key),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  '${f.label}${f.isRequired ? ' *' : ''}\n'
                  '${_imageNames[f.key] ?? 'Tap to choose a photo (PNG, JPEG or WEBP)'}',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
              Icon(
                _images[f.key] == null
                    ? Icons.add_photo_alternate_outlined
                    : Icons.check_circle_rounded,
                color: _images[f.key] == null
                    ? AppColors.neutral500
                    : AppColors.success600,
              ),
            ],
          ),
        );
      case 'date':
        final c = _text.putIfAbsent(f.key, () => TextEditingController());
        return KDTextField(
          controller: c,
          hint: '${f.label}${f.isRequired ? ' *' : ''} (YYYY-MM-DD)',
          readOnly: true,
          onTap: () => _pickDate(f.key),
          suffixIcon: Icons.calendar_today_outlined,
          validator: (v) => f.isRequired && (v == null || v.trim().isEmpty) ? 'Required' : null,
        );
      case 'nin':
        return KDTextField(
          controller: _text[f.key],
          hint: '${f.label}${f.isRequired ? ' *' : ''} (11 digits)',
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
          validator: (v) {
            final t = v?.trim() ?? '';
            if (t.isEmpty && !f.isRequired) return null;
            return t.length == 11 ? null : 'Must be 11 digits';
          },
        );
      default:
        return KDTextField(
          controller: _text[f.key],
          hint: '${f.label}${f.isRequired ? ' *' : ''}',
          validator: (v) {
            final t = v?.trim() ?? '';
            if (t.isEmpty && f.isRequired) return 'Required';
            return null;
          },
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    // Group fields by their backend section, preserving the backend's order.
    final sections = <String, List<_BirthField>>{};
    for (final f in _fields) {
      sections.putIfAbsent(f.section, () => []).add(f);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Birth Attestation')),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
                  children: [
                    Text(
                      _price == null
                          ? 'Submit the details below for your birth attestation.'
                          : 'Service cost: ${AppFormatters.formatAmount(_price!)}',
                      style: context.textTheme.bodyMedium
                          ?.copyWith(color: AppColors.neutral500),
                    ),
                    for (final entry in sections.entries) ...[
                      Padding(
                        padding: const EdgeInsets.only(top: 22, bottom: 10),
                        child: Text(entry.key, style: context.textTheme.titleSmall),
                      ),
                      for (final f in entry.value)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _field(f),
                        ),
                    ],
                    const SizedBox(height: 8),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      value: _consent,
                      onChanged: (v) => setState(() => _consent = v ?? false),
                      title: const Text(
                        'I confirm the details above are accurate and I authorize MAJOR DATA-LINK to submit this Birth Attestation request to NPC on my behalf.',
                        style: TextStyle(fontSize: 12),
                      ),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(_error!, style: const TextStyle(color: AppColors.error600)),
                    ],
                    const SizedBox(height: 16),
                    KDButton(
                      label: 'Continue to PIN confirmation',
                      onPressed: _busy ? null : _submit,
                      isLoading: _busy,
                      gradient: AppColors.primaryGradient,
                    ),
                    const SizedBox(height: 24),
                    Text('My requests', style: context.textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (_history.isEmpty)
                      const Text('No birth attestation requests yet.',
                          style: TextStyle(color: AppColors.neutral500))
                    else
                      for (final h in _history)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: KDCard(
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(h['reference']?.toString() ?? '',
                                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                                ),
                                Text(h['status']?.toString() ?? '',
                                    style: const TextStyle(fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
      ),
    );
  }
}
