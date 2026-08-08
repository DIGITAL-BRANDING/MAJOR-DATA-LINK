import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/transaction_tile.dart';
import '../../domain/entities/transaction_entity.dart';
import '../providers/transactions_provider.dart';

class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(transactionListProvider.notifier).loadMore();
    }
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => const _FilterSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(transactionListProvider);
    final filter = ref.watch(transactionFilterProvider);
    final hasActiveFilter =
        filter.type != null || filter.status != null || filter.search != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transactions'),
        actions: [
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.filter_list_rounded),
                onPressed: _showFilterSheet,
              ),
              if (hasActiveFilter)
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.error,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppDimensions.screenPaddingH, vertical: 8),
              child: KDSearchField(
                controller: _searchController,
                hint: 'Search transactions',
                onChanged: (v) {
                  ref.read(transactionFilterProvider.notifier).state =
                      filter.copyWith(search: v.isEmpty ? null : v);
                },
                onClear: () {
                  ref.read(transactionFilterProvider.notifier).state =
                      filter.copyWith(clearSearch: true);
                },
              ),
            ),

            if (hasActiveFilter)
              _ActiveFiltersBar(
                filter: filter,
                onClear: () {
                  ref.read(transactionFilterProvider.notifier).state =
                      const TransactionFilter();
                  _searchController.clear();
                },
              ),

            Expanded(
              child: state.isLoading
                  ? const TransactionListShimmer(itemCount: 8)
                  : state.error != null
                      ? KDErrorState(
                          message: state.error!,
                          onRetry: () => ref
                              .read(transactionListProvider.notifier)
                              .refresh(),
                        )
                      : state.transactions.isEmpty
                          ? const KDEmptyState(
                              title: 'No transactions found',
                              message:
                                  'No transactions match your filters.',
                              icon: Icons.receipt_long_outlined,
                            )
                          : RefreshIndicator(
                              onRefresh: () => ref
                                  .read(transactionListProvider.notifier)
                                  .refresh(),
                              child: ListView.separated(
                                controller: _scrollController,
                                itemCount: state.transactions.length +
                                    (state.isLoadingMore ? 1 : 0),
                                separatorBuilder: (_, __) =>
                                    const Divider(height: 1, indent: 76),
                                itemBuilder: (context, index) {
                                  if (index == state.transactions.length) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16),
                                      child: Center(
                                          child:
                                              CircularProgressIndicator()),
                                    );
                                  }
                                  final tx = state.transactions[index];
                                  return TransactionTile(
                                    title: tx.title,
                                    subtitle: tx.subtitle,
                                    amount: tx.amount,
                                    date: tx.date,
                                    status: _mapStatus(tx.status),
                                    type: _mapType(tx.type),
                                    isCredit: tx.isCredit,
                                    onTap: () => context.push(
                                        '${RouteNames.transactions}/${tx.id}'),
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  TransactionStatus _mapStatus(TxStatus s) => switch (s) {
        TxStatus.success => TransactionStatus.success,
        TxStatus.pending => TransactionStatus.pending,
        TxStatus.failed => TransactionStatus.failed,
      };

  TransactionType _mapType(TxType t) => switch (t) {
        TxType.data => TransactionType.data,
        TxType.airtime => TransactionType.airtime,
        TxType.cable => TransactionType.cable,
        TxType.electricity => TransactionType.electricity,
        TxType.fund => TransactionType.fund,
        TxType.transfer || TxType.withdrawal => TransactionType.transfer,
        TxType.referral => TransactionType.referral,
        TxType.recharge => TransactionType.recharge,
        TxType.waec || TxType.nabteb => TransactionType.waec,
        TxType.neco => TransactionType.neco,
        TxType.jamb => TransactionType.jamb,
        TxType.sms => TransactionType.sms,
      };
}

class _ActiveFiltersBar extends StatelessWidget {
  const _ActiveFiltersBar({required this.filter, required this.onClear});
  final TransactionFilter filter;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          const Icon(Icons.filter_alt_rounded,
              size: 14, color: AppColors.neutral500),
          const SizedBox(width: 6),
          Text(
            'Filters active',
            style: const TextStyle(
                fontSize: 12,
                color: AppColors.neutral500,
                fontWeight: FontWeight.w500),
          ),
          const Spacer(),
          GestureDetector(
            onTap: onClear,
            child: const Text(
              'Clear all',
              style: TextStyle(
                  fontSize: 12,
                  color: AppColors.error500,
                  fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterSheet extends ConsumerStatefulWidget {
  const _FilterSheet();

  @override
  ConsumerState<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends ConsumerState<_FilterSheet> {
  String? _type;
  String? _status;

  @override
  void initState() {
    super.initState();
    final filter = ref.read(transactionFilterProvider);
    _type = filter.type;
    _status = filter.status;
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        8,
        24,
        32 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.neutral300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Filter transactions',
              style:
                  context.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 20),
          Text('Type', style: context.textTheme.titleSmall),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['data', 'airtime', 'cable', 'electricity', 'fund']
                .map((t) => _FilterChip(
                      label: t.capitalize,
                      isSelected: _type == t,
                      onTap: () => setState(
                          () => _type = _type == t ? null : t),
                    ))
                .toList(),
          ),
          const SizedBox(height: 20),
          Text('Status', style: context.textTheme.titleSmall),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['success', 'pending', 'failed']
                .map((s) => _FilterChip(
                      label: s.capitalize,
                      isSelected: _status == s,
                      onTap: () => setState(
                          () => _status = _status == s ? null : s),
                    ))
                .toList(),
          ),
          const SizedBox(height: 28),
          KDButton(
            label: 'Apply filters',
            onPressed: () {
              ref.read(transactionFilterProvider.notifier).state =
                  TransactionFilter(type: _type, status: _status);
              Navigator.of(context).pop();
            },
            gradient: AppColors.primaryGradient,
          ),
        ],
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? context.colors.primary : AppColors.primary50,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : context.colors.primary,
          ),
        ),
      ),
    );
  }
}
