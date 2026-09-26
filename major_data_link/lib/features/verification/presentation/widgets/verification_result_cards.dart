import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../utils/slip_pdf_utils.dart';
import '../providers/verification_provider.dart';

/// Shown after a slip lookup (NIN by NIN/Phone/Demographic, BVN slip)
/// completes — success gives the returned identity fields plus PDF
/// actions, failure shows the provider's message (e.g. "record not found").
class SlipResultCard extends ConsumerWidget {
  const SlipResultCard({super.key, required this.result});

  final SlipApiResult result;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!result.success) {
      return KDCard(
        backgroundColor: AppColors.error50,
        border: Border.all(color: AppColors.error100),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.error500,
              size: 20,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                result.message.isEmpty
                    ? 'The request could not be completed.'
                    : result.message,
                style: const TextStyle(color: AppColors.error700, fontSize: 13),
              ),
            ),
          ],
        ),
      );
    }

    final data = result.userData;
    final photo = _providerPhoto(data);
    return KDCard(
      backgroundColor: AppColors.success50,
      border: Border.all(color: AppColors.success100),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.check_circle_rounded,
                color: AppColors.success600,
                size: 20,
              ),
              const SizedBox(width: 8),
              Text(
                'Slip generated',
                style: context.textTheme.titleSmall?.copyWith(
                  color: AppColors.success700,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (data != null && data.isNotEmpty) ...[
            const SizedBox(height: 14),
            if (photo != null)
              Center(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.memory(
                    photo,
                    width: 132,
                    height: 160,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const SizedBox.shrink(),
                  ),
                ),
              ),
            if (photo != null) const SizedBox(height: 12),
            ..._identityRows(data),
          ],
          const SizedBox(height: 6),
          _row(context, 'Reference', result.reference),
          if (result.balanceAfter != null)
            _row(context, 'Wallet balance', result.balanceAfter!.toNaira),
          if (result.documentAvailable ||
              result.pdfBase64 != null ||
              result.pdfUrl?.startsWith('https://') == true) ...[
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
                    onPressed: () => _retrievePdf(
                      context,
                      ref: ref,
                      pdfBase64: result.pdfBase64,
                      pdfUrl: result.pdfUrl,
                      transactionId: result.transactionId,
                      reference: result.reference,
                      printPdf: true,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: KDButton(
                    label: 'Download',
                    icon: Icons.download_rounded,
                    height: 44,
                    onPressed: () => _retrievePdf(
                      context,
                      ref: ref,
                      pdfBase64: result.pdfBase64,
                      pdfUrl: result.pdfUrl,
                      transactionId: result.transactionId,
                      reference: result.reference,
                    ),
                  ),
                ),
              ],
            ),
          ],
          if (!result.documentAvailable &&
              result.pdfBase64 == null &&
              result.pdfUrl?.startsWith('https://') != true) ...[
            const SizedBox(height: 12),
            const Text(
              'The provider confirmed this request but did not return a downloadable PDF. Keep the reference and contact support; do not submit it again.',
              style: TextStyle(fontSize: 12, color: AppColors.warning700),
            ),
          ],
        ],
      ),
    );
  }

  List<Widget> _identityRows(Map<String, dynamic> data) {
    const photoKeys = {
      'image',
      'photo',
      'picture',
      'passport',
      'passportphoto',
    };
    return data.entries
        .where((e) => e.value != null && e.value.toString().isNotEmpty)
        .where(
          (e) => !photoKeys.contains(e.key.replaceAll('_', '').toLowerCase()),
        )
        .map(
          (e) => Builder(
            builder: (context) => _row(
              context,
              e.key.replaceAll('_', ' ').titleCase,
              e.value.toString(),
            ),
          ),
        )
        .toList();
  }

  /// FranceVerify returns a raw image base64 string while other providers may
  /// return a data URL. Render it as a photo and never expose that long value
  /// as a result row.
  Uint8List? _providerPhoto(Map<String, dynamic>? data) {
    if (data == null) return null;
    for (final entry in data.entries) {
      final key = entry.key.replaceAll('_', '').toLowerCase();
      if (!{
            'image',
            'photo',
            'picture',
            'passport',
            'passportphoto',
          }.contains(key) ||
          entry.value is! String)
        continue;
      final value = (entry.value as String)
          .trim()
          .replaceFirst(
            RegExp(
              r'^data:image/(?:png|jpe?g|webp);base64,',
              caseSensitive: false,
            ),
            '',
          )
          .replaceAll(RegExp(r'\s'), '');
      if (value.length < 32) continue;
      try {
        return base64Decode(value);
      } on FormatException {
        // Try the next recognised photo field, if one exists.
      }
    }
    return null;
  }

  Widget _row(BuildContext context, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.neutral500),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.neutral900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class VerificationHistoryCard extends ConsumerWidget {
  const VerificationHistoryCard({super.key, required this.service});

  final String service;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(verificationHistoryProvider(service));
    return KDCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Recent requests', style: context.textTheme.titleSmall),
              const Spacer(),
              const Text(
                'Last 7 days',
                style: TextStyle(fontSize: 12, color: AppColors.neutral500),
              ),
              IconButton(
                tooltip: 'Refresh',
                onPressed: () =>
                    ref.invalidate(verificationHistoryProvider(service)),
                icon: const Icon(Icons.refresh_rounded, size: 20),
              ),
            ],
          ),
          history.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Could not load recent requests. Pull refresh to try again.',
              ),
            ),
            data: (items) {
              if (items.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text(
                    'No completed request for this service in the last 7 days.',
                  ),
                );
              }
              return Column(
                children: items
                    .map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.reference,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${item.createdAt.toLocal()}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.neutral500,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (item.hasPdf)
                              TextButton.icon(
                                onPressed: () => _retrievePdf(
                                  context,
                                  ref: ref,
                                  pdfBase64: item.pdfBase64,
                                  pdfUrl: item.pdfUrl,
                                  transactionId: item.transactionId,
                                  reference: item.reference,
                                ),
                                icon: const Icon(
                                  Icons.download_rounded,
                                  size: 18,
                                ),
                                label: const Text('Download PDF'),
                              )
                            else
                              Text(
                                item.status,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.neutral500,
                                ),
                              ),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

