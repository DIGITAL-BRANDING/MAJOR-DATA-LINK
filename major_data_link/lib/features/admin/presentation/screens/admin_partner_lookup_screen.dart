import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../data/admin_pricing_repository.dart';
import '../providers/admin_pricing_provider.dart';

/// "Who is this partner, what have they called, what's in their wallet" -
/// the app twin of the web admin's Partner Lookup page. Read-only: it uses
/// the same finder and activity numbers as the web page and the partner's own
/// portal dashboard, so all three always agree. Wallet credit/debit stays on
/// the web panel (finance-only there).
class AdminPartnerLookupScreen extends ConsumerStatefulWidget {
  const AdminPartnerLookupScreen({super.key});

  @override
  ConsumerState<AdminPartnerLookupScreen> createState() =>
      _AdminPartnerLookupScreenState();
}

class _AdminPartnerLookupScreenState
    extends ConsumerState<AdminPartnerLookupScreen> {
  final _controller = TextEditingController();
  String _submitted = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _search() {
    final q = _controller.text.trim();
    if (q.length < 2) {
      context.showSnackBar('Enter at least 2 characters', isError: true);
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() => _submitted = q);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Partner Lookup')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          children: [
            TextField(
              controller: _controller,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _search(),
              decoration: InputDecoration(
                hintText: 'Business name, email, phone, account no. or ID',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward_rounded),
                  onPressed: _search,
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_submitted.isEmpty)
              Text(
                'Search for a partner to see their wallet, API usage and recent calls.',
                style: context.textTheme.bodySmall
                    ?.copyWith(color: AppColors.neutral500),
              )
            else
              ref.watch(adminPartnerLookupProvider(_submitted)).when(
                    loading: () => const Padding(
                      padding: EdgeInsets.only(top: 40),
                      child: Center(child: CircularProgressIndicator()),
                    ),
                    error: (e, _) => Column(
                      children: [
                        Text(e.toString(), textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: () => ref.invalidate(
                              adminPartnerLookupProvider(_submitted)),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                    data: (result) => result == null
                        ? Padding(
                            padding: const EdgeInsets.only(top: 24),
                            child: Center(
                              child: Text('No partner matched "$_submitted"'),
                            ),
                          )
                        : _PartnerDetails(result: result),
                  ),
          ],
        ),
      ),
    );
  }
}

String _naira(double v) {
  final fixed = v.toStringAsFixed(2);
  final parts = fixed.split('.');
  final whole = parts[0].replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  return 'NGN$whole.${parts[1]}';
}

String _when(DateTime? d) {
  if (d == null || d.millisecondsSinceEpoch == 0) return '-';
  final l = d.toLocal();
  String two(int n) => n.toString().padLeft(2, '0');
  return '${two(l.day)}/${two(l.month)}/${l.year} ${two(l.hour)}:${two(l.minute)}';
}

class _PartnerDetails extends StatelessWidget {
  const _PartnerDetails({required this.result});
  final PartnerLookupResult result;

  @override
  Widget build(BuildContext context) {
    final r = result;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KDCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      r.businessName,
                      style: context.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                  _Chip(
                    text: r.status,
                    good: r.status.toUpperCase() == 'ACTIVE' ||
                        r.status.toUpperCase() == 'APPROVED',
                  ),
                ],
              ),
              const SizedBox(height: 8),
              _Line('Email', r.email),
              _Line('Phone', r.phone),
              _Line(
                'Funding account',
                r.virtualAccountNumber == null
                    ? 'Not generated'
                    : '${r.virtualAccountNumber} (${r.virtualAccountBank ?? '-'})',
              ),
              _Line('Last portal login', _when(r.lastPortalLoginAt)),
              _Line('API keys',
                  '${r.activeApiKeys} active / ${r.revokedApiKeys} revoked'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        KDCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Wallet balance',
                  style: context.textTheme.bodySmall
                      ?.copyWith(color: AppColors.neutral500)),
              const SizedBox(height: 2),
              Text(
                _naira(r.walletBalance),
                style: context.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w900),
              ),
              const Divider(height: 24),
              _Line('Calls today', '${r.todayCalls}'),
              _Line('Calls all-time', '${r.totalCalls}'),
              _Line('Successful', '${r.successfulCalls}'),
              _Line('Failed', '${r.failedCalls}'),
              _Line('Total spend', _naira(r.totalSpend)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text('Recent activity',
            style: context.textTheme.titleSmall
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (r.recent.isEmpty)
          Text('No transactions yet',
              style: context.textTheme.bodySmall
                  ?.copyWith(color: AppColors.neutral500))
        else
          ...r.recent.map(
            (t) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: KDCard(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            t.description.isEmpty ? t.type : t.description,
                            style: context.textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                        ),
                        Text(_naira(t.amount),
                            style: context.textTheme.bodyMedium
                                ?.copyWith(fontWeight: FontWeight.w800)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        _Chip(text: t.status, good: t.status.toUpperCase() == 'SUCCESS'),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${t.reference} · ${_when(t.createdAt)}',
                            style: context.textTheme.bodySmall
                                ?.copyWith(color: AppColors.neutral500),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 120,
              child: Text(label,
                  style: context.textTheme.bodySmall
                      ?.copyWith(color: AppColors.neutral500)),
            ),
            Expanded(
              child: Text(value,
                  style: context.textTheme.bodySmall
                      ?.copyWith(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.text, required this.good});
  final String text;
  final bool good;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: good ? AppColors.success50 : AppColors.neutral100,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: good ? AppColors.success700 : AppColors.neutral500,
          ),
        ),
      );
}
