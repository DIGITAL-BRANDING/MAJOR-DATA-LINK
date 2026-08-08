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

class JambScreen extends ConsumerStatefulWidget {
  const JambScreen({super.key});

  @override
  ConsumerState<JambScreen> createState() => _JambScreenState();
}

class _JambScreenState extends ConsumerState<JambScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _regController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: JambServiceType.values.length,
      vsync: this,
    );
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        final type = JambServiceType.values[_tabController.index];
        ref.read(jambNotifierProvider.notifier).setServiceType(type);
        _regController.clear();
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _regController.dispose();
    super.dispose();
  }

  Future<void> _handlePurchase() async {
    context.hideKeyboard();
    final state = ref.read(jambNotifierProvider);

    final pinVerified = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      subtitle:
          'Confirm ${state.serviceType.label} — ${AppFormatters.formatAmount(state.serviceType.price)}',
    );
    if (!pinVerified || !mounted) return;

    final result = await ref.read(jambNotifierProvider.notifier).purchase();
    if (!mounted) return;

    if (result != null && result['status'] == true) {
      final data = result['data'] as Map<String, dynamic>? ?? {};
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => PurchaseSuccessView(
            title: 'JAMB ${state.serviceType.label}',
            amount: state.serviceType.price,
            reference: data['reference']?.toString() ?? '',
            details: [
              MapEntry('Service', state.serviceType.label),
              MapEntry('Reg. number', state.regNumber),
              if (data['pin'] != null) MapEntry('PIN', data['pin'].toString()),
              if (data['profile_code'] != null)
                MapEntry('Profile code', data['profile_code'].toString()),
            ],
            onBuyAgain: () {
              Navigator.of(context).pop();
              ref.read(jambNotifierProvider.notifier).reset();
              _regController.clear();
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('JAMB Services'),
        bottom: TabBar(
          controller: _tabController,
          tabs: JambServiceType.values
              .map((t) => Tab(text: t.label))
              .toList(),
          labelStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            state.serviceType.label,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: context.colors.primary,
                            ),
                          ),
                          Text(
                            AppFormatters.formatAmount(state.serviceType.price),
                            style: const TextStyle(
                                fontSize: 13, color: AppColors.neutral500),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              Text('JAMB registration number',
                  style: context.textTheme.titleSmall),
              const SizedBox(height: 10),
              KDTextField(
                controller: _regController,
                hint: 'e.g. 12AB34567890',
                prefixIcon: Icons.badge_outlined,
                textCapitalization: TextCapitalization.characters,
                onChanged: (v) =>
                    ref.read(jambNotifierProvider.notifier).setRegNumber(v),
                validator: AppValidators.jambRegNumber,
              ),

              const Spacer(),

              KDButton(
                label:
                    'Pay ${AppFormatters.formatAmount(state.serviceType.price)}',
                onPressed: state.canProceed ? _handlePurchase : null,
                isLoading: state.isProcessing,
                gradient: AppColors.primaryGradient,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
