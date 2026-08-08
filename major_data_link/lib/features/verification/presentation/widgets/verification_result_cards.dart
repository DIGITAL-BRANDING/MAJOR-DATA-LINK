import 'package:flutter/material.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../utils/slip_pdf_utils.dart';
import '../providers/verification_provider.dart';

/// Shown after a slip lookup (NIN by NIN/Phone/Demographic, BVN slip)
/// completes — success gives the returned identity fields plus PDF
/// actions, failure shows the provider's message (e.g. "record not found").
class SlipResultCard extends StatelessWidget {
  const SlipResultCard({super.key, required this.result});

  final SlipApiResult result;

  @override
  Widget build(BuildContext context) {
    if (!result.success) {
      return KDCard(
        backgroundColor: AppColors.error50,
        border: Border.all(color: AppColors.error100),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.error500, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                result.message.isEmpty
                    ? 'The request could not be completed.'
                    : result.message,
                style: const TextStyle(
                    color: AppColors.error700, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final data = result.userData;
    return KDCard(
      backgroundColor: AppColors.success50,
      border: Border.all(color: AppColors.success100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: AppColors.success600, size: 20),
              const SizedBox(width: 8),
              Text('Slip generated',
                  style: context.textTheme.titleSmall?.copyWith(
                    color: AppColors.success700,
                    fontWeight: FontWeight.w800,
                  )),
            ],
          ),
          if (data != null && data.isNotEmpty) ...[
            const SizedBox(height: 14),
            ..._identityRows(data),
          ],
          const SizedBox(height: 6),
          _row(context, 'Reference', result.reference),
          if (result.balanceAfter != null)
            _row(context, 'Wallet balance', result.balanceAfter!.toNaira),
          if (result.pdfBase64 != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: KDButton(
                    label: 'Print',
                    icon: Icons.print_outlined,
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.success700,
                    height: 44,
                    onPressed: () => SlipPdfUtils.print(result.pdfBase64!),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: KDButton(
                    label: 'Share',
                    icon: Icons.share_outlined,
                    height: 44,
                    onPressed: () =>
                        SlipPdfUtils.share(result.pdfBase64!, result.reference),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  List<Widget> _identityRows(Map<String, dynamic> data) {
    const labels = {
      'nin': 'NIN',
      'bvn': 'BVN',
      'first_name': 'First name',
      'last_name': 'Last name',
      'middle_name': 'Middle name',
      'gender': 'Gender',
      'date_of_birth': 'Date of birth',
      'phone_number': 'Phone number',
      'address': 'Address',
    };
    return labels.entries
        .where((e) => data[e.key] != null && data[e.key].toString().isNotEmpty)
        .map((e) => Builder(
              builder: (context) => _row(context, e.value, data[e.key].toString()),
            ))
        .toList();
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.neutral500)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.neutral900),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shown after submitting one of the five async services — displays the
/// ticket, a pending/success/failed badge, and a manual refresh action.
/// Screens are responsible for the polling cadence (see
/// `AsyncTicketPoller` mixin usage in each async screen).
class AsyncTicketStatusCard extends StatelessWidget {
  const AsyncTicketStatusCard({
    super.key,
    required this.state,
    required this.onRefresh,
  });

  final AsyncFlowState state;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final (color, bg, border, icon, label) = switch (state.status) {
      'success' => (
          AppColors.success700,
          AppColors.success50,
          AppColors.success100,
          Icons.check_circle_rounded,
          'Completed'
        ),
      'failed' => (
          AppColors.error700,
          AppColors.error50,
          AppColors.error100,
          Icons.cancel_rounded,
          'Failed — auto-refunded'
        ),
      _ => (
          AppColors.warning700,
          AppColors.warning50,
          AppColors.warning100,
          Icons.hourglass_top_rounded,
          'Pending'
        ),
    };

    return KDCard(
      backgroundColor: bg,
      border: Border.all(color: border),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 8),
              Text(label,
                  style: context.textTheme.titleSmall
                      ?.copyWith(color: color, fontWeight: FontWeight.w800)),
              const Spacer(),
              if (!state.isSettled)
                IconButton(
                  onPressed: state.isPolling ? null : onRefresh,
                  icon: state.isPolling
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Icon(Icons.refresh_rounded, color: color, size: 20),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (state.ticketId != null)
            _row(context, 'Ticket ID', state.ticketId!),
          if (state.reference != null)
            _row(context, 'Reference', state.reference!),
          if (state.balanceAfter != null)
            _row(context, 'Wallet balance', state.balanceAfter!.toNaira),
          if (state.isSettled && state.response != null) ...[
            const Divider(height: 20),
            ...state.response!.entries.map(
              (e) => _row(context, e.key.replaceAll('_', ' ').titleCase,
                  '${e.value}'),
            ),
          ],
          if (!state.isSettled) ...[
            const SizedBox(height: 8),
            Text(
              'An admin needs to process this request — check back shortly, '
              'or tap refresh above.',
              style: TextStyle(fontSize: 12, color: color),
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.neutral500)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: AppColors.neutral900),
            ),
          ),
        ],
      ),
    );
  }
}
