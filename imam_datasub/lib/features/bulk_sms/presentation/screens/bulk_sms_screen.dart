import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/error_handler.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

// ── State ──────────────────────────────────────────────────
class BulkSmsState {
  const BulkSmsState({
    this.recipients = const [],
    this.message = '',
    this.isProcessing = false,
    this.isSent = false,
    this.errorMessage,
    this.smsBalance,
  });

  final List<String> recipients;
  final String message;
  final bool isProcessing;
  final bool isSent;
  final String? errorMessage;
  final int? smsBalance;

  bool get canSend =>
      recipients.isNotEmpty &&
      message.trim().length >= 5 &&
      message.trim().length <= 160;

  int get pageCount => (message.trim().length / 160).ceil().clamp(1, 10);
  int get totalSmsUnits => recipients.length * pageCount;

  BulkSmsState copyWith({
    List<String>? recipients,
    String? message,
    bool? isProcessing,
    bool? isSent,
    String? errorMessage,
    int? smsBalance,
    bool clearError = false,
  }) {
    return BulkSmsState(
      recipients: recipients ?? this.recipients,
      message: message ?? this.message,
      isProcessing: isProcessing ?? this.isProcessing,
      isSent: isSent ?? this.isSent,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      smsBalance: smsBalance ?? this.smsBalance,
    );
  }
}

class BulkSmsNotifier extends StateNotifier<BulkSmsState> {
  BulkSmsNotifier(this._ref) : super(const BulkSmsState()) {
    _loadBalance();
  }

  final Ref _ref;

  Future<void> _loadBalance() async {
    try {
      final dio = _ref.read(dioClientProvider);
      final response = await dio.get(AppEndpoints.smsBalance);
      final balance = response.data['data']?['balance'] as int? ?? 0;
      state = state.copyWith(smsBalance: balance);
    } catch (_) {}
  }

  void addRecipient(String phone) {
    final cleaned = phone.replaceAll(RegExp(r'\s|-'), '');
    if (cleaned.length == 11 && !state.recipients.contains(cleaned)) {
      state = state.copyWith(recipients: [...state.recipients, cleaned]);
    }
  }

  void removeRecipient(String phone) {
    state = state.copyWith(
        recipients: state.recipients.where((r) => r != phone).toList());
  }

  void setMessage(String msg) => state = state.copyWith(message: msg);

  void setRecipients(List<String> phones) =>
      state = state.copyWith(recipients: phones);

  Future<void> loadFromCsv() async {
    try {
      final result = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['csv', 'txt'],
      );
      if (result == null) return;
      final bytes = result.files.first.bytes;
      if (bytes == null) return;
      final content = String.fromCharCodes(bytes);
      final phones = content
          .split(RegExp(r'[\n,;]'))
          .map((p) => p.trim().replaceAll(RegExp(r'\D'), ''))
          .where((p) => p.length == 11)
          .toSet()
          .toList();
      state = state.copyWith(recipients: phones);
    } catch (e) {
      state = state.copyWith(errorMessage: 'Failed to load CSV: $e');
    }
  }

  Future<bool> send() async {
    if (!state.canSend) return false;
    state = state.copyWith(isProcessing: true, clearError: true);
    try {
      final dio = _ref.read(dioClientProvider);
      final response = await dio.post(
        AppEndpoints.sendBulkSms,
        data: {
          'recipients': state.recipients,
          'message': state.message,
        },
      );
      final success = response.data['status'] == true;
      state = state.copyWith(isProcessing: false, isSent: success);
      return success;
    } on DioException catch (e) {
      final ex = ErrorHandler.handleException(e);
      state = state.copyWith(isProcessing: false, errorMessage: ex.message);
      return false;
    }
  }

  void reset() => state = const BulkSmsState();
}

final bulkSmsNotifierProvider =
    StateNotifierProvider.autoDispose<BulkSmsNotifier, BulkSmsState>((ref) {
  return BulkSmsNotifier(ref);
});

// ── Screen ─────────────────────────────────────────────────
class BulkSmsScreen extends ConsumerStatefulWidget {
  const BulkSmsScreen({super.key});

  @override
  ConsumerState<BulkSmsScreen> createState() => _BulkSmsScreenState();
}

class _BulkSmsScreenState extends ConsumerState<BulkSmsScreen> {
  final _phoneController = TextEditingController();
  final _messageController = TextEditingController();

