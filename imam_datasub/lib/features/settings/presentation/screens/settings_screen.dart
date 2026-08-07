import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/security/biometric_service.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/validators.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_pin_input.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../notifications/presentation/providers/notification_provider.dart';
import '../../../../app.dart';

// ── Change password screen ─────────────────────────────────
class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _oldController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _isLoading = false;

  @override
  void dispose() {
    _oldController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _handleChange() async {
    if (_newController.text != _confirmController.text) {
      context.showSnackBar('New passwords do not match', isError: true);
      return;
    }
    if (AppValidators.password(_newController.text) != null) {
      context.showSnackBar(
        AppValidators.password(_newController.text)!,
        isError: true,
      );
      return;
    }

    setState(() => _isLoading = true);
    final useCase = ref.read(changePasswordUseCaseProvider);
    final result = await useCase.call(
      oldPassword: _oldController.text,
      newPassword: _newController.text,
    );
    setState(() => _isLoading = false);

    if (!mounted) return;
    result.fold(
      (failure) => context.showSnackBar(failure.message, isError: true),
      (_) {
        context.showSnackBar(AppStrings.passwordChanged);
        context.pop();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.changePassword)),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            children: [
              const SizedBox(height: 8),
              KDTextField(
                controller: _oldController,
                label: 'Current password',
                prefixIcon: Icons.lock_outline_rounded,
                obscureText: true,
              ),
              const SizedBox(height: 16),
              KDTextField(
                controller: _newController,
                label: 'New password',
                prefixIcon: Icons.lock_reset_rounded,
                obscureText: true,
                validator: AppValidators.password,
              ),
              const SizedBox(height: 16),
              KDTextField(
                controller: _confirmController,
                label: 'Confirm new password',
                prefixIcon: Icons.lock_reset_rounded,
                obscureText: true,
              ),
              const Spacer(),
              KDButton(
                label: AppStrings.changePassword,
                onPressed: _handleChange,
                isLoading: _isLoading,
                gradient: AppColors.primaryGradient,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Change PIN screen ──────────────────────────────────────
class ChangePinScreen extends ConsumerStatefulWidget {
  const ChangePinScreen({super.key});

  @override
  ConsumerState<ChangePinScreen> createState() => _ChangePinScreenState();
}

class _ChangePinScreenState extends ConsumerState<ChangePinScreen> {
  String _newPin = '';
  int _step = 0; // 0 = enter new, 1 = confirm
  bool _isLoading = false;
  bool _hasError = false;

  Future<void> _handlePinCompleted(String pin) async {
    if (_step == 0) {
      setState(() {
        _newPin = pin;
        _step = 1;
      });
    } else {
      if (pin != _newPin) {
        setState(() {
          _hasError = true;
          _step = 0;
          _newPin = '';
        });
        context.showSnackBar(AppStrings.pinMismatch, isError: true);
        return;
      }

      setState(() => _isLoading = true);
      final useCase = ref.read(setTransactionPinUseCaseProvider);
      final result = await useCase.call(pin: pin);
      setState(() => _isLoading = false);

      if (!mounted) return;
      result.fold(
        (failure) {
          setState(() {
            _hasError = true;
            _step = 0;
            _newPin = '';
          });
          context.showSnackBar(failure.message, isError: true);
        },
        (_) {
          context.showSnackBar(AppStrings.pinCreated);
          context.pop();
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.changePin)),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.primary50,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  Icons.pin_outlined,
                  color: context.colors.primary,
                  size: 30,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                _step == 0 ? AppStrings.createPin : AppStrings.confirmPin,
                style: context.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _step == 0
                    ? 'Choose a 4-digit PIN for transactions'
                    : 'Re-enter your PIN to confirm',
                style: context.textTheme.bodyMedium?.copyWith(
                  color: AppColors.neutral500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              if (_isLoading)
                const CircularProgressIndicator()
              else
                KDPinInput(
                  key: ValueKey('pin_step_$_step'),
                  length: 4,
                  hasError: _hasError,
                  onCompleted: _handlePinCompleted,
                  onChanged: (_) => setState(() => _hasError = false),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Change login PIN screen (6-digit) ──────────────────────
class ChangeLoginPinScreen extends ConsumerStatefulWidget {
  const ChangeLoginPinScreen({super.key});

  @override
  ConsumerState<ChangeLoginPinScreen> createState() =>
      _ChangeLoginPinScreenState();
}

class _ChangeLoginPinScreenState extends ConsumerState<ChangeLoginPinScreen> {
  String _newPin = '';
  int _step = 0; // 0 = enter new, 1 = confirm
  bool _isLoading = false;
  bool _hasError = false;

  Future<void> _handlePinCompleted(String pin) async {
    if (_step == 0) {
      setState(() {
        _newPin = pin;
        _step = 1;
      });
    } else {
      if (pin != _newPin) {
        setState(() {
          _hasError = true;
          _step = 0;
          _newPin = '';
        });
        context.showSnackBar(AppStrings.pinMismatch, isError: true);
        return;
      }

      setState(() => _isLoading = true);
      final useCase = ref.read(setLoginPinUseCaseProvider);
      final result = await useCase.call(pin: pin);
      setState(() => _isLoading = false);

      if (!mounted) return;
      result.fold(
        (failure) {
          setState(() {
            _hasError = true;
            _step = 0;
            _newPin = '';
          });
          context.showSnackBar(failure.message, isError: true);
        },
        (_) {
          context.showSnackBar(AppStrings.loginPinChanged);
          context.pop();
        },
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.changeLoginPin)),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  color: AppColors.primary50,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Icon(
                  Icons.lock_person_outlined,
                  color: context.colors.primary,
                  size: 30,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                _step == 0
                    ? AppStrings.createLoginPin
                    : AppStrings.confirmLoginPin,
                style: context.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                _step == 0
                    ? 'Choose a new 6-digit PIN for logging in'
                    : 'Re-enter your PIN to confirm',
                style: context.textTheme.bodyMedium?.copyWith(
                  color: AppColors.neutral500,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              if (_isLoading)
                const CircularProgressIndicator()
              else
                KDPinInput(
                  key: ValueKey('login_pin_step_$_step'),
                  length: 6,
                  hasError: _hasError,
                  onCompleted: _handlePinCompleted,
                  onChanged: (_) => setState(() => _hasError = false),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Main Settings screen ───────────────────────────────────
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark =
        themeMode == ThemeMode.dark ||
        (themeMode == ThemeMode.system &&
            MediaQuery.platformBrightnessOf(context) == Brightness.dark);

    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.settings)),
      body: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Appearance ────────────────────────────────
              _SettingsHeader(title: 'Appearance'),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: _ToggleTile(
                  icon: isDark
                      ? Icons.dark_mode_rounded
                      : Icons.light_mode_rounded,
                  title: AppStrings.darkMode,
                  value: isDark,
                  onChanged: (v) {
                    ref.read(themeModeProvider.notifier).state = v
                        ? ThemeMode.dark
                        : ThemeMode.light;
                    final hive = ref.read(hiveStorageProvider);
                    hive.saveSetting('dark_mode', v);
                  },
                ),
              ),

              const SizedBox(height: 20),

              // ── Notifications ─────────────────────────────
              _SettingsHeader(title: AppStrings.notifications),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _ToggleTile(
                      icon: Icons.notifications_outlined,
                      title: 'Push notifications',
                      value: ref.watch(pushNotificationsEnabledProvider),
                      onChanged: (v) =>
                          ref
                                  .read(
                                    pushNotificationsEnabledProvider.notifier,
                                  )
                                  .state =
                              v,
                    ),
                    const Divider(height: 1, indent: 60),
                    _ToggleTile(
                      icon: Icons.campaign_outlined,
                      title: 'Promotions & offers',
                      value: ref.watch(promoNotificationsEnabledProvider),
                      onChanged: (v) =>
                          ref
                                  .read(
                                    promoNotificationsEnabledProvider.notifier,
                                  )
                                  .state =
                              v,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ── Security ──────────────────────────────────
              _SettingsHeader(title: AppStrings.security),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _NavigationTile(
                      icon: Icons.lock_outline_rounded,
                      title: AppStrings.changePassword,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const ChangePasswordScreen(),
                        ),
                      ),
                    ),
                    const Divider(height: 1, indent: 60),
                    _NavigationTile(
                      icon: Icons.pin_outlined,
                      title: 'Change transaction PIN',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const ChangePinScreen(),
                        ),
                      ),
                    ),
                    const Divider(height: 1, indent: 60),
                    _NavigationTile(
                      icon: Icons.lock_person_outlined,
                      title: AppStrings.changeLoginPin,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const ChangeLoginPinScreen(),
                        ),
                      ),
                    ),
                    const Divider(height: 1, indent: 60),
                    _BiometricTile(ref: ref),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ── Legal ─────────────────────────────────────
              _SettingsHeader(title: 'Legal'),
              const SizedBox(height: 8),
              KDCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _NavigationTile(
                      icon: Icons.privacy_tip_outlined,
                      title: AppStrings.privacyPolicy,
                      onTap: () => context.push(RouteNames.privacyPolicy),
                    ),
                    const Divider(height: 1, indent: 60),
                    _NavigationTile(
                      icon: Icons.description_outlined,
                      title: AppStrings.termsOfService,
                      onTap: () => context.push(RouteNames.terms),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // ── About ─────────────────────────────────────
              KDCard(
                padding: EdgeInsets.zero,
                child: _NavigationTile(
                  icon: Icons.info_outline_rounded,
                  title: AppStrings.aboutApp,
                  trailing: Text(
                    'v${AppConfig.appVersion}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.neutral400,
                    ),
                  ),
                  onTap: () {},
                ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}

class SecurityScreen extends ConsumerWidget {
  const SecurityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text(AppStrings.security)),
      body: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          child: KDCard(
            padding: EdgeInsets.zero,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _BiometricTile(ref: ref),
                const Divider(height: 1, indent: 60),
                _NavigationTile(
                  icon: Icons.pin_outlined,
                  title: 'Transaction PIN',
                  onTap: () => context.push('/home/profile/pin'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Biometric tile with live toggle ───────────────────────
class _BiometricTile extends ConsumerStatefulWidget {
  const _BiometricTile({required this.ref});
  final WidgetRef ref;

  @override
  ConsumerState<_BiometricTile> createState() => _BiometricTileState();
}

class _BiometricTileState extends ConsumerState<_BiometricTile> {
  bool _enabled = false;
  bool _available = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final local = ref.read(authLocalDataSourceProvider);
    final biometricService = ref.read(biometricServiceProvider);
    final enabled = await local.isBiometricEnabled();
    final available = await biometricService.isAvailable();
    if (mounted)
      setState(() {
        _enabled = enabled;
        _available = available;
      });
  }

  @override
  Widget build(BuildContext context) {
    return _ToggleTile(
      icon: Icons.fingerprint_rounded,
      title: AppStrings.biometricAuth,
      subtitle: _available ? null : 'Not available on this device',
      value: _enabled && _available,
      onChanged: _available
          ? (v) async {
              final local = ref.read(authLocalDataSourceProvider);
              if (v) {
                final biometricService = ref.read(biometricServiceProvider);
                final result = await biometricService.authenticate(
                  title: 'Enable biometric login',
                  subtitle: 'Authenticate to enable biometric login',
                );
                if (result != BiometricResult.success) return;
              }
              await local.setBiometricEnabled(v);
              if (mounted) setState(() => _enabled = v);
            }
          : null,
    );
  }
}

// ── Reusable setting tile widgets ─────────────────────────
class _SettingsHeader extends StatelessWidget {
  const _SettingsHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: context.textTheme.titleSmall?.copyWith(
        color: AppColors.neutral500,
      ),
    );
  }
}

class _ToggleTile extends StatelessWidget {
  const _ToggleTile({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
    this.subtitle,
  });
  final IconData icon;
  final String title;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      secondary: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: context.colors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: context.colors.primary, size: 18),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: subtitle != null
          ? Text(subtitle!, style: const TextStyle(fontSize: 12))
          : null,
      value: value,
      onChanged: onChanged,
      activeColor: context.colors.primary,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    );
  }
}

class _NavigationTile extends StatelessWidget {
  const _NavigationTile({
    required this.icon,
    required this.title,
    required this.onTap,
    this.trailing,
  });
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: context.colors.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: context.colors.primary, size: 18),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      trailing:
          trailing ??
          Icon(
            Icons.chevron_right_rounded,
            color: AppColors.neutral400,
            size: 20,
          ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
    );
  }
}
