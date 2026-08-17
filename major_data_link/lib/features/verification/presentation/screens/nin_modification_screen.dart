import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/network/dio_client.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

class NinModificationScreen extends ConsumerStatefulWidget {
  const NinModificationScreen({super.key});
  @override
  ConsumerState<NinModificationScreen> createState() =>
      _NinModificationScreenState();
}

class _NinModificationScreenState extends ConsumerState<NinModificationScreen> {
  List<Map<String, dynamic>> _types = [];
  Map<String, double> _prices = {};
  Map<String, String> _values = {};
  String? _type, _docName, _error;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final dio = ref.read(dioProvider);
      final r = await Future.wait([
        dio.get(AppEndpoints.ninModificationTypes),
        dio.get(AppEndpoints.ninModificationPrices),
      ]);
      setState(() {
        _types = List<Map<String, dynamic>>.from(r[0].data['data'] ?? []);
        for (final p in r[1].data['data'] ?? [])
          _prices[p['type'].toString()] =
              double.tryParse(p['unitPrice'].toString()) ?? 0;
      });
    } catch (_) {
      setState(() => _error = 'Unable to load NIN modification services.');
    }
  }

  Future<void> _pick() async {
    final f = await FilePicker.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    final file = f?.files.single;
    if (file?.bytes == null) return;
    setState(() => _values['document_base64'] = base64Encode(file!.bytes!));
    setState(() => _docName = file.name);
  }

  Future<void> _submit() async {
    if (_type == null) return;
    final type = _types.firstWhere((e) => e['id'] == _type);
    for (final field in type['fields'] as List) {
      if (field['required'] == true && (_values[field['key']] ?? '').isEmpty) {
        setState(() => _error = '${field['label']} is required');
        return;
      }
    }
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm NIN modification — ₦${(_prices[_type] ?? 0).toStringAsFixed(0)}',
    );
    if (pin == null) return;
    setState(() => _busy = true);
    try {
      final body = Map<String, dynamic>.from(_values)..['pin'] = pin;
      final r = await ref
          .read(dioProvider)
          .post(AppEndpoints.ninModificationSubmit(_type!), data: body);
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              r.data['message']?.toString() ?? 'Request submitted.',
            ),
          ),
        );
      setState(() {
        _values = {};
        _docName = null;
      });
    } on DioException catch (e) {
      setState(
        () => _error =
            e.response?.data?['message']?.toString() ?? 'Request failed.',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final selected = _type == null
        ? null
        : _types
              .where((e) => e['id'] == _type)
              .cast<Map<String, dynamic>>()
              .firstOrNull;
    return Scaffold(
      appBar: AppBar(title: const Text('NIN Modification')),
      body: _types.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Select the update you need. This request is reviewed manually.',
                  style: TextStyle(fontSize: 15),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  value: _type,
                  decoration: const InputDecoration(
                    labelText: 'Modification type',
                  ),
                  items: _types
                      .map(
                        (t) => DropdownMenuItem(
                          value: t['id'].toString(),
                          child: Text(
                            '${t['title']} — ₦${(_prices[t['id']] ?? 0).toStringAsFixed(0)}',
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() {
                    _type = v;
                    _values = {};
                    _docName = null;
                  }),
                ),
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      _error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                if (selected != null) ...[
                  const SizedBox(height: 16),
                  ...((selected['fields'] as List).map((f) {
                    final key = f['key'].toString();
                    if (f['input'] == 'document')
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(f['label']),
                        subtitle: Text(_docName ?? 'PDF/JPG/PNG, optional'),
                        trailing: OutlinedButton(
                          onPressed: _pick,
                          child: const Text('Attach'),
                        ),
                      );
                    if (f['input'] == 'select')
                      return DropdownButtonFormField<String>(
                        value: _values[key]?.isEmpty ?? true
                            ? null
                            : _values[key],
                        decoration: InputDecoration(labelText: f['label']),
                        items: (f['options'] as List)
                            .map(
                              (o) => DropdownMenuItem(
                                value: o.toString(),
                                child: Text(o.toString()),
                              ),
                            )
                            .toList(),
                        onChanged: (v) => _values[key] = v ?? '',
                      );
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TextFormField(
                        initialValue: _values[key],
                        onChanged: (v) => _values[key] = v,
                        keyboardType:
                            f['input'] == 'phone' || f['input'] == 'nin'
                            ? TextInputType.number
                            : TextInputType.text,
                        decoration: InputDecoration(labelText: f['label']),
                      ),
                    );
                  })),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'Submitting…' : 'Submit request'),
                  ),
                ],
              ],
            ),
    );
  }
}