  @override
  void dispose() {
    _phoneController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  void _addManualRecipient() {
    final phone = _phoneController.text.trim();
    if (phone.length == 11) {
      ref.read(bulkSmsNotifierProvider.notifier).addRecipient(phone);
      _phoneController.clear();
    }
  }

  Future<void> _handleSend() async {
    context.hideKeyboard();
    final state = ref.read(bulkSmsNotifierProvider);

    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Send SMS to ${state.recipients.length} recipient(s) — ${state.totalSmsUnits} unit(s)',
    );
    if (!pinVerified || !mounted) return;

    final success = await ref.read(bulkSmsNotifierProvider.notifier).send();
    if (!mounted) return;

    if (success) {
      context.showSnackBar(
          'SMS sent successfully to ${ref.read(bulkSmsNotifierProvider).recipients.length} recipient(s)');
      _messageController.clear();
      ref.read(bulkSmsNotifierProvider.notifier).reset();
    } else {
      context.showSnackBar(
        ref.read(bulkSmsNotifierProvider).errorMessage ?? 'Failed to send SMS',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(bulkSmsNotifierProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bulk SMS'),
        actions: [
          if (state.smsBalance != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.success50,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${state.smsBalance} units',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.success700,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Recipient input ────────────────────────────
              Text('Recipients', style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: KDTextField(
                      controller: _phoneController,
                      hint: 'Enter phone number',
                      prefixIcon: Icons.phone_outlined,
                      keyboardType: TextInputType.phone,
                      onSubmitted: (_) => _addManualRecipient(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  GestureDetector(
                    onTap: _addManualRecipient,
                    child: Container(
                      width: 50,
                      height: 56,
                      decoration: BoxDecoration(
                        color: context.colors.primary,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.add_rounded,
                          color: Colors.white, size: 24),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () =>
                          ref.read(bulkSmsNotifierProvider.notifier).loadFromCsv(),
                      icon: const Icon(Icons.upload_file_outlined, size: 18),
                      label: const Text('Import CSV'),
                    ),
                  ),
                ],
              ),

              if (state.recipients.isNotEmpty) ...[
                const SizedBox(height: 12),
                KDCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '${state.recipients.length} recipient(s)',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          GestureDetector(
                            onTap: () => ref
                                .read(bulkSmsNotifierProvider.notifier)
                                .setRecipients([]),
                            child: const Text('Clear all',
                                style: TextStyle(
                                    color: AppColors.error500, fontSize: 12)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: state.recipients.take(10).map((phone) {
                          return Chip(
                            label: Text(AppFormatters.maskPhone(phone),
                                style: const TextStyle(fontSize: 11)),
                            deleteIcon: const Icon(Icons.close, size: 14),
                            onDeleted: () => ref
                                .read(bulkSmsNotifierProvider.notifier)
                                .removeRecipient(phone),
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          );
                        }).toList(),
                      ),
                      if (state.recipients.length > 10)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(
                            '+${state.recipients.length - 10} more',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.neutral500),
                          ),
                        ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 20),

              // ── Message composer ───────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Message', style: context.textTheme.titleSmall),
                  Text(
                    '${state.message.length}/160',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.neutral500),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              KDTextField(
                controller: _messageController,
                hint: 'Type your message here...',
                maxLines: 5,
                maxLength: 160,
                onChanged: (v) =>
                    ref.read(bulkSmsNotifierProvider.notifier).setMessage(v),
                contentPadding: const EdgeInsets.all(16),
              ),

              if (state.message.isNotEmpty) ...[
                const SizedBox(height: 12),
                KDCard(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _SmsMetric(
                        label: 'Recipients',
                        value: '${state.recipients.length}',
                      ),
                      _SmsMetric(
                        label: 'Pages',
                        value: '${state.pageCount}',
                      ),
                      _SmsMetric(
                        label: 'Total units',
                        value: '${state.totalSmsUnits}',
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: KDButton(
            label: state.recipients.isEmpty
                ? 'Add recipients to continue'
                : 'Send to ${state.recipients.length} recipient(s)',
            onPressed: state.canSend ? _handleSend : null,
            isLoading: state.isProcessing,
            gradient: AppColors.primaryGradient,
          ),
        ),
      ),
    );
  }
}

class _SmsMetric extends StatelessWidget {
  const _SmsMetric({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(value,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        Text(label,
            style: const TextStyle(
                fontSize: 11, color: AppColors.neutral500)),
      ],
    );
  }
}
