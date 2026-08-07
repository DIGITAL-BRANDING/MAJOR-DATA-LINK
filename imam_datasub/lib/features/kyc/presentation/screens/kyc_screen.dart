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

/// A supported bank returned by GET /kyc/banks, used to populate the picker.
class _Bank {
  const _Bank({required this.name, required this.code});
  final String name;
  final String code;

  factory _Bank.fromJson(Map<String, dynamic> json) =>
      _Bank(name: json['name'] as String, code: json['code'] as String);
}

/// Result of a successful POST /kyc/bvn call - the account details the user
/// can now fund their wallet with.
class _ActivatedAccount {
  const _ActivatedAccount({required this.accountNumber, required this.bankName});
  final String accountNumber;
  final String bankName;
}

enum _KycUiState { form, submitting, success }

class KycScreen extends ConsumerStatefulWidget {
  const KycScreen({super.key});

  @override
  ConsumerState<KycScreen> createState() => _KycScreenState();
}

class _KycScreenState extends ConsumerState<KycScreen> {
  final _formKey = GlobalKey<FormState>();
  final _bvnController = TextEditingController();
  final _accountNumberController = TextEditingController();

  _KycUiState _uiState = _KycUiState.form;
  bool _isLoadingBanks = true;
  List<_Bank> _banks = [];
  _Bank? _selectedBank;
  _ActivatedAccount? _activatedAccount;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadBanks();
  }

  @override
  void dispose() {
    _bvnController.dispose();
    _accountNumberController.dispose();
    super.dispose();
  }

  Future<void> _loadBanks() async {
    final dio = ref.read(dioClientProvider);
    try {
      final response = await dio.get(AppEndpoints.kycBanks);
      final rawList = (response.data['data'] as List).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _banks = rawList.map(_Bank.fromJson).toList();
        _isLoadingBanks = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingBanks = false;
        _errorMessage = 'Could not load bank list. Pull to refresh or try again.';
      });
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_selectedBank == null) {
      setState(() => _errorMessage = 'Please select your bank.');
      return;
    }

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
          'bank_code': _selectedBank!.code,
          'account_number': _accountNumberController.text.trim(),
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
            Text('Verify your BVN',
                style: context.textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              'Verify your Bank Verification Number to activate your dedicated account number. Your BVN is sent securely for verification and is never stored on our servers.',
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

            Text('Bank', style: context.textTheme.titleSmall),
            const SizedBox(height: 8),
            _isLoadingBanks
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: LinearProgressIndicator(),
                  )
                : DropdownButtonFormField<_Bank>(
                    initialValue: _selectedBank,
                    decoration: InputDecoration(
                      prefixIcon:
                          const Icon(Icons.account_balance_outlined),
                      hintText: 'Select your bank',
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(AppDimensions.radiusMD),
                      ),
                    ),
                    items: _banks
                        .map((bank) => DropdownMenuItem(
                              value: bank,
                              child: Text(bank.name,
                                  overflow: TextOverflow.ellipsis),
                            ))
                        .toList(),
                    onChanged: isSubmitting
                        ? null
                        : (bank) => setState(() => _selectedBank = bank),
                  ),

            const SizedBox(height: 20),
            Text('Bank account number', style: context.textTheme.titleSmall),
            const SizedBox(height: 8),
            KDTextField(
              controller: _accountNumberController,
              label: 'Account number',
              hint: '10-digit NUBAN linked to your BVN',
              prefixIcon: Icons.numbers_rounded,
              keyboardType: TextInputType.number,
              enabled: !isSubmitting,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              validator: (v) {
                if (v == null || v.length != 10) {
                  return 'Enter a valid 10-digit account number';
                }
                return null;
              },
              onChanged: (_) => setState(() {}),
            ),

            const SizedBox(height: 20),
            Text('BVN', style: context.textTheme.titleSmall),
            const SizedBox(height: 8),
            KDTextField(
              controller: _bvnController,
              label: 'BVN',
              hint: '11-digit Bank Verification Number',
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

            const SizedBox(height: 32),
            KDButton(
              label: 'Verify and activate wallet',
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
                Text(account.bankName,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.neutral600)),
                const SizedBox(height: 8),
                Text(
                  account.accountNumber,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 24,
                      letterSpacing: 1.5),
                ),
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
