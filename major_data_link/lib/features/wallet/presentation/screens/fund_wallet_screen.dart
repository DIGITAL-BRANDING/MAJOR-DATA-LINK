import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/security/secure_screen_mixin.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../providers/wallet_provider.dart';

const List<double> _quickAmounts = [500, 1000, 2000, 5000, 10000, 20000];

enum _FundFlow { dynamicTransfer, card }

class FundWalletScreen extends ConsumerStatefulWidget {
  const FundWalletScreen({super.key});

  @override
  ConsumerState<FundWalletScreen> createState() => _FundWalletScreenState();
}

class _FundWalletScreenState extends ConsumerState<FundWalletScreen>
    with SecureScreenMixin {
  final _amountController = TextEditingController();
  final _couponController = TextEditingController();
  double _selectedAmount = 0;
  bool _isProcessing = false;

  @override
  void dispose() {
    _amountController.dispose();
    _couponController.dispose();
    super.dispose();
  }

  bool get _hasAmount => _selectedAmount >= 100;

  @override
  Widget build(BuildContext context) {
    final wallet = ref.watch(walletNotifierProvider);

    return PopScope(
      // Block back-navigation while a funding request is in flight, so the
      // user can't accidentally leave (and lose track of whether it went
      // through) mid-request.
      canPop: !_isProcessing,
      child: Scaffold(
      appBar: AppBar(title: const Text(AppStrings.fundWallet)),
      body: Stack(
        children: [
          SafeArea(
        top: false,
        child: RefreshIndicator(
          onRefresh: () => ref.read(walletNotifierProvider.notifier).refresh(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                wallet.when(
                  loading: () => const LinearProgressIndicator(minHeight: 2),
                  error: (_, __) => _NoticeCard(
                    icon: Icons.info_outline_rounded,
                    title: 'Wallet details unavailable',
                    message:
                        'Pull down to refresh your wallet account details.',
                  ),
                  data: (value) => _VirtualAccountPanel(
                    bankName: value.virtualAccountBank,
                    accountNumber: value.virtualAccountNumber,
                    accountName: value.virtualAccountName,
                    onCopy: _copy,
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Fund wallet options',
                  style: context.textTheme.titleSmall,
                ),
                const SizedBox(height: 10),
                _FundingOption(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Virtual Account',
                  subtitle:
                      'Transfer to your personal account. Automatic credit after confirmation.',
                  onTap: () => _showVirtualAccount(),
                ),
                _FundingOption(
                  icon: Icons.account_balance_outlined,
                  title: 'Dynamic Account',
                  subtitle: 'Generate a temporary account for an exact amount.',
                  onTap: () => _showAmountSheet(_FundFlow.dynamicTransfer),
                ),
                _FundingOption(
                  icon: Icons.receipt_long_outlined,
                  title: 'Manual Bank',
                  subtitle:
                      'Send notice to support after transfer if credit is delayed.',
                  onTap: _showManualBankNotice,
                ),
                _FundingOption(
                  icon: Icons.confirmation_number_outlined,
                  title: 'Fund with Coupon',
                  subtitle: 'Redeem a wallet coupon code.',
                  onTap: _showCouponSheet,
                ),
                _FundingOption(
                  icon: Icons.credit_card_rounded,
                  title: 'ATM / Card Payment',
                  subtitle:
                      'Pay securely with card, USSD, bank or transfer via Paystack.',
                  onTap: () => _showAmountSheet(_FundFlow.card),
                ),
                const SizedBox(height: 16),
                const _NoticeCard(
                  icon: Icons.shield_outlined,
                  title: 'Funding note',
                  message:
                      'Bank transfers are automatic. Use the exact account shown to you and contact support only if your wallet is not credited after a few minutes.',
                ),
              ],
            ),
          ),
        ),
      ),
          if (_isProcessing) const _ProcessingOverlay(),
        ],
      ),
      ),
    );
  }

  Future<void> _showVirtualAccount() async {
    var wallet = ref.read(walletNotifierProvider).valueOrNull;
    var accountNumber = wallet?.virtualAccountNumber;

    if (accountNumber == null || accountNumber.isEmpty) {
      // Cached wallet state does not have one yet - ask the backend directly.
      // /wallet/virtual-account self-provisions on the fly if it's missing, so
      // this succeeds for most users without needing a manual refresh.
      final result = await ref
          .read(walletRepositoryProvider)
          .getVirtualAccount();
      if (!mounted) return;

      final fetched = result.fold((_) => null, (w) => w);
      accountNumber = fetched?.virtualAccountNumber;

      if (accountNumber == null || accountNumber.isEmpty) {
        context.showSnackBar(
          "We're setting up your account - please try again in a moment.",
          isError: true,
        );
        return;
      }

      wallet = fetched;
      ref.read(walletNotifierProvider.notifier).refresh();
    }

    final safeAccountNumber = accountNumber!;

    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: _AccountDetailsSheet(
          title: 'Virtual Account',
          message:
              'Transfer any amount from NGN100 and above. Your wallet will be credited automatically once payment is confirmed.',
          bankName: wallet?.virtualAccountBank ?? 'Bank',
          accountNumber: safeAccountNumber,
          accountName: wallet?.virtualAccountName ?? 'MAJOR DATA-LINK',
          onCopy: _copy,
        ),
      ),
    );
  }

  Future<void> _showAmountSheet(_FundFlow flow) async {
    _amountController.clear();
    _selectedAmount = 0;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(
            20,
            12,
            20,
            20 + MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.neutral300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Text(
                flow == _FundFlow.card
                    ? 'ATM / Card Payment'
                    : 'Dynamic Account',
                style: context.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                flow == _FundFlow.card
                    ? 'Enter amount and continue to Paystack checkout.'
                    : 'Enter the exact amount you want to transfer. A temporary account will be generated for this payment.',
                style: context.textTheme.bodyMedium?.copyWith(
                  color: AppColors.neutral500,
                ),
              ),
              const SizedBox(height: 16),
              KDAmountField(
                controller: _amountController,
                onChanged: (v) => setSheetState(() {
                  _selectedAmount = double.tryParse(v.replaceAll(',', '')) ?? 0;
                }),
                validator: (v) =>
                    AppValidators.amount(v, min: 100, max: 200000),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _quickAmounts.map((amount) {
                  final selected = _selectedAmount == amount;
                  return ChoiceChip(
                    label: Text(AppFormatters.formatAmount(amount)),
                    selected: selected,
                    onSelected: (_) => setSheetState(() {
                      _selectedAmount = amount;
                      _amountController.text = amount.toStringAsFixed(0);
                    }),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
              KDButton(
                label: _hasAmount
                    ? 'Continue with ${AppFormatters.formatAmount(_selectedAmount)}'
                    : 'Enter amount',
                onPressed: _hasAmount && !_isProcessing
                    ? () async {
                        Navigator.of(sheetContext).pop();
                        if (flow == _FundFlow.card) {
                          await _startCardPayment();
                        } else {
                          await _createDynamicAccount();
                        }
                      }
                    : null,
                isLoading: _isProcessing,
                gradient: AppColors.primaryGradient,
              ),
            ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _startCardPayment() async {
    setState(() => _isProcessing = true);
    final result = await ref
        .read(walletNotifierProvider.notifier)
        .fundWallet(amount: _selectedAmount, paymentMethod: 'card');
    setState(() => _isProcessing = false);
    if (!mounted) return;

    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (response) async {
        final data =
            (response['data'] as Map?)?.cast<String, dynamic>() ?? response;
        final url = (data['authorization_url'] ?? data['payment_url'])
            ?.toString();
        final reference = data['reference']?.toString();
        if (url == null || url.isEmpty) {
          context.showSnackBar(
            response['message']?.toString() ?? 'Payment initialized',
          );
          return;
        }
        await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
        if (reference != null && reference.isNotEmpty) {
          _showVerifyPayment(reference);
        }
      },
    );
  }

  Future<void> _createDynamicAccount() async {
    setState(() => _isProcessing = true);
    final result = await ref
        .read(walletNotifierProvider.notifier)
        .createDynamicFunding(amount: _selectedAmount);
    setState(() => _isProcessing = false);
    if (!mounted) return;

    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (response) {
        final data =
            (response['data'] as Map?)?.cast<String, dynamic>() ?? response;
        showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          builder: (_) => Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: _AccountDetailsSheet(
              title: 'Dynamic Account',
              message:
                  'Transfer exactly ${AppFormatters.formatAmount(_selectedAmount)} to this account before it expires.',
              bankName: data['bank_name']?.toString() ?? 'Bank',
              accountNumber: data['account_number']?.toString() ?? '',
              accountName: data['account_name']?.toString() ?? 'MAJOR DATA-LINK',
              reference: data['reference']?.toString(),
              expiresAt: data['expires_at']?.toString(),
              onCopy: _copy,
              onVerify: data['reference'] == null
                  ? null
                  : () => _verifyFunding(data['reference'].toString()),
            ),
          ),
        );
      },
    );
  }

  void _showCouponSheet() {
    _couponController.clear();
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          12,
          20,
          20 + MediaQuery.of(sheetContext).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Fund with Coupon',
              style: Theme.of(
                sheetContext,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            KDTextField(
              controller: _couponController,
              label: 'Coupon code',
              prefixIcon: Icons.confirmation_number_outlined,
              textCapitalization: TextCapitalization.characters,
            ),
            const SizedBox(height: 18),
            KDButton(
              label: 'Redeem coupon',
              onPressed: () async {
                final code = _couponController.text.trim();
                if (code.length < 4) {
                  context.showSnackBar(
                    'Enter a valid coupon code',
                    isError: true,
                  );
                  return;
                }
                Navigator.of(sheetContext).pop();
                await _redeemCoupon(code);
              },
              gradient: AppColors.primaryGradient,
            ),
          ],
          ),
        ),
      ),
    );
  }

  void _showManualBankNotice() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        child: SingleChildScrollView(
          child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Manual Bank Funding',
              style: context.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            const _NoticeCard(
              icon: Icons.info_outline_rounded,
              title: 'Send notice',
              message:
                  'Use the account number on your dashboard to fund your wallet. It is active and automatic. If payment is delayed, contact support with your transfer receipt.',
            ),
            const SizedBox(height: 18),
            KDButton(
              label: 'Contact WhatsApp support',
              onPressed: () => launchUrl(
                Uri.parse(
                  'https://wa.me/2347067693590?text=Hello%20IMAM%20DATASUB,%20I%20need%20help%20with%20wallet%20funding',
                ),
                mode: LaunchMode.externalApplication,
              ),
              gradient: AppColors.primaryGradient,
            ),
          ],
          ),
        ),
      ),
    );
  }

  Future<void> _redeemCoupon(String code) async {
    setState(() => _isProcessing = true);
    final result = await ref
        .read(walletNotifierProvider.notifier)
        .redeemCoupon(code: code);
    setState(() => _isProcessing = false);
    if (!mounted) return;
    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (response) => context.showSnackBar(
        response['message']?.toString() ?? 'Coupon redeemed',
      ),
    );
  }

  Future<void> _verifyFunding(String reference) async {
    final result = await ref
        .read(walletNotifierProvider.notifier)
        .verifyFunding(reference: reference);
    if (!mounted) return;
    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (response) => context.showSnackBar(
        response['message']?.toString() ?? 'Payment checked',
      ),
    );
  }

  void _showVerifyPayment(String reference) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Payment started'),
        content: const Text(
          'After completing payment, return here and verify your wallet funding.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Later'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _verifyFunding(reference);
            },
            child: const Text('Verify now'),
          ),
        ],
      ),
    );
  }

  Future<void> _copy(String value) async {
    if (value.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: value));
    if (mounted) context.showSnackBar('Copied');
  }
}

