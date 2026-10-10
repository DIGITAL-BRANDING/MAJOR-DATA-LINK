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

/// Business name registration with the CAC. Mirrors the web CacServicesPage:
/// same endpoints (/cac/prices, /cac/history, /cac/submit), same fields, same
/// four document slots, same 4 MB limit and the same consent wording.
/// LLC is intentionally not offered - the web app says it is quote-on-request.
class CacRegistrationScreen extends ConsumerStatefulWidget {
  const CacRegistrationScreen({super.key});

  @override
  ConsumerState<CacRegistrationScreen> createState() =>
      _CacRegistrationScreenState();
}

const _cacDocumentLabels = <String>[
  'Valid ID document(s)',
  'Passport photograph(s)',
  'Proof of address',
  'Signature specimen(s)',
];

class _CacDocument {
  const _CacDocument({
    required this.label,
    required this.name,
    required this.mimeType,
    required this.base64,
  });
  final String label;
  final String name;
  final String mimeType;
  final String base64;
}

class _CacRegistrationScreenState extends ConsumerState<CacRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name1 = TextEditingController();
  final _name2 = TextEditingController();
  final _nature = TextEditingController();
  final _businessAddress = TextEditingController();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _residentialAddress = TextEditingController();
  final _dob = TextEditingController();
  final _nin = TextEditingController();

  String _service = 'sole';
  String? _gender;
  bool _consent = false;
  bool _busy = false;
  bool _loadingHistory = true;
  String? _error;
  final Map<String, _CacDocument> _documents = {};
  final Map<String, double> _prices = {};
  List<Map<String, dynamic>> _history = const [];

  @override
  void initState() {
    super.initState();
    _loadPrices();
    _loadHistory();
  }

  @override
  void dispose() {
    for (final c in [
      _name1, _name2, _nature, _businessAddress, _fullName, _phone, _email,
      _residentialAddress, _dob, _nin,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  double? get _price => _prices[_service];

  Future<void> _loadPrices() async {
    try {
      final r = await ref.read(dioClientProvider).get(AppEndpoints.cacPrices);
      final rows = (r.data['data'] as List? ?? const []);
      if (!mounted) return;
      setState(() {
        for (final row in rows) {
          final m = Map<String, dynamic>.from(row as Map);
          final type = m['type']?.toString();
          final price = m['unitPrice'] ?? m['unit_price'];
          if (type != null && price is num) _prices[type] = price.toDouble();
        }
      });
    } catch (_) {/* price stays hidden; submit still goes through the backend */}
  }

  Future<void> _loadHistory() async {
    try {
      final r = await ref.read(dioClientProvider).get(AppEndpoints.cacHistory);
      if (!mounted) return;
      setState(() {
        _history = (r.data['data'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loadingHistory = false);
    }
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 30),
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked == null) return;
    _dob.text =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
  }

  Future<void> _pickDocument(String label) async {
    final picked = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
      withData: true,
    );
    final file = picked?.files.single;
    final bytes = file?.bytes;
    if (file == null || bytes == null) return;
    if (bytes.length > 4 * 1024 * 1024) {
      setState(() => _error = 'Each document must be under 4MB.');
      return;
    }
    final ext = (file.extension ?? '').toLowerCase();
    final mime = ext == 'pdf'
        ? 'application/pdf'
        : ext == 'png'
            ? 'image/png'
            : 'image/jpeg';
    setState(() {
      _error = null;
      _documents[label] = _CacDocument(
        label: label,
        name: file.name,
        mimeType: mime,
        base64: base64Encode(bytes),
      );
    });
  }

  String? _required(String? v, {int min = 1, int? exact}) {
    final t = v?.trim() ?? '';
    if (t.isEmpty) return 'Required';
    if (exact != null && t.length != exact) return 'Must be $exact digits';
    if (t.length < min) return 'Too short';
    return null;
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_gender == null || _dob.text.isEmpty) {
      setState(() => _error = 'Select your date of birth and gender.');
      return;
    }
    if (!_consent) {
      setState(() => _error = 'Please tick the consent box before continuing.');
      return;
    }
    context.hideKeyboard();
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm CAC registration',
      subtitle: _price == null
          ? 'Confirm this request'
          : 'Confirm ${AppFormatters.formatAmount(_price!)}',
    );
    if (pin == null || !mounted) return;

    setState(() => _busy = true);
    try {
      final body = <String, dynamic>{
        'cac_type': _service,
        'proposed_name_1': _name1.text.trim(),
        if (_name2.text.trim().isNotEmpty) 'proposed_name_2': _name2.text.trim(),
        'business_nature': _nature.text.trim(),
        'business_address': _businessAddress.text.trim(),
        'proprietor_full_name': _fullName.text.trim(),
        'proprietor_phone': _phone.text.trim(),
        'proprietor_email': _email.text.trim(),
        'proprietor_residential_address': _residentialAddress.text.trim(),
        'proprietor_date_of_birth': _dob.text.trim(),
        'proprietor_gender': _gender,
        'proprietor_nin': _nin.text.trim(),
        if (_documents.isNotEmpty)
          'supporting_documents': _documents.values
              .map((d) => {
                    'label': d.label,
                    'name': d.name,
                    'mime_type': d.mimeType,
                    'base64': d.base64,
                  })
              .toList(),
        'pin': pin,
      };
      final r = await ref.read(dioClientProvider).post(
            AppEndpoints.cacSubmit,
            data: body,
            options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
          );
      if (!mounted) return;
      final message = r.data['message']?.toString() ?? 'Request submitted.';
      final reference = (r.data['data'] as Map?)?['reference']?.toString();
      _resetForm();
      context.showSnackBar(reference == null ? message : '$message Ref: $reference');
      _loadHistory();
    } on DioException catch (e) {
      final data = e.response?.data;
      setState(() => _error = data is Map && data['message'] != null
          ? data['message'].toString()
          : 'Request failed. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _resetForm() {
    for (final c in [
      _name1, _name2, _nature, _businessAddress, _fullName, _phone, _email,
      _residentialAddress, _dob, _nin,
    ]) {
      c.clear();
    }
    setState(() {
      _service = 'sole';
      _gender = null;
      _consent = false;
      _documents.clear();
    });
  }

  Widget _sectionTitle(String t) => Padding(
        padding: const EdgeInsets.only(top: 22, bottom: 10),
        child: Text(t, style: context.textTheme.titleSmall),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CAC Services')),
      body: SafeArea(
        top: false,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            children: [
              Text('Business name registration',
                  style: context.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                _price == null
                    ? 'Service cost: loading…'
                    : 'Service cost: ${AppFormatters.formatAmount(_price!)}',
                style: const TextStyle(color: AppColors.neutral500),
              ),
              _sectionTitle('Registration type'),
              Wrap(
                spacing: 8,
                children: [
                  ChoiceChip(
                    label: const Text('Sole proprietorship'),
                    selected: _service == 'sole',
                    onSelected: (_) => setState(() => _service = 'sole'),
                  ),
                  ChoiceChip(
                    label: const Text('Partnership'),
                    selected: _service == 'partnership',
                    onSelected: (_) => setState(() => _service = 'partnership'),
                  ),
                ],
              ),
              _sectionTitle('Business names'),
              KDTextField(
                controller: _name1,
                hint: 'Option 1, e.g. Amana Traders',
                validator: (v) => _required(v, min: 2),
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _name2,
                hint: 'Option 2 (optional)',
              ),
              _sectionTitle('Business details'),
              KDTextField(
                controller: _nature,
                hint: 'Nature of business, e.g. Retail of electronics',
                validator: (v) => _required(v, min: 2),
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _businessAddress,
                hint: 'Business address',
                validator: (v) => _required(v, min: 3),
              ),
              _sectionTitle('Proprietor'),
              KDTextField(
                controller: _fullName,
                hint: 'Full name',
                validator: (v) => _required(v, min: 2),
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _phone,
                hint: 'Phone (11 digits)',
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                validator: (v) => _required(v, exact: 11),
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _email,
                hint: 'Email',
                keyboardType: TextInputType.emailAddress,
                validator: (v) => (v != null && v.contains('@') && v.contains('.')) ? null : 'Enter a valid email',
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _residentialAddress,
                hint: 'Residential address',
                validator: (v) => _required(v, min: 3),
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _dob,
                hint: 'Date of birth',
                readOnly: true,
                onTap: _pickDob,
                suffixIcon: Icons.calendar_today_outlined,
                validator: (v) => _required(v),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: _gender,
                decoration: const InputDecoration(labelText: 'Gender'),
                items: const [
                  DropdownMenuItem(value: 'Male', child: Text('Male')),
                  DropdownMenuItem(value: 'Female', child: Text('Female')),
                ],
                onChanged: (v) => setState(() => _gender = v),
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _nin,
                hint: 'NIN (11 digits)',
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(11)],
                validator: (v) => _required(v, exact: 11),
              ),
              _sectionTitle('Supporting documents'),
              Text('PDF, JPG or PNG, up to 4MB each. Available to the CAC admin only.',
                  style: context.textTheme.bodySmall
                      ?.copyWith(color: AppColors.neutral500)),
              const SizedBox(height: 10),
              for (final label in _cacDocumentLabels)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: KDCard(
                    onTap: _busy ? null : () => _pickDocument(label),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
                              const SizedBox(height: 2),
                              Text(
                                _documents[label]?.name ?? 'Tap to choose a file',
                                style: const TextStyle(fontSize: 12, color: AppColors.neutral500),
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          _documents[label] == null
                              ? Icons.upload_file_outlined
                              : Icons.check_circle_rounded,
                          color: _documents[label] == null
                              ? AppColors.neutral500
                              : AppColors.success600,
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 8),
              CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                controlAffinity: ListTileControlAffinity.leading,
                value: _consent,
                onChanged: (v) => setState(() => _consent = v ?? false),
                title: const Text(
                  'I confirm the details above are accurate and I authorize MAJOR DATA-LINK to file this registration with the Corporate Affairs Commission on my behalf.',
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
              _sectionTitle('My CAC requests'),
              if (_loadingHistory)
                const Center(child: CircularProgressIndicator())
              else if (_history.isEmpty)
                const Text('No CAC requests yet.',
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
