import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../../../admin/presentation/providers/admin_pricing_provider.dart';
import '../../../auth/domain/entities/user_entity.dart';
import '../../../auth/presentation/providers/auth_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final admin = ref.watch(adminMeProvider).valueOrNull;
    final hasAdminAccess = user?.isAdmin == true || admin != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.profile),
        actions: [
          TextButton.icon(
            onPressed: () {},
            icon: const Text('🇬🇧'),
            label: const Text('En'),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppDimensions.screenPaddingH,
          ),
          child: Column(
            children: [
              const SizedBox(height: 18),
              _ProfileHeader(user: user),
              const SizedBox(height: 24),
              _SectionHeader(title: 'General Settings'),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _ProfileTile(
                      icon: Icons.person_outline_rounded,
                      title: 'Profile',
                      subtitle: 'Your personal information',
                      onTap: () => context.push(RouteNames.editProfile),
                    ),
                    if (hasAdminAccess) ...[
                      const Divider(height: 1, indent: 72),
                      _ProfileTile(
                        icon: Icons.admin_panel_settings_outlined,
                        title: 'Admin Dashboard',
                        subtitle: 'Pricing, API balance, notifications',
                        onTap: () => context.push(RouteNames.adminDashboard),
                      ),
                    ],
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.price_change_outlined,
                      title: 'Pricing',
                      subtitle: 'View available data plans',
                      onTap: () => context.push(RouteNames.buyData),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.code_rounded,
                      title: 'Code To Check Balance',
                      subtitle: 'Codes to check data and airtime balance',
                      onTap: () => _showBalanceCodes(context),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.account_balance_wallet_outlined,
                      title: 'Update Virtual Account As required by CBN',
                      subtitle:
                          'Complete KYC to create or refresh your account',
                      trailing: _KycBadge(
                        status: user?.kycStatus ?? KycStatus.unverified,
                        compact: true,
                      ),
                      onTap: () => context.push(RouteNames.kyc),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.call_outlined,
                      title: 'Contact Us',
                      subtitle: 'Contact our support team',
                      onTap: () => _openWhatsApp(AppConfig.supportWhatsApp),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.support_agent_rounded,
                      title: 'Log Complaint',
                      subtitle: 'Open support and complaint channels',
                      onTap: () => context.push(RouteNames.support),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _SectionHeader(title: 'Security'),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _ProfileTile(
                      icon: Icons.lock_outline_rounded,
                      title: AppStrings.changePassword,
                      subtitle: 'Update your login password',
                      onTap: () => context.push(RouteNames.changePassword),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.pin_outlined,
                      title: 'Transaction PIN',
                      subtitle: 'Create or change payment PIN',
                      onTap: () => context.push(RouteNames.changePin),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.fingerprint_rounded,
                      title: AppStrings.biometricAuth,
                      subtitle: 'Fingerprint or face unlock',
                      onTap: () => context.push(RouteNames.security),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.notifications_outlined,
                      title: AppStrings.notifications,
                      subtitle: 'Transaction and app alerts',
                      onTap: () => context.push(RouteNames.notifications),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.palette_outlined,
                      title: AppStrings.settings,
                      subtitle: 'Appearance, notifications and preferences',
                      onTap: () => context.push(RouteNames.settings),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _SectionHeader(title: 'Legal & Account'),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _ProfileTile(
                      icon: Icons.privacy_tip_outlined,
                      title: AppStrings.privacyPolicy,
                      subtitle: 'How MAJOR DATA-LINK uses and protects data',
                      onTap: () => context.push(RouteNames.privacyPolicy),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.description_outlined,
                      title: AppStrings.termsOfService,
                      subtitle: 'Service rules, wallet funding and refunds',
                      onTap: () => context.push(RouteNames.terms),
                    ),
                    const Divider(height: 1, indent: 72),
                    _ProfileTile(
                      icon: Icons.delete_outline_rounded,
                      iconColor: AppColors.error500,
                      title: 'Deactivate / Delete Account',
                      titleColor: AppColors.error500,
                      subtitle:
                          'Temporarily pause or permanently close your account',
                      onTap: () => _showAccountClosureSheet(context, ref),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              KDCard(
                padding: EdgeInsets.zero,
                child: _ProfileTile(
                  icon: Icons.logout_rounded,
                  iconColor: AppColors.error500,
                  title: AppStrings.signOut,
                  titleColor: AppColors.error500,
                  showChevron: false,
                  onTap: () => _confirmSignOut(context, ref),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  static void _showBalanceCodes(BuildContext context) {
    const rows = [
      ('MTN Data', '*323*4#'),
      ('MTN Airtime', '*310#'),
      ('Airtel Data', '*323#'),
      ('Airtel Airtime', '*310#'),
      ('Glo Data', '*323#'),
      ('Glo Airtime', '*310#'),
      ('9mobile Data', '*323#'),
      ('9mobile Airtime', '*310#'),
    ];
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Balance Codes',
                style: context.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 12),
              ...rows.map(
                (row) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    row.$1,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  trailing: TextButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: row.$2));
                      if (context.mounted)
                        context.showSnackBar('Copied ${row.$2}');
                    },
                    icon: const Icon(Icons.copy_rounded, size: 16),
                    label: Text(row.$2),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static Future<void> _openWhatsApp(String phone) async {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    await launchUrl(
      Uri.parse(
        'https://wa.me/$digits?text=Hello%20MAJOR%20DATA-LINK%20Support',
      ),
      mode: LaunchMode.externalApplication,
    );
  }

  static void _confirmSignOut(BuildContext context, WidgetRef ref) {
    var isLoggingOut = false;
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return AlertDialog(
            title: const Text('Sign out'),
            content: const Text('Are you sure you want to sign out?'),
            actions: [
              TextButton(
                onPressed: isLoggingOut ? null : () => Navigator.of(ctx).pop(),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: isLoggingOut
                    ? null
                    : () async {
                        setDialogState(() => isLoggingOut = true);
                        await ref.read(authNotifierProvider.notifier).logout();
                        if (ctx.mounted) Navigator.of(ctx).pop();
                        if (context.mounted) context.go(RouteNames.login);
                      },
                child: isLoggingOut
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor: AlwaysStoppedAnimation(
                            AppColors.error500,
                          ),
                        ),
                      )
                    : const Text(
                        'Sign out',
                        style: TextStyle(color: AppColors.error500),
                      ),
              ),
            ],
          );
        },
      ),
    );
  }

  static void _showAccountClosureSheet(BuildContext context, WidgetRef ref) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Manage your account',
                style: Theme.of(
                  sheetContext,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 20),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.pause_circle_outline_rounded),
                title: const Text(
                  'Deactivate account',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: const Text(
                  'Temporarily disables login. Contact support any time to reactivate — your data and wallet stay intact.',
                ),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _confirmAccountAction(context, ref, isDelete: false);
                },
              ),
              const Divider(height: 24),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.delete_forever_rounded,
                  color: AppColors.error500,
                ),
                title: const Text(
                  'Delete account',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.error500,
                  ),
                ),
                subtitle: const Text(
                  'Permanently removes your personal details. Your wallet must be empty first, and this cannot be undone.',
                ),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  _confirmAccountAction(context, ref, isDelete: true);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  static void _confirmAccountAction(
    BuildContext context,
    WidgetRef ref, {
    required bool isDelete,
  }) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isDelete ? 'Delete account?' : 'Deactivate account?'),
        content: Text(
          isDelete
              ? 'This permanently anonymizes your profile and cannot be undone. Your wallet must be at ₦0 first. Transaction records are retained where required by law.'
              : 'You will be signed out and unable to log in until you contact support to reactivate. Your data and wallet balance stay safe.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _requestCredentialAndSubmit(context, ref, isDelete: isDelete);
            },
            child: Text(
              isDelete ? 'Continue' : 'Deactivate',
              style: const TextStyle(color: AppColors.error500),
            ),
          ),
        ],
      ),
    );
  }

  static Future<void> _requestCredentialAndSubmit(
    BuildContext context,
    WidgetRef ref, {
    required bool isDelete,
  }) async {
    final credential = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _CredentialConfirmSheet(isDelete: isDelete),
    );
    if (credential == null || credential.isEmpty || !context.mounted) return;

    try {
      if (isDelete) {
        await ref
            .read(dioClientProvider)
            .delete<Map<String, dynamic>>(
              AppEndpoints.deleteAccount,
              data: {'credential': credential},
            );
        await ref.read(authNotifierProvider.notifier).logout();
        if (context.mounted) {
          context.showSnackBar('Account deleted successfully');
          context.go(RouteNames.login);
        }
      } else {
        await ref
            .read(dioClientProvider)
            .post<Map<String, dynamic>>(
              AppEndpoints.deactivateAccount,
              data: {'credential': credential},
            );
        await ref.read(authNotifierProvider.notifier).logout();
        if (context.mounted) {
          context.showSnackBar(
            'Account deactivated. Contact support to reactivate any time.',
          );
          context.go(RouteNames.login);
        }
      }
    } on DioException catch (e) {
      final message = e.response?.data is Map
          ? (e.response?.data['message']?.toString() ?? 'Something went wrong')
          : 'Something went wrong';
      if (context.mounted) {
        context.showSnackBar(message, isError: true);
      }
    } catch (_) {
      if (context.mounted) {
        context.showSnackBar(
          'Something went wrong. Please try again.',
          isError: true,
        );
      }
    }
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.user});
  final UserEntity? user;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        CircleAvatar(
          radius: AppDimensions.avatarXXL / 2,
          backgroundColor: AppColors.primary100,
          child: Text(
            user?.initials ?? 'ID',
            style: const TextStyle(
              color: AppColors.primary700,
              fontSize: 32,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          user?.fullName.toUpperCase() ?? 'MAJOR DATA-LINK',
          textAlign: TextAlign.center,
          style: context.textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          user?.referralCode.isNotEmpty == true
              ? user!.referralCode
              : (user?.email ?? ''),
          style: context.textTheme.bodyLarge?.copyWith(
            color: AppColors.neutral500,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 8),
        _KycBadge(status: user?.kycStatus ?? KycStatus.unverified),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title,
        style: context.textTheme.titleSmall?.copyWith(
          color: AppColors.neutral500,
        ),
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.subtitle,
    this.iconColor,
    this.titleColor,
    this.trailing,
    this.showChevron = true,
  });
  final IconData icon;
  final String title;
  final String? subtitle;
  final VoidCallback onTap;
  final Color? iconColor;
  final Color? titleColor;
  final Widget? trailing;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final color = iconColor ?? context.colors.primary;
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Icon(icon, color: color, size: 24),
      ),
      title: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          fontSize: 16,
          color: titleColor,
        ),
      ),
      subtitle: subtitle == null
          ? null
          : Text(
              subtitle!,
              style: const TextStyle(color: AppColors.neutral500),
            ),
      trailing:
          trailing ??
          (showChevron
              ? const Icon(Icons.chevron_right_rounded, size: 28)
              : null),
    );
  }
}