/// Full-screen, unmissable overlay shown for the entire duration of a
/// funding request (card payment, dynamic account creation, or coupon
/// redemption). Previously the only loading feedback lived on the button
/// inside the bottom sheet, which was popped closed the instant the button
/// was tapped - so the spinner vanished with it and the screen looked
/// completely idle while the request was actually still in flight. That's
/// what made it look like nothing happened and invited double-tapping.
class _ProcessingOverlay extends StatelessWidget {
  const _ProcessingOverlay();

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: ColoredBox(
        color: Colors.black.withValues(alpha: 0.55),
        child: Center(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 40),
            padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 24),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.25),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 52,
                  height: 52,
                  child: CircularProgressIndicator(
                    strokeWidth: 4,
                    valueColor: AlwaysStoppedAnimation(
                      context.colors.primary,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Processing your request…',
                  style: context.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Please wait, this only takes a moment.\nDo not tap back or close the app.',
                  style: context.textTheme.bodySmall?.copyWith(
                    color: AppColors.neutral500,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _FundingOption extends StatelessWidget {
  const _FundingOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(vertical: 6),
      leading: Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: AppColors.primary50,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Icon(icon, color: context.colors.primary),
      ),
      title: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18),
      ),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
    );
  }
}

class _VirtualAccountPanel extends StatelessWidget {
  const _VirtualAccountPanel({
    this.bankName,
    this.accountNumber,
    this.accountName,
    required this.onCopy,
  });
  final String? bankName;
  final String? accountNumber;
  final String? accountName;
  final ValueChanged<String> onCopy;

