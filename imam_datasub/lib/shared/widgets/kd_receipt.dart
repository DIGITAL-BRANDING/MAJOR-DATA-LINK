import 'package:flutter/material.dart';
import '../../core/constants/app_colors.dart';
import '../../core/utils/formatters.dart';
import 'kd_card.dart';

class KDReceiptCard extends StatelessWidget {
  const KDReceiptCard({
    super.key,
    required this.title,
    required this.amount,
    required this.reference,
    required this.date,
    required this.status,
    required this.details,
    this.balanceAfter,
  });

  final String title;
  final double amount;
  final String reference;
  final DateTime date;
  final String status;
  final List<MapEntry<String, String>> details;
  final double? balanceAfter;

  bool get _isSuccess => status.toLowerCase() == 'successful' ||
      status.toLowerCase() == 'success';

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor =
        _isSuccess ? AppColors.success600 : AppColors.warning600;
    final statusBg = _isSuccess ? AppColors.success50 : AppColors.warning50;

    return KDCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'MAJOR DATA-LINK',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Theme.of(context).colorScheme.primary,
                  letterSpacing: 1.5,
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // ── Amount ────────────────────────────────────────
          Text(
            title,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.neutral500,
                ),
          ),
          const SizedBox(height: 4),
          Text(
            AppFormatters.formatAmount(amount),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),

          const SizedBox(height: 16),
          Divider(
              color: isDark ? AppColors.darkDivider : AppColors.neutral200),
          const SizedBox(height: 12),

          // ── Details rows ──────────────────────────────────
          ...details.map((entry) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      entry.key,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.neutral500,
                          ),
                    ),
                    Flexible(
                      child: Text(
                        entry.value,
                        textAlign: TextAlign.end,
                        style:
                            Theme.of(context).textTheme.bodySmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                      ),
                    ),
                  ],
                ),
              )),

          // ── Date ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Date',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.neutral500,
                      ),
                ),
                Text(
                  AppFormatters.formatDateTime(date),
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ],
            ),
          ),

          // ── Reference ─────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 5),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Reference',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.neutral500,
                      ),
                ),
                Flexible(
                  child: Text(
                    reference,
                    textAlign: TextAlign.end,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 11,
                        ),
                  ),
                ),
              ],
            ),
          ),

          if (balanceAfter != null) ...[
            Divider(
                color:
                    isDark ? AppColors.darkDivider : AppColors.neutral200),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Wallet balance',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.neutral500,
                        ),
                  ),
                  Text(
                    AppFormatters.formatAmount(balanceAfter!),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 8),

          // ── Footer ────────────────────────────────────────
          Center(
            child: Text(
              'Thank you for using MAJOR DATA-LINK',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.neutral400,
                    fontSize: 11,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