class _KycBadge extends StatelessWidget {
  const _KycBadge({required this.status, this.compact = false});
  final KycStatus status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (label, color, bg) = switch (status) {
      KycStatus.verified => (
        'Verified',
        AppColors.success700,
        AppColors.success50,
      ),
      KycStatus.pending => (
        'Pending',
        AppColors.warning700,
        AppColors.warning50,
      ),
      KycStatus.rejected => ('Rejected', AppColors.error700, AppColors.error50),
      KycStatus.unverified => (
        'Unverified',
        AppColors.neutral600,
        AppColors.neutral100,
      ),
    };
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 12,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: compact ? 11 : 12,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}

// ── Confirms a destructive account action with the transaction PIN, ──
// ── falling back to the account password if no PIN has been set. ────
class _CredentialConfirmSheet extends StatefulWidget {
  const _CredentialConfirmSheet({required this.isDelete});
  final bool isDelete;

  @override
  State<_CredentialConfirmSheet> createState() =>
      _CredentialConfirmSheetState();
}

class _CredentialConfirmSheetState extends State<_CredentialConfirmSheet> {
  bool _usePassword = false;
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 24 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.isDelete ? 'Confirm deletion' : 'Confirm deactivation',
              textAlign: TextAlign.center,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              _usePassword
                  ? 'Enter your account password to continue.'
                  : 'Enter your transaction PIN to continue.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.neutral500),
            ),
            const SizedBox(height: 24),
            if (_usePassword)
              TextField(
                controller: _passwordController,
                obscureText: _obscurePassword,
                autofocus: true,
                decoration: InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppDimensions.radiusMD),
                  ),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                    onPressed: () =>
                        setState(() => _obscurePassword = !_obscurePassword),
                  ),
                ),
                onSubmitted: (value) => Navigator.of(context).pop(value),
              )
            else
              Center(
                child: KDPinInput(
                  length: 4,
                  onCompleted: (pin) => Navigator.of(context).pop(pin),
                ),
              ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => setState(() => _usePassword = !_usePassword),
              child: Text(
                _usePassword
                    ? 'Use transaction PIN instead'
                    : "Haven't set a PIN? Use password instead",
              ),
            ),
            if (_usePassword)
              FilledButton(
                onPressed: () =>
                    Navigator.of(context).pop(_passwordController.text),
                child: const Text('Confirm'),
              ),
          ],
        ),
      ),
    );
  }
}