  @override
  Widget build(BuildContext context) {
    final hasAccount = accountNumber != null && accountNumber!.isNotEmpty;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: context.colors.primary,
        borderRadius: BorderRadius.circular(AppDimensions.radiusLG),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                hasAccount ? accountNumber! : 'Account pending',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
              IconButton(
                onPressed: hasAccount ? () => onCopy(accountNumber!) : null,
                icon: const Icon(Icons.copy_rounded, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            accountName ?? 'MAJOR DATA-LINK',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '${bankName ?? 'Virtual account'} - automatic wallet funding',
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 8),
          const Text(
            '1% charge, capped at N50',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _AccountDetailsSheet extends StatelessWidget {
  const _AccountDetailsSheet({
    required this.title,
    required this.message,
    required this.bankName,
    required this.accountNumber,
    required this.accountName,
    required this.onCopy,
    this.reference,
    this.expiresAt,
    this.onVerify,
  });

  final String title;
  final String message;
  final String bankName;
  final String accountNumber;
  final String accountName;
  final String? reference;
  final String? expiresAt;
  final ValueChanged<String> onCopy;
  final VoidCallback? onVerify;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: context.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          message,
          style: context.textTheme.bodyMedium?.copyWith(
            color: AppColors.neutral500,
          ),
        ),
        const SizedBox(height: 16),
        KDCard(
          child: Column(
            children: [
              _CopyRow(label: 'Bank', value: bankName, onCopy: onCopy),
              const Divider(),
              _CopyRow(
                label: 'Account number',
                value: accountNumber,
                onCopy: onCopy,
              ),
              const Divider(),
              _CopyRow(
                label: 'Account name',
                value: accountName,
                onCopy: onCopy,
              ),
              if (reference != null) ...[
                const Divider(),
                _CopyRow(label: 'Reference', value: reference!, onCopy: onCopy),
              ],
              if (expiresAt != null && expiresAt!.isNotEmpty) ...[
                const Divider(),
                _CopyRow(label: 'Expires', value: expiresAt!, onCopy: onCopy),
              ],
            ],
          ),
        ),
        if (onVerify != null) ...[
          const SizedBox(height: 16),
          KDButton(
            label: 'I have paid - verify',
            onPressed: onVerify,
            gradient: AppColors.primaryGradient,
          ),
        ],
      ],
      ),
    );
  }
}

class _CopyRow extends StatelessWidget {
  const _CopyRow({
    required this.label,
    required this.value,
    required this.onCopy,
  });
  final String label;
  final String value;
  final ValueChanged<String> onCopy;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(color: AppColors.neutral500),
          ),
        ),
        Expanded(
          flex: 2,
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
        IconButton(
          onPressed: () => onCopy(value),
          icon: const Icon(Icons.copy_rounded, size: 18),
        ),
      ],
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard({
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return KDCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: context.colors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 4),
                Text(
                  message,
                  style: const TextStyle(color: AppColors.neutral500),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