Future<void> _retrievePdf(
  BuildContext context, {
  required WidgetRef ref,
  required String? pdfBase64,
  required String? pdfUrl,
  required String? transactionId,
  required String reference,
  bool printPdf = false,
}) async {
  try {
    final encodedPdf = pdfBase64?.isNotEmpty == true
        ? pdfBase64!
        : transactionId?.isNotEmpty == true
        ? await ref.read(verificationRemoteProvider).getSlipPdf(transactionId!)
        : null;
    if (encodedPdf != null) {
      final cleanedPdf = encodedPdf.replaceFirst(
        RegExp(r'^data:application/pdf;base64,', caseSensitive: false),
        '',
      );
      if (printPdf) {
        await SlipPdfUtils.print(cleanedPdf);
        return;
      }
      await SlipPdfUtils.share(cleanedPdf, reference);
      return;
    }
    final url = Uri.tryParse(pdfUrl ?? '');
    if (url == null ||
        url.scheme != 'https' ||
        !await launchUrl(url, mode: LaunchMode.externalApplication)) {
      throw Exception('PDF link is unavailable');
    }
  } catch (_) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to retrieve this PDF. Please try again.'),
        ),
      );
    }
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
        'Completed',
      ),
      'failed' => (
        AppColors.error700,
        AppColors.error50,
        AppColors.error100,
        Icons.cancel_rounded,
        'Failed — auto-refunded',
      ),
      _ => (
        AppColors.warning700,
        AppColors.warning50,
        AppColors.warning100,
        Icons.hourglass_top_rounded,
        'Pending',
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
              Text(
                label,
                style: context.textTheme.titleSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w800,
                ),
              ),
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
              (e) => _row(
                context,
                e.key.replaceAll('_', ' ').titleCase,
                '${e.value}',
              ),
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
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.neutral500),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.neutral900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
