import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/security/secure_screen_mixin.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../providers/verification_provider.dart'
    show slipFlowProvider, VerificationHistoryItem;
import '../providers/nin_modification_provider.dart';

class NinModificationScreen extends ConsumerStatefulWidget {
  const NinModificationScreen({super.key});
  @override
  ConsumerState<NinModificationScreen> createState() =>
      _NinModificationScreenState();
}

class _NinModificationScreenState extends ConsumerState<NinModificationScreen>
    with SecureScreenMixin {
  ModificationTypeConfig? _selected;
  final _formKey = GlobalKey<FormState>();
  final _controllers = <String, TextEditingController>{};
  final _selectValues = <String, String?>{};
  String? _documentBase64;
  String? _documentName;
  bool _consentAsked = false;

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_consentAsked) {
      _consentAsked = true;
      WidgetsBinding.instance.addPostFrameCallback((_) => _askConsent());
    }
  }

  Future<void> _askConsent() async {
    final agreed = await _showConsentDialog(context);
    if (!mounted) return;
    if (agreed != true && mounted) context.pop();
  }

  void _pickType(ModificationTypeConfig type) {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
    _selectValues.clear();
    _documentBase64 = null;
    _documentName = null;
    for (final field in type.fields) {
      if (field.input == 'document') continue;
      _controllers[field.key] = TextEditingController();
      if (field.input == 'select') _selectValues[field.key] = null;
    }
    ref.read(slipFlowProvider.notifier).reset();
    setState(() => _selected = type);
  }

  Future<void> _pickDocument() async {
    try {
      final result = await FilePicker.pickFiles(
        withData: true,
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );
      final file = result?.files.first;
      final bytes = file?.bytes;
      if (file == null || bytes == null) return;
      if (bytes.lengthInBytes > 5 * 1024 * 1024) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('That file is too large — keep it under 5MB.'),
          ),
        );
        return;
      }
      setState(() {
        _documentBase64 = base64Encode(bytes);
        _documentName = file.name;
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Could not read file: $e')));
    }
  }

  Future<void> _submit(double price) async {
    if (_selected == null) return;
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();

    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm request',
      subtitle: '${_selected!.title} — ${price.toNaira}',
    );
    if (pin == null || !mounted) return;

    final values = <String, dynamic>{};
    for (final field in _selected!.fields) {
      if (field.input == 'document') {
        if (_documentBase64 != null) values[field.key] = _documentBase64;
        continue;
      }
      final raw = field.input == 'select'
          ? _selectValues[field.key]
          : _controllers[field.key]?.text.trim();
      if (raw != null && raw.isNotEmpty) values[field.key] = raw;
    }

    final result = await ref
        .read(slipFlowProvider.notifier)
        .submit(
          () => ref
              .read(ninModificationRemoteProvider)
              .submit(type: _selected!.id, values: values, pin: pin),
        );
    if (result != null && result.success) {
      ref.invalidate(modificationHistoryProvider(_selected!.id));
    }
  }

  void _startAnother() {
    ref.read(slipFlowProvider.notifier).reset();
    if (_selected != null) _pickType(_selected!);
  }

  @override
  Widget build(BuildContext context) {
    final types = ref.watch(modificationTypesProvider);
    final prices = ref.watch(modificationPricesProvider);
    final flow = ref.watch(slipFlowProvider);
    final selected = _selected;

    return Scaffold(
      appBar: AppBar(
        title: Text(selected == null ? 'NIN Modification' : selected.title),
      ),
      body: SafeArea(
        top: false,
        child: types.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, __) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Could not load modification types.\n$e'),
            ),
          ),
          data: (list) {
            if (selected == null) {
              return _TypeGrid(
                types: list,
                prices: prices.valueOrNull ?? const {},
                onSelect: _pickType,
              );
            }
            final price = prices.valueOrNull?[selected.id] ?? 0;
            return SingleChildScrollView(
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextButton.icon(
                    onPressed: () => setState(() => _selected = null),
                    icon: const Icon(Icons.arrow_back_rounded, size: 18),
                    label: const Text('All modification types'),
                  ),
                  const SizedBox(height: 8),
                  KDCard(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Service Cost'),
                        Text(
                          prices.isLoading ? '…' : price.toNaira,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (flow.result != null && flow.result!.success)
                    _SuccessCard(
                      reference: flow.result!.reference,
                      message: flow.result!.message,
                      onAnother: _startAnother,
                    )
                  else ...[
                    Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final field in selected.fields)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 16),
                              child: _FieldInput(
                                field: field,
                                controller: _controllers[field.key],
                                selectValue: _selectValues[field.key],
                                documentName: _documentName,
                                onSelectChanged: (v) => setState(
                                  () => _selectValues[field.key] = v,
                                ),
                                onPickDocument: _pickDocument,
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (flow.errorMessage != null) ...[
                      Text(
                        flow.errorMessage!,
                        style: const TextStyle(color: AppColors.error500),
                      ),
                      const SizedBox(height: 12),
                    ],
                    KDButton(
                      label: 'Submit Request — ${price.toNaira}',
                      isLoading: flow.isSubmitting,
                      onPressed: () => _submit(price),
                    ),
                  ],
                  const SizedBox(height: 24),
                  _ModificationHistoryCard(type: selected.id),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _TypeGrid extends StatelessWidget {
  const _TypeGrid({
    required this.types,
    required this.prices,
    required this.onSelect,
  });

  final List<ModificationTypeConfig> types;
  final Map<String, double> prices;
  final ValueChanged<ModificationTypeConfig> onSelect;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.95,
      ),
      itemCount: types.length,
      itemBuilder: (context, index) {
        final type = types[index];
        final price = prices[type.id];
        return KDCard(
          onTap: () => onSelect(type),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primary500.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.edit_document,
                  color: AppColors.primary600,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                type.title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                price == null ? '…' : price.toNaira,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: AppColors.primary700,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _FieldInput extends StatelessWidget {
  const _FieldInput({
    required this.field,
    required this.controller,
    required this.selectValue,
    required this.documentName,
    required this.onSelectChanged,
    required this.onPickDocument,
  });

  final ModificationField field;
  final TextEditingController? controller;
  final String? selectValue;
  final String? documentName;
  final ValueChanged<String?> onSelectChanged;
  final VoidCallback onPickDocument;

  String get _label =>
      field.required ? field.label : '${field.label} (optional)';

  @override
  Widget build(BuildContext context) {
    switch (field.input) {
      case 'select':
        return DropdownButtonFormField<String>(
          initialValue: selectValue,
          decoration: InputDecoration(
            labelText: _label,
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
          items: (field.options ?? const [])
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          validator: field.required
              ? (v) => (v == null || v.isEmpty) ? 'Required' : null
              : null,
          onChanged: onSelectChanged,
        );
      case 'document':
        return InkWell(
          onTap: onPickDocument,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
            decoration: BoxDecoration(
              border: Border.all(
                color: AppColors.neutral300,
                style: BorderStyle.solid,
              ),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.cloud_upload_outlined, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    documentName ?? 'Select Document (Optional)',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        );
      case 'date':
        return _DateField(label: _label, controller: controller!);
      case 'nin':
      case 'phone':
        return KDTextField(
          controller: controller,
          label: _label,
          hint: '11-digit number',
          keyboardType: TextInputType.number,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
            LengthLimitingTextInputFormatter(11),
          ],
          validator: (v) {
            if (!field.required && (v == null || v.isEmpty)) return null;
            return (v == null || v.trim().length != 11)
                ? 'Enter a valid 11-digit number'
                : null;
          },
        );
      default:
        return KDTextField(
          controller: controller,
          label: _label,
          validator: field.required
              ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null
              : null,
        );
    }
  }
}

class _DateField extends StatelessWidget {
  const _DateField({required this.label, required this.controller});
  final String label;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return KDTextField(
      controller: controller,
      label: label,
      readOnly: true,
      suffixIcon: Icons.calendar_today_outlined,
      validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
      onTap: () async {
        final now = DateTime.now();
        final picked = await showDatePicker(
          context: context,
          initialDate: DateTime(now.year - 25),
          firstDate: DateTime(1900),
          lastDate: now,
        );
        if (picked != null) {
          controller.text =
              '${picked.year.toString().padLeft(4, '0')}-'
              '${picked.month.toString().padLeft(2, '0')}-'
              '${picked.day.toString().padLeft(2, '0')}';
        }
      },
    );
  }
}

class _SuccessCard extends StatelessWidget {
  const _SuccessCard({
    required this.reference,
    required this.message,
    required this.onAnother,
  });

  final String reference;
  final String message;
  final VoidCallback onAnother;

  @override
  Widget build(BuildContext context) {
    return KDCard(
      child: Column(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            color: AppColors.success600,
            size: 40,
          ),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Text(
            'Reference: $reference',
            style: const TextStyle(fontSize: 12, color: AppColors.neutral500),
          ),
          const SizedBox(height: 16),
          KDButton(label: 'Submit another request', onPressed: onAnother),
        ],
      ),
    );
  }
}

class _ModificationHistoryCard extends ConsumerWidget {
  const _ModificationHistoryCard({required this.type});
  final String type;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(modificationHistoryProvider(type));
    return KDCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Recent requests', style: context.textTheme.titleSmall),
              const Spacer(),
              const Text(
                'Last 7 days',
                style: TextStyle(fontSize: 12, color: AppColors.neutral500),
              ),
              IconButton(
                tooltip: 'Refresh',
                onPressed: () =>
                    ref.invalidate(modificationHistoryProvider(type)),
                icon: const Icon(Icons.refresh_rounded, size: 20),
              ),
            ],
          ),
          history.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text('Could not load recent requests.'),
            ),
            data: (items) {
              if (items.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'No completed request for this type in the last 7 days.',
                  ),
                );
              }
              return Column(
                children: items
                    .map((item) => _HistoryRow(item: item))
                    .toList(growable: false),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.item});
  final VerificationHistoryItem item;

  Color get _statusColor => switch (item.status) {
    'success' => AppColors.success600,
    'failed' => AppColors.error500,
    _ => AppColors.warning600,
  };

  String get _statusLabel =>
      item.status == 'pending' ? 'Under review' : item.status;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.reference,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${item.createdAt.toLocal()}'.split('.').first,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.neutral500,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              _statusLabel,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: _statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Matches the web app's ModificationConsent.tsx verbatim — same terms,
