import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_text_field.dart';

/// Result of a successful POST /kyc/bvn call - the account details the user
/// can now fund their wallet with.
class _ActivatedAccount {
  const _ActivatedAccount({required this.accountNumber, required this.bankName});
  final String accountNumber;
  final String bankName;
}

enum _KycUiState { form, submitting, success }

/// Generates a customer's permanent dedicated account number.
///
/// Previously asked for Bank + Bank Account Number (via GET /kyc/banks) in
/// addition to BVN - that was the older Paystack-specific validation step
/// (see kyc.service.ts's verifyBvnAndActivateWallet). The currently-live
/// provider is ZenithPay, whose dedicated-account API only needs the BVN -
/// this screen had never been updated to match, so it kept collecting and
/// requiring bank details the backend no longer needs for this flow, and
/// (since kyc.routes.ts made those fields optional rather than removing them
/// outright, to stay compatible with a future Paystack switch-back) simply
/// submitting them here had no effect other than asking the user for more
/// than necessary. Brought in line with web/src/pages/VerifyAccountPage.tsx,
/// which only ever asks for BVN.
class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key});

  @override
  ConsumerState<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends ConsumerState<KycScreen> {
  final _formKey = GlobalKey<FormState>();
  final _bvnController = TextEditingController();

  _KycUiState _uiState = _KycUiState.form;
  _ActivatedAccount? _activatedAccount;
  String? _errorMessage;

  @override
  void dispose() {
    _bvnController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _uiState = _KycUiState.submitting;
      _errorMessage = null;
    });

    final dio = ref.read(dioClientProvider);
    try {
      final response = await dio.post(
        AppEndpoints.verifyBvn,
        data: {
          'bvn': _bvnController.text.trim(),
        },
      );

      final data = response.data['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _uiState = _KycUiState.success;
        _activatedAccount = _ActivatedAccount(
          accountNumber: data['virtual_account_number']?.toString() ?? '',
          bankName: data['virtual_account_bank']?.toString() ?? '',
        );
      });
    } on DioException catch (e) {
      if (!mounted) return;
      final message = e.response?.data is Map
          ? (e.response?.data['message']?.toString() ?? 'Verification failed. Please check your details and try again.')
          : 'Verification failed. Please check your details and try again.';
      setState(() {
        _uiState = _KycUiState.form;
        _errorMessage = message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _uiState = _KycUiState.form;
        _errorMessage = 'Something went wrong. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify your identity')),
      body: SafeArea(
        top: false,
        child: switch (_uiState) {
          _KycUiState.success => _buildSuccess(context),
          _ => _buildForm(context),
        },
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    final isSubmitting = _uiState == _KycUiState.submitting;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: AppColors.primary50,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(Icons.fingerprint_rounded,
                  color: context.colors.primary, size: 28),
            ),
            const SizedBox(height: 16),
            Text('Generate Permanent Account Number',
                style: context.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              'Verify your BVN once to get a permanent dedicated account number in your name. '
              'Transfer any amount to it, any time, and your wallet is credited automatically '
              '\u2014 no need to generate a new account for every funding.',
              style: context.textTheme.bodyMedium
                  ?.copyWith(color: AppColors.neutral500),
            ),
            const SizedBox(height: 24),

            if (_errorMessage != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.error50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.error300),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.error_outline_rounded,
                        color: AppColors.error600, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_errorMessage!,
                          style: const TextStyle(color: AppColors.error700)),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],

            Text('Bank Verification Number (BVN)',
                style: context.textTheme.titleSmall),
            const SizedBox(height: 8),
            KDTextField(
              controller: _bvnController,
              label: 'BVN',
              hint: 'e.g. 12345678901',
              prefixIcon: Icons.fingerprint_rounded,
              keyboardType: TextInputType.number,
              enabled: !isSubmitting,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(11),
              ],
              validator: (v) {
                if (v == null || v.length != 11) {
                  return 'Enter a valid 11-digit BVN';
                }
                return null;
              },
              onChanged: (_) => setState(() {}),
            ),
            const SizedBox(height: 8),
            Text(
              'Your BVN is used only to verify your identity and issue the account number '
              '\u2014 it is never stored on our servers.',
              style: context.textTheme.bodySmall
                  ?.copyWith(color: AppColors.neutral500),
            ),

            const SizedBox(height: 32),
            KDButton(
              label: 'Generate My Account Number',
              onPressed: isSubmitting ? null : _submit,
              isLoading: isSubmitting,
              gradient: AppColors.primaryGradient,
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccess(BuildContext context) {
    final account = _activatedAccount!;
    return Padding(
      padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: const BoxDecoration(
              color: AppColors.success50,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.verified_rounded,
                color: AppColors.success600, size: 48),
          ),
          const SizedBox(height: 24),
          Text('Wallet activated!',
              style: context.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          Text(
            'Your identity has been verified. You can now fund your wallet by transferring to your dedicated account below.',
            textAlign: TextAlign.center,
            style: context.textTheme.bodyMedium
                ?.copyWith(color: AppColors.neutral500),
          ),
          const SizedBox(height: 24),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.primary50,
              borderRadius: BorderRadius.circular(AppDimensions.radiusLG),
            ),
            child: Column(
              children: [
                Text(
                  account.accountNumber,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                      letterSpacing: 1.5),
                ),
                const SizedBox(height: 8),
                Text(account.bankName,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.neutral600)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          KDButton(
            label: 'Done',
            onPressed: () => Navigator.of(context).pop(true),
            gradient: AppColors.primaryGradient,
          ),
        ],
      ),
    );
  }
}
