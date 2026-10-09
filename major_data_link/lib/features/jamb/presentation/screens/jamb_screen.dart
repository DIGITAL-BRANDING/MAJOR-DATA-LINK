import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';
import '../../../../shared/widgets/purchase_success_view.dart';
import '../providers/jamb_provider.dart';

/// JAMB services. The service list comes from the backend, so admin can add,
/// price or switch services without an app release. Every request is paid,
/// then fulfilled manually and delivered to the customer's Deliveries inbox.
class JambScreen extends ConsumerStatefulWidget {
  const JambScreen({super.key});

  @override
  ConsumerState<JambScreen> createState() => _JambScreenState();
}

class _JambScreenState extends ConsumerState<JambScreen> {
  final _regController = TextEditingController();
  final _nameController = TextEditingController();
  final _yearController = TextEditingController(
      text: DateTime.now().year.toString());

  @override
  void initState() {
    super.initState();
    // The year field starts pre-filled, so the notifier must know that value
    // too - otherwise the Pay button stays disabled until the user retypes it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(jambNotifierProvider.notifier).setExamYear(_yearController.text);
      }
    });
  }

  @override
  void dispose() {
    _regController.dispose();
    _nameController.dispose();
    _yearController.dispose();
    super.dispose();
  }

  JambService? _selected(List<JambService> services, String? id) {
    for (final s in services) {
      if (s.id == id) return s;
    }
    return null;
  }

  Future<void> _handlePurchase(JambService service) async {
    context.hideKeyboard();
    final pin = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm ${service.label} — ${AppFormatters.formatAmount(service.price)}',
    );
    if (pin == null || !mounted) return;

    final result = await ref
        .read(jambNotifierProvider.notifier)
        .purchase(pin: pin, service: service);
    if (!mounted) return;

    if (result != null && result['status'] == true) {
      final data = result['data'] as Map<String, dynamic>? ?? {};
      final state = ref.read(jambNotifierProvider);
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: service.label,
            amount: service.price,
            reference: data['reference']?.toString() ?? '',
            balanceAfter: (data['balance_after'] as num?)?.toDouble(),
            details: [
              MapEntry('Service', service.label),
              MapEntry('Reg. number', state.registrationNumber.trim()),
              MapEntry('Candidate', state.candidateName.trim()),
              MapEntry('Exam year', state.examYear.trim()),
            ],
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(jambNotifierProvider.notifier).reset();
              _regController.clear();
              _nameController.clear();
            },
          ),
        ),
      );
    } else {
      context.showSnackBar(
        ref.read(jambNotifierProvider).errorMessage ?? 'Request failed',
        isError: true,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(jambNotifierProvider);
    final servicesAsync = ref.watch(jambServicesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('JAMB Services')),
      body: SafeArea(
        top: false,
        child: servicesAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(e.toString(), textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed: () => ref.invalidate(jambServicesProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (services) {
            if (services.isEmpty) {
              return const Center(
                child: Text('No JAMB services are available right now.'),
              );
            }
            final selected = _selected(services, state.selectedId);
            return ListView(
              padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
              children: [
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  value: selected?.id,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Select service'),
                  items: services
                      .map((s) => DropdownMenuItem<String>(
                            value: s.id,
                            child: Text(
                              '${s.label} — ${AppFormatters.formatAmount(s.price)}',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ))
                      .toList(),
                  onChanged: (id) {
                    if (id == null) return;
                    ref.read(jambNotifierProvider.notifier).selectService(id);
                  },
                ),
                if (selected != null) ...[
                  const SizedBox(height: 16),
                  KDCard(
                    backgroundColor: AppColors.primary50,
                    border: Border.all(color: AppColors.primary100),
                    child: Row(
                      children: [
                        Icon(Icons.assignment_rounded,
                            color: context.colors.primary),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            selected.label,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: context.colors.primary,
                            ),
                          ),
                        ),
                        Text(
                          AppFormatters.formatAmount(selected.price),
                          style: const TextStyle(
                              fontSize: 13, color: AppColors.neutral500),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text('JAMB registration number',
                      style: context.textTheme.titleSmall),
                  const SizedBox(height: 10),
                  KDTextField(
                    controller: _regController,
                    hint: 'e.g. 12AB34567890',
                    prefixIcon: Icons.badge_outlined,
                    textCapitalization: TextCapitalization.characters,
                    onChanged: (v) => ref
                        .read(jambNotifierProvider.notifier)
                        .setRegistrationNumber(v),
                    validator: AppValidators.jambRegNumber,
                  ),
                  const SizedBox(height: 16),
                  Text('Candidate full name',
                      style: context.textTheme.titleSmall),
                  const SizedBox(height: 10),
                  KDTextField(
                    controller: _nameController,
                    hint: 'As it appears on your JAMB record',
                    prefixIcon: Icons.person_outline,
                    onChanged: (v) => ref
                        .read(jambNotifierProvider.notifier)
                        .setCandidateName(v),
                  ),
                  const SizedBox(height: 16),
                  Text('Exam year', style: context.textTheme.titleSmall),
                  const SizedBox(height: 10),
                  KDTextField(
                    controller: _yearController,
                    hint: 'e.g. 2026',
                    prefixIcon: Icons.calendar_today_outlined,
                    keyboardType: TextInputType.number,
                    onChanged: (v) => ref
                        .read(jambNotifierProvider.notifier)
                        .setExamYear(v),
                  ),
                  const SizedBox(height: 28),
                  KDButton(
                    label:
                        'Pay ${AppFormatters.formatAmount(selected.price)}',
                    onPressed: state.canProceed && !state.isProcessing
                        ? () => _handlePurchase(selected)
                        : null,
                    isLoading: state.isProcessing,
                    gradient: AppColors.primaryGradient,
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}
