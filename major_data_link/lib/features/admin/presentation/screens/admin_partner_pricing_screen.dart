import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../data/admin_pricing_repository.dart';
import '../providers/admin_pricing_provider.dart';

/// Where an admin sets what API Partners are charged, service by service.
///
/// Mirrors the web admin's "Partner Pricing" page and writes the same field
/// (partnerSellingPriceKobo) through the same PATCH /admin/service-prices
/// endpoint - it never touches the retail selling price. A service with no
/// partner price falls back to the retail price on the backend, which is
/// what "Uses retail price" means below.
class AdminPartnerPricingScreen extends ConsumerStatefulWidget {
  const AdminPartnerPricingScreen({super.key});

  @override
  ConsumerState<AdminPartnerPricingScreen> createState() =>
      _AdminPartnerPricingScreenState();
}

class _AdminPartnerPricingScreenState
    extends ConsumerState<AdminPartnerPricingScreen> {
  bool _busy = false;
  String _query = '';

  Future<void> _edit(ServicePriceRow row) async {
    final result = await showDialog<_PartnerPriceResult>(
      context: context,
      builder: (_) => _PartnerPriceDialog(row: row),
    );
    if (result == null) return;

    setState(() => _busy = true);
    try {
      await ref.read(adminPricingRepositoryProvider).updateServicePriceRow(
            service: row.service,
            partnerSellingPrice: result.price,
            resetPartnerPrice: result.reset,
          );
      ref.invalidate(adminServicePricesProvider);
      if (mounted) {
        context.showSnackBar(
            result.reset ? 'Partner price cleared' : 'Partner price updated');
      }
    } catch (e) {
      if (mounted) context.showSnackBar(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final services = ref.watch(adminServicePricesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Partner Pricing')),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_busy) const LinearProgressIndicator(minHeight: 2),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                  AppDimensions.screenPaddingH, 12, AppDimensions.screenPaddingH, 0),
              child: TextField(
                onChanged: (v) =>
                    setState(() => _query = v.trim().toLowerCase()),
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: 'Search service (e.g. CAC, BVN, WAEC)',
                  isDense: true,
                ),
              ),
            ),
            Expanded(
              child: services.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            size: 40, color: AppColors.error500),
                        const SizedBox(height: 12),
                        Text(error.toString(), textAlign: TextAlign.center),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: () =>
                              ref.invalidate(adminServicePricesProvider),
                          child: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
                data: (allRows) {
                  final rows = _query.isEmpty
                      ? allRows
                      : allRows
                          .where((r) =>
                              r.label.toLowerCase().contains(_query) ||
                              r.group.toLowerCase().contains(_query) ||
                              r.service.toLowerCase().contains(_query))
                          .toList();
                  if (rows.isEmpty) {
                    return const Center(child: Text('No services found'));
                  }
                  return RefreshIndicator(
                    onRefresh: () async =>
                        ref.invalidate(adminServicePricesProvider),
                    child: ListView.separated(
                      padding:
                          const EdgeInsets.all(AppDimensions.screenPaddingH),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, index) {
                        final row = rows[index];
                        final retail = row.sellingPrice ?? row.providerCost;
                        final partner = row.partnerSellingPrice;
                        return KDCard(
                          padding: const EdgeInsets.all(14),
                          onTap: _busy ? null : () => _edit(row),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (row.group.isNotEmpty) ...[
                                Text(
                                  row.group.toUpperCase(),
                                  style: context.textTheme.labelSmall?.copyWith(
                                    color: AppColors.neutral500,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.6,
                                  ),
                                ),
                                const SizedBox(height: 2),
                              ],
                              Text(
                                row.label,
                                style: context.textTheme.titleSmall
                                    ?.copyWith(fontWeight: FontWeight.w800),
                              ),
                              const SizedBox(height: 10),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Retail: NGN${retail.toStringAsFixed(0)}',
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(color: AppColors.neutral500),
                                  ),
                                  Text(
                                    partner == null
                                        ? 'Partner: uses retail price'
                                        : 'Partner: NGN${partner.toStringAsFixed(0)}',
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: partner == null
                                          ? AppColors.neutral500
                                          : AppColors.success700,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PartnerPriceResult {
  const _PartnerPriceResult({this.price, this.reset = false});
  final double? price;
  final bool reset;
}

class _PartnerPriceDialog extends StatefulWidget {
  const _PartnerPriceDialog({required this.row});
  final ServicePriceRow row;

  @override
  State<_PartnerPriceDialog> createState() => _PartnerPriceDialogState();
}

class _PartnerPriceDialogState extends State<_PartnerPriceDialog> {
  late final TextEditingController _controller;
  String? _error;

  @override
  void initState() {
    super.initState();
    final start = widget.row.partnerSellingPrice ??
        widget.row.sellingPrice ??
        widget.row.providerCost;
    _controller = TextEditingController(text: start.toStringAsFixed(0));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.row.label),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Provider cost NGN${widget.row.providerCost.toStringAsFixed(0)} · '
            'Retail NGN${(widget.row.sellingPrice ?? widget.row.providerCost).toStringAsFixed(0)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Partner price (NGN)',
              errorText: _error,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context)
              .pop(const _PartnerPriceResult(reset: true)),
          child: const Text('Use retail'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final price = double.tryParse(_controller.text.trim());
            if (price == null || price <= 0) {
              setState(() => _error = 'Enter a price above 0');
              return;
            }
            Navigator.of(context).pop(_PartnerPriceResult(price: price));
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
