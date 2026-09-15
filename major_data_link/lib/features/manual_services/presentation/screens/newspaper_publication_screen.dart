import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
import '../../../verification/utils/slip_pdf_utils.dart';

class _Field {
  const _Field(this.key, this.label, this.required);
  final String key;
  final String label;
  final bool required;
  factory _Field.fromJson(Map<String, dynamic> json) => _Field(
    json['key'].toString(),
    json['label'].toString(),
    json['required'] == true,
  );
}

class _History {
  const _History(this.reference, this.status, this.date, this.pdf);
  final String reference, status, date;
  final String? pdf;
  factory _History.fromJson(Map<String, dynamic> json) => _History(
    json['reference'].toString(),
    json['status'].toString(),
    json['created_at'].toString(),
    json['pdf_base64']?.toString(),
  );
}

class NewspaperPublicationScreen extends ConsumerStatefulWidget {
  const NewspaperPublicationScreen({super.key});
  @override
  ConsumerState<NewspaperPublicationScreen> createState() =>
      _NewspaperPublicationScreenState();
}

class _NewspaperPublicationScreenState
    extends ConsumerState<NewspaperPublicationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _controllers = <String, TextEditingController>{};
  List<_Field> _fields = [];
  List<_History> _history = [];
  double? _price;
  bool _loading = true, _busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dio = ref.read(dioClientProvider);
      final results = await Future.wait([
        dio.get(AppEndpoints.newspaperFields),
        dio.get(AppEndpoints.newspaperPrice),
        dio.get(AppEndpoints.newspaperHistory),
      ]);
      final fields = ((results[0].data['data'] ?? []) as List)
          .map((e) => _Field.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      for (final field in fields) {
        _controllers.putIfAbsent(field.key, TextEditingController.new);
      }
      if (mounted)
        setState(() {
          _fields = fields;
          _price = (results[1].data['data']['unit_price'] as num).toDouble();
          _history = ((results[2].data['data'] ?? []) as List)
              .map((e) => _History.fromJson(Map<String, dynamic>.from(e)))
              .toList();
        });
    } catch (_) {
      if (mounted)
        context.showSnackBar(
          'Unable to load Newspaper Publication. Please try again.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm Newspaper Publication',
      subtitle:
          'Confirm ${_price == null ? 'this request' : AppFormatters.formatAmount(_price!)}',
    );
    if (pin == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final data = <String, dynamic>{
        for (final e in _controllers.entries) e.key: e.value.text.trim(),
        'pin': pin,
      };
      final r = await ref
          .read(dioClientProvider)
          .post(AppEndpoints.newspaperSubmit, data: data);
      if (!mounted) return;
      for (final c in _controllers.values) {
        c.clear();
      }
      context.showSnackBar(
        '${r.data['message']} Reference: ${r.data['data']['reference']}',
      );
      await _load();
    } catch (_) {
      if (mounted)
        context.showSnackBar(
          'Request failed. Please try again.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<_Field> _group(String prefix) =>
      _fields.where((f) => f.key.startsWith(prefix)).toList();
  Widget _fieldGroup(String title, List<_Field> fields) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
      const SizedBox(height: 12),
      ...fields.expand(
        (f) => [
          KDTextField(
            controller: _controllers[f.key]!,
            label: '${f.label}${f.required ? ' *' : ''}',
            validator: f.required
                ? (v) => (v == null || v.trim().isEmpty)
                      ? 'This field is required'
                      : null
                : null,
          ),
          const SizedBox(height: 14),
        ],
      ),
    ],
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Newspaper Publication')),
    body: SafeArea(
      top: false,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
                children: [
                  KDCard(
                    backgroundColor: AppColors.primary50,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.newspaper_outlined,
                          color: AppColors.primary600,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Name Change Publication',
                          style: context.textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        const Text(
                          'Name only or Name & DoB publication. Submit before 5:30pm, Monday to Friday. Processing takes about 20 hours.',
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _price == null
                              ? 'Service cost: Loading…'
                              : 'Service cost: ${AppFormatters.formatAmount(_price!)}',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _fieldGroup('Old details', _group('old_')),
                        const SizedBox(height: 8),
                        _fieldGroup('New details', _group('new_')),
                        const SizedBox(height: 10),
                        KDButton(
                          label: 'Continue to PIN confirmation',
                          isLoading: _busy,
                          onPressed: _fields.isEmpty ? null : _submit,
                          gradient: AppColors.primaryGradient,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 28),
                  Text(
                    'Recent requests',
                    style: context.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_history.isEmpty)
                    const Text('No requests yet.')
                  else
                    ..._history.map(
                      (h) => Card(
                        child: ListTile(
                          title: Text(h.reference),
                          subtitle: Text(
                            '${h.status == 'pending' ? 'Under review' : h.status} · ${h.date}',
                          ),
                          trailing: h.pdf == null
                              ? null
                              : IconButton(
                                  icon: const Icon(
                                    Icons.picture_as_pdf_outlined,
                                  ),
                                  tooltip: 'Share PDF',
                                  onPressed: () =>
                                      SlipPdfUtils.share(h.pdf!, h.reference),
                                ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    ),
  );
}