/// same "I Agreed" / "Not Agreed" choice, shown once when entering this
/// screen (declining pops back to the NIN Services hub).
Future<bool?> _showConsentDialog(BuildContext context) {
  return showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (context) => Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxHeight: 560),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: Color(0xFF0369A1),
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
              child: const Text(
                'Consent & Authorization Agreement',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'If you are seeing this, you are chosen as an agent for '
                      'this service under the following circumstances. Read it '
                      'carefully; if you can abide by these terms, click on '
                      '"I Agreed." If not, click on "Not Agreed."',
                      style: TextStyle(fontSize: 13, height: 1.5),
                    ),
                    const SizedBox(height: 14),
                    ..._consentClauses.asMap().entries.map(
                      (entry) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          '${entry.key + 1}. ${entry.value}',
                          style: const TextStyle(fontSize: 13, height: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'I agree to the terms above and authorize this platform '
                      'to proceed with my NIN modification.',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Expanded(
                    child: KDButton(
                      label: 'Not Agreed',
                      backgroundColor: AppColors.error500,
                      onPressed: () => Navigator.of(context).pop(false),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: KDButton(
                      label: 'I Agreed',
                      backgroundColor: AppColors.success600,
                      onPressed: () => Navigator.of(context).pop(true),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

const _consentClauses = [
  'I authorize this platform and its agents to access and use my personal '
      'data, including my NIN, to process and modify my NIN record as '
      'requested.',
  'I understand this platform is not affiliated with NIMC, but I '
      'voluntarily authorize this platform and its trusted agents to help '
      'modify my NIN details on my behalf.',
  'NIMC recommends modifications be done personally by the NIN owner. By '
      'using this platform due to illiteracy or difficulty with the '
      'official portal, I voluntarily authorize the request to proceed on '
      'my behalf.',
  'I confirm that I am the NIN owner or have full consent and '
      'authorization from the NIN owner to act on their behalf.',
  'I agree to pay the fixed service fee and authorize the platform to use '
      'lawful methods necessary to complete the requested modification, '
      'including document upload where required.',
  'Alias emails may be used for modification login. If I prefer my own '
      'email, I will request an email update directly from NIMC after the '
      'modification is complete.',
  'Updates may reflect immediately on NIMC and immigration portals, but '
      'banks and SIM providers may delay synchronizing their records.',
  'Wallet funds are non-withdrawable. Failed services are refunded to the '
      'wallet only.',
  'I will not submit the same request on another platform while it is '
      'being processed here.',
  'This agreement applies to all past, current, and future modification '
      'requests submitted through this platform.',
  'If there is a delay, issue, or network failure from NIMC, I agree to '
      'wait until NIMC resolves the issue and not submit duplicate '
      'requests.',
];
