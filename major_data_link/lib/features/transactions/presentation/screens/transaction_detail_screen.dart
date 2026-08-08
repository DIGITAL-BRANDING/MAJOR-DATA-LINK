import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/receipt_service.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../data/datasources/transactions_remote_datasource.dart';
import '../../domain/entities/transaction_entity.dart';
import '../providers/transactions_provider.dart';

final _transactionDetailProvider =
    FutureProvider.autoDispose.family<TransactionEntity, String>((ref, id) async {
  final ds = ref.read(transactionsRemoteDataSourceProvider);
  return ds.getTransactionDetail(id);
});

class TransactionDetailScreen extends ConsumerWidget {
  const TransactionDetailScreen({super.key, required this.transactionId});
  final String transactionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final txAsync = ref.watch(_transactionDetailProvider(transactionId));

    return Scaffold(
      appBar: AppBar(title: const Text('Transaction detail')),
      body: txAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(AppDimensions.screenPaddingH),
          child: ListItemShimmer(count: 8),
        ),
        error: (e, _) => KDErrorState(
          message: 'Could not load transaction',
          onRetry: () =>
              ref.invalidate(_transactionDetailProvider(transactionId)),
        ),
        data: (tx) => _TxDetailBody(tx: tx),
      ),
    );
  }
}

class _TxDetailBody extends StatelessWidget {
  const _TxDetailBody({required this.tx});
  final TransactionEntity tx;

  Color get _statusColor {
    switch (tx.status) {
      case TxStatus.success:
        return AppColors.success600;
      case TxStatus.pending:
        return AppColors.warning600;
      case TxStatus.failed:
        return AppColors.error600;
    }
  }

  Color get _statusBg {
    switch (tx.status) {
      case TxStatus.success:
        return AppColors.txSuccessBg;
      case TxStatus.pending:
        return AppColors.txPendingBg;
      case TxStatus.failed:
        return AppColors.txFailedBg;
    }
  }

  String get _statusLabel {
    switch (tx.status) {
      case TxStatus.success:
        return 'Successful';
      case TxStatus.pending:
        return 'Pending';
      case TxStatus.failed:
        return 'Failed';
    }
  }

  Future<void> _shareReceipt(BuildContext context) async {
    final receipt = _buildReceiptData();
    try {
      await ReceiptService.shareReceipt(receipt);
    } catch (e) {
      if (context.mounted) {
        context.showSnackBar('Failed to share receipt', isError: true);
      }
    }
  }

  Future<void> _downloadReceipt(BuildContext context) async {
    final receipt = _buildReceiptData();
    try {
      await ReceiptService.downloadReceipt(receipt);
      if (context.mounted) {
        context.showSnackBar('Receipt saved to documents');
      }
    } catch (e) {
      if (context.mounted) {
        context.showSnackBar('Failed to download receipt', isError: true);
      }
    }
  }

  ReceiptData _buildReceiptData() {
    return ReceiptData(
      title: tx.title,
      amount: tx.amount,
      reference: tx.reference ?? tx.id,
      date: tx.date,
      status: _statusLabel,
      details: [
        if (tx.subtitle.isNotEmpty)
          MapEntry('Recipient', tx.subtitle),
        if (tx.network != null) MapEntry('Network', tx.network!),
        MapEntry('Type', tx.type.name.capitalize),
      ],
      balanceAfter: tx.balanceAfter,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            child: Column(
              children: [
                // ── Amount + status ────────────────────────
                Center(
                  child: Column(
                    children: [
                      const SizedBox(height: 12),
                      Text(
                        '${tx.isCredit ? '+' : '-'}${AppFormatters.formatAmount(tx.amount)}',
                        style: context.textTheme.displaySmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: tx.isCredit
                              ? AppColors.success600
                              : context.colors.onSurface,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 6),
                        decoration: BoxDecoration(
                          color: _statusBg,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _statusLabel,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: _statusColor,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        tx.date.toTransactionDate,
                        style: context.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                KDCard(
                  child: Column(
                    children: [
                      _Row('Description', tx.title),
                      if (tx.subtitle.isNotEmpty)
                        _Row('Recipient / Detail', tx.subtitle),
                      if (tx.network != null)
                        _Row('Network', tx.network!),
                      _Row('Type', tx.type.name.capitalize),
                      const Divider(height: 24),
                      if (tx.reference != null)
                        _Row('Reference', tx.reference!),
                      _Row('Transaction ID', tx.id),
                      if (tx.balanceBefore != null)
                        _Row('Balance before',
                            AppFormatters.formatAmount(tx.balanceBefore!)),
                      if (tx.balanceAfter != null)
                        _Row('Balance after',
                            AppFormatters.formatAmount(tx.balanceAfter!)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // ── Actions ─────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.fromLTRB(
              AppDimensions.screenPaddingH, 0, AppDimensions.screenPaddingH, 24),
          child: SafeArea(
            top: false,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: KDOutlinedButton(
                        label: 'Share',
                        icon: Icons.share_outlined,
                        onPressed: () => _shareReceipt(context),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: KDOutlinedButton(
                        label: 'Download',
                        icon: Icons.download_outlined,
                        onPressed: () => _downloadReceipt(context),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: context.textTheme.bodySmall),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: context.textTheme.bodySmall?.copyWith(
                fontWeight: FontWeight.w700,
                color: context.isDark
                    ? AppColors.neutral100
                    : AppColors.neutral900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}