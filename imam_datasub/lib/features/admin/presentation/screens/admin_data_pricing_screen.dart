import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../buy_data/domain/entities/data_plan_entity.dart';
import '../../data/admin_pricing_repository.dart';
import '../providers/admin_pricing_provider.dart';

class AdminDataPricingScreen extends ConsumerStatefulWidget {
  const AdminDataPricingScreen({super.key});

  @override
  ConsumerState<AdminDataPricingScreen> createState() =>
      _AdminDataPricingScreenState();
}

class _AdminDataPricingScreenState
    extends ConsumerState<AdminDataPricingScreen> {
  NetworkProvider _network = NetworkProvider.mtn;
  bool _busy = false;

  Future<void> _sync() async {
    setState(() => _busy = true);
    try {
      await ref.read(adminPricingRepositoryProvider).syncDataPrices(_network);
      ref.invalidate(adminDataPricesProvider(_network));
      ref.invalidate(adminMeProvider);
      if (mounted) context.showSnackBar('Data prices synced');
    } catch (e) {
      if (mounted) context.showSnackBar(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _applyMarkup() async {
    final result = await showDialog<({double fixed, double percent})>(
      context: context,
      builder: (_) => const _MarkupDialog(),
    );
    if (result == null) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(adminPricingRepositoryProvider)
          .applyMarkup(
            network: _network,
            markupNaira: result.fixed,
            markupPercent: result.percent,
          );
      ref.invalidate(adminDataPricesProvider(_network));
      if (mounted) context.showSnackBar('Markup applied');
    } catch (e) {
      if (mounted) context.showSnackBar(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editPrice(DataPriceRow row) async {
    final result = await showDialog<_PriceEditResult>(
      context: context,
      builder: (_) => _PriceDialog(row: row),
    );
    if (result == null) return;

    setState(() => _busy = true);
    try {
      await ref
          .read(adminPricingRepositoryProvider)
          .updatePrice(
            id: row.id,
            sellingPrice: result.sellingPrice,
            isActive: result.isActive,
            resetToDefault: result.resetToDefault,
          );
      ref.invalidate(adminDataPricesProvider(_network));
      if (mounted) context.showSnackBar('Price updated');
    } catch (e) {
      if (mounted) context.showSnackBar(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final prices = ref.watch(adminDataPricesProvider(_network));
    final admin = ref.watch(adminMeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Data Pricing')),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  admin.maybeWhen(
                    data: (value) => value == null
                        ? const _AdminWarning()
                        : Text(
                            '${value.fullName} (${value.role})',
                            style: context.textTheme.bodySmall?.copyWith(
                              color: AppColors.neutral500,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                    orElse: () => const SizedBox.shrink(),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<NetworkProvider>(
                          value: _network,
                          decoration: const InputDecoration(
                            labelText: 'Network',
                          ),
                          items: NetworkProvider.values
                              .map(
                                (network) => DropdownMenuItem(
                                  value: network,
                                  child: Text(network.label),
                                ),
                              )
                              .toList(),
                          onChanged: _busy
                              ? null
                              : (value) {
                                  if (value == null) return;
                                  setState(() => _network = value);
                                },
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filledTonal(
                        tooltip: 'Sync provider plans',
                        onPressed: _busy ? null : _sync,
                        icon: const Icon(Icons.sync_rounded),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filledTonal(
                        tooltip: 'Apply markup',
                        onPressed: _busy ? null : _applyMarkup,
                        icon: const Icon(Icons.percent_rounded),
                      ),
                    ],
                  ),
                  if (_busy) const LinearProgressIndicator(minHeight: 2),
                ],
              ),
            ),
            Expanded(
              child: prices.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => _ErrorState(
                  message: error.toString(),
                  onRetry: () =>
                      ref.invalidate(adminDataPricesProvider(_network)),
                ),
                data: (rows) {
                  if (rows.isEmpty) {
                    return _EmptyState(onSync: _busy ? null : _sync);
                  }
                  return RefreshIndicator(
                    onRefresh: () async =>
                        ref.invalidate(adminDataPricesProvider(_network)),
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(
                        AppDimensions.screenPaddingH,
                        0,
                        AppDimensions.screenPaddingH,
                        AppDimensions.screenPaddingH,
                      ),
                      itemCount: rows.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (_, index) {
                        final row = rows[index];
                        return _PriceCard(
                          row: row,
                          onTap: _busy ? null : () => _editPrice(row),
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

class _PriceCard extends StatelessWidget {
  const _PriceCard({required this.row, required this.onTap});

  final DataPriceRow row;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final profitColor = row.profit >= 0
        ? AppColors.success700
        : AppColors.error700;
    return KDCard(
      padding: const EdgeInsets.all(14),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  row.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _StatusPill(active: row.isActive),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            [
              row.planType,
              row.validity,
              'Plan ${row.providerPlanId}',
            ].where((item) => item != null && item.isNotEmpty).join(' • '),
            style: context.textTheme.bodySmall?.copyWith(
              color: AppColors.neutral500,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MoneyStat(label: 'Cost', value: row.providerCost),
              ),
              Expanded(
                child: _MoneyStat(label: 'Sell', value: row.sellingPrice),
              ),
              Expanded(
                child: _MoneyStat(
                  label: 'Profit',
                  value: row.profit,
                  color: profitColor,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MoneyStat extends StatelessWidget {
  const _MoneyStat({required this.label, required this.value, this.color});

  final String label;
  final double value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: context.textTheme.labelSmall?.copyWith(
            color: AppColors.neutral500,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          'NGN ${value.toStringAsFixed(0)}',
          style: context.textTheme.bodyMedium?.copyWith(
            color: color,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: active ? AppColors.success50 : AppColors.error50,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        active ? 'Active' : 'Hidden',
        style: TextStyle(
          color: active ? AppColors.success700 : AppColors.error700,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _AdminWarning extends StatelessWidget {
  const _AdminWarning();

  @override
  Widget build(BuildContext context) {
    return Text(
      'Admin access was not confirmed for this account.',
      style: context.textTheme.bodySmall?.copyWith(color: AppColors.error700),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.onSync});

  final VoidCallback? onSync;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.price_change_outlined, size: 48),
            const SizedBox(height: 12),
            Text(
              'No prices yet',
              style: context.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            TextButton.icon(
              onPressed: onSync,
              icon: const Icon(Icons.sync_rounded),
              label: const Text('Sync plans'),
            ),
          ],
        ),
      ),
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
            const Icon(Icons.error_outline_rounded, size: 48),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

class _PriceEditResult {
  const _PriceEditResult({
    this.sellingPrice,
    this.isActive,
    this.resetToDefault = false,
  });

  final double? sellingPrice;
  final bool? isActive;
  final bool resetToDefault;
}

class _PriceDialog extends StatefulWidget {
  const _PriceDialog({required this.row});

  final DataPriceRow row;

  @override
  State<_PriceDialog> createState() => _PriceDialogState();
}

class _PriceDialogState extends State<_PriceDialog> {
  late final TextEditingController _controller;
  late bool _active;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.row.sellingPrice.toStringAsFixed(0),
    );
    _active = widget.row.isActive;
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Edit price'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            widget.row.name,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.number,
            decoration: InputDecoration(
              labelText: 'Selling price',
              helperText:
                  'Cost: NGN ${widget.row.providerCost.toStringAsFixed(0)}',
            ),
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
          onPressed: () => Navigator.of(
            context,
          ).pop(_PriceEditResult(isActive: _active, resetToDefault: true)),
          child: const Text('Use default'),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final price = double.tryParse(_controller.text.trim());
            if (price == null || price <= 0) return;
            Navigator.of(
              context,
            ).pop(_PriceEditResult(sellingPrice: price, isActive: _active));
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _MarkupDialog extends StatefulWidget {
  const _MarkupDialog();

  @override
  State<_MarkupDialog> createState() => _MarkupDialogState();
}

class _MarkupDialogState extends State<_MarkupDialog> {
  final _fixedController = TextEditingController(text: '15');
  final _percentController = TextEditingController(text: '0');

  @override
  void dispose() {
    _fixedController.dispose();
    _percentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Apply markup'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _fixedController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Fixed markup'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _percentController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Percent markup'),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            Navigator.of(context).pop((
              fixed: double.tryParse(_fixedController.text.trim()) ?? 0,
              percent: double.tryParse(_percentController.text.trim()) ?? 0,
            ));
          },
          child: const Text('Apply'),
        ),
      ],
    );
  }
}
