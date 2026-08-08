import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../data/admin_pricing_repository.dart';
import '../providers/admin_pricing_provider.dart';

class AdminServicePricingScreen extends ConsumerStatefulWidget {
  const AdminServicePricingScreen({super.key});

  @override
  ConsumerState<AdminServicePricingScreen> createState() =>
      _AdminServicePricingScreenState();
}

class _AdminServicePricingScreenState
    extends ConsumerState<AdminServicePricingScreen> {
  bool _busy = false;

  Future<void> _editPrice(ServicePriceRow row) async {
    final result = await showDialog<_ServicePriceEditResult>(
      context: context,
      builder: (_) => _ServicePriceDialog(row: row),
    );
    if (result == null) return;

    setState(() => _busy = true);
    try {
      await ref.read(adminPricingRepositoryProvider).updateServicePriceRow(
            service: row.service,
            sellingPrice: result.sellingPrice,
            providerCost: result.providerCost,
            isActive: result.isActive,
            resetToDefault: result.resetToDefault,
          );
      ref.invalidate(adminServicePricesProvider);
      if (mounted) context.showSnackBar('Price updated');
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
      appBar: AppBar(title: const Text('Service Pricing')),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            if (_busy) const LinearProgressIndicator(minHeight: 2),
            Expanded(
              child: services.when(
                loading: () =>
                    const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(adminServicePricesProvider),
                ),
                data: (rows) {
                  if (rows.isEmpty) {
                    return const Center(child: Text('No services found'));
                  }
                  return RefreshIndicator(
                    onRefresh: () async =>
                        ref.invalidate(adminServicePricesProvider),
                    child: ListView.separated(
                      padding: const EdgeInsets.all(
                        AppDimensions.screenPaddingH,
                      ),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, index) {
                        final row = rows[index];
                        final profit =
                            (row.sellingPrice ?? row.providerCost) -
                                row.providerCost;
                        return KDCard(
                          padding: const EdgeInsets.all(14),
                          onTap: _busy ? null : () => _editPrice(row),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      row.label,
                                      style: context.textTheme.titleSmall
                                          ?.copyWith(
                                              fontWeight: FontWeight.w800),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: row.isActive
                                          ? AppColors.success50
                                          : AppColors.neutral100,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      row.isActive ? 'Active' : 'Hidden',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: row.isActive
                                            ? AppColors.success700
                                            : AppColors.neutral500,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Cost: NGN${row.providerCost.toStringAsFixed(0)}',
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(
                                            color: AppColors.neutral500),
                                  ),
                                  Text(
                                    'Sells: NGN${(row.sellingPrice ?? row.providerCost).toStringAsFixed(0)}',
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  Text(
                                    'Profit: NGN${profit.toStringAsFixed(0)}',
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(
                                      fontWeight: FontWeight.w700,
                                      color: profit >= 0
                                          ? AppColors.success700
                                          : AppColors.error700,
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

class _ServicePriceEditResult {
  const _ServicePriceEditResult({
    this.sellingPrice,
    this.providerCost,
    this.isActive,
    this.resetToDefault = false,
  });

  final double? sellingPrice;
  final double? providerCost;
  final bool? isActive;
  final bool resetToDefault;
}

class _ServicePriceDialog extends StatefulWidget {
  const _ServicePriceDialog({required this.row});
  final ServicePriceRow row;

  @override
  State<_ServicePriceDialog> createState() => _ServicePriceDialogState();
}

class _ServicePriceDialogState extends State<_ServicePriceDialog> {
  late final TextEditingController _sellingController;
  late final TextEditingController _costController;
  late bool _active;

  @override
  void initState() {
    super.initState();
    _sellingController = TextEditingController(
      text: (widget.row.sellingPrice ?? widget.row.providerCost)
          .toStringAsFixed(0),
    );
    _costController = TextEditingController(
      text: widget.row.providerCost.toStringAsFixed(0),
    );
    _active = widget.row.isActive;
  }

  @override
  void dispose() {
    _sellingController.dispose();
    _costController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.row.label),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _sellingController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Selling price'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _costController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Provider cost'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _active,
            onChanged: (value) => setState(() => _active = value),
            title: const Text('Visible to users'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(
            const _ServicePriceEditResult(resetToDefault: true),
          ),
          child: const Text('Use default'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final selling = double.tryParse(_sellingController.text.trim());
            final cost = double.tryParse(_costController.text.trim());
            if (selling == null || selling <= 0) return;
            Navigator.of(context).pop(
              _ServicePriceEditResult(
                sellingPrice: selling,
                providerCost: cost,
                isActive: _active,
              ),
            );
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                size: 40, color: AppColors.error500),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
