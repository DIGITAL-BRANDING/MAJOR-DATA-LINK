import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

class BvnCrmScreen extends ConsumerStatefulWidget {
  const BvnCrmScreen({super.key});
  @override
  ConsumerState<BvnCrmScreen> createState() => _BvnCrmScreenState();
}

class _BvnCrmScreenState extends ConsumerState<BvnCrmScreen> {
  final _ticket = TextEditingController();
  double? _price;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _loadPrice();
  }

  @override
  void dispose() {
    _ticket.dispose();
    super.dispose();
  }

  Future<void> _loadPrice() async {
    try {
      final r = await ref.read(dioClientProvider).get(AppEndpoints.bvnCrmPrice);
      if (mounted)
        setState(
          () => _price = (r.data['data']['unit_price'] as num).toDouble(),
        );
    } catch (_) {
      if (mounted)
        context.showSnackBar('Unable to load service price.', isError: true);
    }
  }

  Future<void> _submit() async {
    if (!RegExp(r'^\d{8}$').hasMatch(_ticket.text)) {
      context.showSnackBar(
        'Ticket ID must be exactly 8 digits.',
        isError: true,
      );
      return;
    }
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: 'Confirm BVN CRM',
      subtitle:
          'Confirm ${_price == null ? 'this request' : AppFormatters.formatAmount(_price!)}',
    );
    if (pin == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await ref
          .read(dioClientProvider)
          .post(
            AppEndpoints.bvnCrmSubmit,
            data: {'ticket_id': _ticket.text, 'pin': pin},
          );
      if (!mounted) return;
      _ticket.clear();
      context.showSnackBar(
        '${r.data['message']} Reference: ${r.data['data']['reference']}',
      );
    } catch (_) {
      if (mounted)
        context.showSnackBar(
          'Request failed. Please try again.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('BVN CRM')),
    body: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            KDCard(
              backgroundColor: AppColors.primary50,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.support_agent_outlined,
                    color: AppColors.primary600,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'BVN CRM',
                    style: context.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Submit your 8-digit BVN CRM Ticket ID for an agent to follow up. Processing takes 24–48 hours.',
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _price == null
                        ? 'Service cost: Loading…'
                        : 'Service cost: ${AppFormatters.formatAmount(_price!)}',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            KDTextField(
              controller: _ticket,
              label: '8-digit Ticket ID',
              hint: 'e.g. 88248123',
              prefixIcon: Icons.confirmation_number_outlined,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(8),
              ],
            ),
            const SizedBox(height: 20),
            KDButton(
              label: 'Continue to PIN confirmation',
              isLoading: _busy,
              onPressed: _submit,
              gradient: AppColors.primaryGradient,
            ),
          ],
        ),
      ),
    ),
  );
}
