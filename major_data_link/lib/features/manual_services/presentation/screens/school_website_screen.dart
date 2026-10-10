import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
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

/// School website (EduTrac) subscriptions - same endpoints and rules as the
/// web SchoolWebsitePage: plans come from /school-website/plans, purchase goes
/// to /school-website/subscribe with the PIN and an idempotency key.
class SchoolWebsiteScreen extends ConsumerStatefulWidget {
  const SchoolWebsiteScreen({super.key});

  @override
  ConsumerState<SchoolWebsiteScreen> createState() =>
      _SchoolWebsiteScreenState();
}

const _demoUrl = 'https://edutracng.netlify.app/';

class _Plan {
  const _Plan({required this.plan, required this.label, required this.price, required this.active});
  final String plan;
  final String label;
  final double price;
  final bool active;

  factory _Plan.fromJson(Map<String, dynamic> j) => _Plan(
        plan: j['plan']?.toString() ?? '',
        label: j['label']?.toString() ?? '',
        price: (j['unit_price'] as num?)?.toDouble() ?? 0,
        active: j['is_active'] == true,
      );
}

class _SchoolWebsiteScreenState extends ConsumerState<SchoolWebsiteScreen> {
  final _formKey = GlobalKey<FormState>();
  final _schoolName = TextEditingController();
  final _contactPhone = TextEditingController();
  List<_Plan> _plans = const [];
  List<Map<String, dynamic>> _subscriptions = const [];
  String _selected = 'TERMLY';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _schoolName.dispose();
    _contactPhone.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final dio = ref.read(dioClientProvider);
    try {
      final r = await Future.wait([
        dio.get(AppEndpoints.schoolPlans),
        dio.get(AppEndpoints.schoolSubscriptions),
      ]);
      if (!mounted) return;
      setState(() {
        _plans = (r[0].data['data'] as List? ?? const [])
            .map((e) => _Plan.fromJson(Map<String, dynamic>.from(e as Map)))
            .toList();
        _subscriptions = (r[1].data['data'] as List? ?? const [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() { _loading = false; _error = 'Unable to load school website plans. Pull to retry.'; });
    }
  }

  Future<void> _openDemo() async {
    final ok = await launchUrl(Uri.parse(_demoUrl), mode: LaunchMode.externalApplication);
    if (!ok && mounted) context.showSnackBar('Could not open the sample.', isError: true);
  }

  Future<void> _purchase() async {
    setState(() => _error = null);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.hideKeyboard();
    final matches = _plans.where((p) => p.plan == _selected);
    final plan = matches.isEmpty ? null : matches.first;
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm school website',
      subtitle: plan == null ? 'Confirm this subscription' : 'Confirm ${AppFormatters.formatAmount(plan.price)}',
    );
    if (pin == null || !mounted) return;

    setState(() => _busy = true);
    try {
      final r = await ref.read(dioClientProvider).post(
            AppEndpoints.schoolSubscribe,
            data: {
              'plan': _selected,
              'school_name': _schoolName.text.trim(),
              'contact_phone': _contactPhone.text.trim(),
              'pin': pin,
            },
            options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
          );
      if (!mounted) return;
      _schoolName.clear();
      _contactPhone.clear();
      context.showSnackBar(r.data['message']?.toString() ?? 'Subscription request placed.');
      _load();
    } on DioException catch (e) {
      final data = e.response?.data;
      setState(() => _error = data is Map && data['message'] != null
          ? data['message'].toString()
          : 'Could not place this subscription request. Try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('School Website')),
      body: SafeArea(
        top: false,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : Form(
                key: _formKey,
                child: ListView(
                  padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
                  children: [
                    KDCard(
                      backgroundColor: AppColors.primary50,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('EduTrac School Management System',
                              style: context.textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          const Text(
                              'Explore the live sample, then request a subscription for your school.'),
                          const SizedBox(height: 12),
                          OutlinedButton.icon(
                            onPressed: _openDemo,
                            icon: const Icon(Icons.open_in_new_rounded, size: 18),
                            label: const Text('Open EduTrac sample'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text('Choose a subscription', style: context.textTheme.titleSmall),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final p in _plans)
                          ChoiceChip(
                            label: Text('${p.label} · ${AppFormatters.formatAmount(p.price)}'),
                            selected: _selected == p.plan,
                            onSelected: p.active ? (_) => setState(() => _selected = p.plan) : null,
                          ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    KDTextField(
                      controller: _schoolName,
                      hint: 'School name',
                      maxLength: 120,
                      validator: (v) => (v == null || v.trim().length < 2) ? 'Enter the school name' : null,
                    ),
                    const SizedBox(height: 10),
                    KDTextField(
                      controller: _contactPhone,
                      hint: 'Contact phone',
                      keyboardType: TextInputType.phone,
                      maxLength: 24,
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+\- ]'))],
                      validator: (v) => (v == null || v.trim().length < 7) ? 'Enter a valid phone number' : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 10),
                      Text(_error!, style: const TextStyle(color: AppColors.error600)),
                    ],
                    const SizedBox(height: 16),
                    KDButton(
                      label: 'Continue to PIN confirmation',
                      onPressed: _busy || !_plans.any((p) => p.plan == _selected && p.active)
                          ? null
                          : _purchase,
                      isLoading: _busy,
                      gradient: AppColors.primaryGradient,
                    ),
                    const SizedBox(height: 24),
                    Text('My subscriptions', style: context.textTheme.titleSmall),
                    const SizedBox(height: 8),
                    if (_subscriptions.isEmpty)
                      const Text('No subscriptions yet.',
                          style: TextStyle(color: AppColors.neutral500))
                    else
                      for (final s in _subscriptions)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: KDCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(s['plan']?.toString() ?? '',
                                          style: const TextStyle(fontWeight: FontWeight.w700)),
                                    ),
                                    Text(s['status']?.toString() ?? '',
                                        style: const TextStyle(fontWeight: FontWeight.w700)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(s['reference']?.toString() ?? '',
                                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                                if (s['expires_at'] != null)
                                  Text('Expires: ${s['expires_at']}',
                                      style: const TextStyle(fontSize: 12, color: AppColors.neutral500)),
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
