import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/router/route_names.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/banner_slider.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../../../shared/widgets/promo_illustration.dart';
import '../../../../shared/widgets/promo_popup_dialog.dart';
import '../../../../shared/widgets/quick_action_grid.dart';
import '../../../../shared/widgets/transaction_tile.dart';
import '../../../../shared/widgets/wallet_card.dart';
import '../../../auth/presentation/providers/auth_provider.dart';
import '../../../notifications/presentation/providers/notification_provider.dart';
import '../../../transactions/domain/entities/transaction_entity.dart';
import '../../../transactions/presentation/providers/transactions_provider.dart';
import '../../../wallet/presentation/providers/wallet_provider.dart';
import '../providers/home_provider.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final Set<String> _shownWelcomeNoticeIds = <String>{};
  bool _shownSessionWelcome = false;

  void _maybeShowWelcomeNotice(
    AsyncValue<List<AppNotification>> notificationsAsync,
  ) {
    if (notificationsAsync.isLoading) return;

    final notifications =
        notificationsAsync.valueOrNull ?? const <AppNotification>[];
    // Only notices the admin explicitly flagged "show as popup" when they
    // composed the broadcast (NotificationBroadcast.showAsPopup on the
    // backend) auto-show here - everything else (including plain
    // admin_broadcast/promo/system notifications without that flag) stays
    // list-only, opened the normal way from the notifications screen.
    final notice = notifications.cast<AppNotification?>().firstWhere((item) {
      if (item == null ||
          item.isRead ||
          _shownWelcomeNoticeIds.contains(item.id)) {
        return false;
      }
      return item.showAsPopup;
    }, orElse: () => null);

    final title = notice?.title.isNotEmpty == true
        ? notice!.title
        : 'Welcome to MAJOR DATA-LINK';
    final body = notice?.body.isNotEmpty == true
        ? notice!.body
        : 'Buy data, airtime, TV subscriptions, electricity tokens, education PINs and wallet services securely from your dashboard.';

    if (notice != null) {
      _shownWelcomeNoticeIds.add(notice.id);
    } else {
      if (_shownSessionWelcome) return;
      _shownSessionWelcome = true;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await PromoPopupDialog.show(
        context,
        title: title,
        body: body,
        illustration: PromoIllustration.fromKey(notice?.imageKey),
        onRead: () {
          if (notice != null) {
            ref.read(notificationsProvider.notifier).markRead([notice.id]);
          }
        },
      );
    });
  }

  Future<void> _onRefresh() async {
    await Future.wait([
      ref.read(walletNotifierProvider.notifier).refresh(),
      ref.refresh(recentTransactionsProvider.future),
      ref.refresh(bannersProvider.future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final greeting = ref.watch(greetingProvider);
    final walletState = ref.watch(walletNotifierProvider);
    final balanceHidden = ref.watch(balanceVisibilityProvider);
    final bannersAsync = ref.watch(bannersProvider);
    final recentTxAsync = ref.watch(recentTransactionsProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);
    final notificationsAsync = ref.watch(notificationsProvider);
    _maybeShowWelcomeNotice(notificationsAsync);

    return Scaffold(
      floatingActionButton: _MajorAssistantFab(
        onPressed: () => context.push(RouteNames.liveChat),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: _onRefresh,
          color: Theme.of(context).colorScheme.primary,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Premium gold-to-black header: top bar + wallet card share
                // one continuous background so the wallet card's own gold
                // gradient (see WalletCard/AppColors.walletGradient) reads
                // as part of the same block rather than a card floating on
                // a plain page - the rest of the screen (quick actions,
                // transactions) stays on the regular light background below.
                Container(
                  decoration: const BoxDecoration(
                    gradient: AppColors.premiumGradient,
                  ),
                  padding: const EdgeInsets.only(bottom: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Top bar: greeting + notifications
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppDimensions.screenPaddingH,
                          vertical: 12,
                        ),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 22,
                              backgroundColor: AppColors.primary400,
                              child: Text(
                                user?.initials ?? 'KD',
                                style: const TextStyle(
                                  color: AppColors.neutral950,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    greeting,
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(
                                          color: Colors.white.withValues(
                                            alpha: 0.7,
                                          ),
                                        ),
                                  ),
                                  Text(
                                    user?.firstName.isNotEmpty == true
                                        ? user!.firstName
                                        : 'there',
                                    style: context.textTheme.titleMedium
                                        ?.copyWith(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                        ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            KDIconButton(
                              icon: Icons.notifications_outlined,
                              badge: unreadCount,
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.12,
                              ),
                              iconColor: Colors.white,
                              onPressed: () =>
                                  context.push(RouteNames.notifications),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 8),

                      // Wallet card
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppDimensions.screenPaddingH,
                        ),
                        child: walletState.when(
                          loading: () => const WalletCardShimmer(),
                          error: (_, __) => WalletCard(
                            balance: 0,
                            name: user?.fullName ?? '',
                            accountNumber:
                                user?.virtualAccountNumber ?? '----------',
                            isBalanceHidden: balanceHidden,
                            onToggleBalance: () =>
                                ref
                                        .read(
                                          balanceVisibilityProvider.notifier,
                                        )
                                        .state =
                                    !balanceHidden,
                            onFund: () => context.push(RouteNames.fundWallet),
                          ),
                          data: (wallet) => WalletCard(
                            balance: wallet.totalBalance,
                            name: user?.fullName ?? '',
                            accountNumber:
                                wallet.virtualAccountNumber ?? '----------',
                            isBalanceHidden: balanceHidden,
                            onToggleBalance: () =>
                                ref
                                        .read(
                                          balanceVisibilityProvider.notifier,
                                        )
                                        .state =
                                    !balanceHidden,
                            onFund: () => context.push(RouteNames.fundWallet),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // Quick actions
                // Quick actions
                const SizedBox(height: 4),
                QuickActionGrid(
                  actions: [
                    QuickAction(
                      label: 'Buy Data',
                      icon: Icons.wifi_rounded,
                      backgroundColor: AppColors.primary500,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.buyData),
                    ),
                    QuickAction(
                      label: 'Airtime',
                      icon: Icons.phone_android_rounded,
                      backgroundColor: AppColors.secondary500,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.buyAirtime),
                    ),
                    QuickAction(
                      label: 'Cable TV',
                      icon: Icons.tv_rounded,
                      backgroundColor: AppColors.accent500,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.cableTv),
                    ),
                    QuickAction(
                      label: 'Electricity',
                      icon: Icons.flash_on_rounded,
                      backgroundColor: AppColors.warning500,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.electricity),
                    ),
                    QuickAction(
                      label: 'WAEC/NECO',
                      icon: Icons.school_rounded,
                      backgroundColor: AppColors.success500,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.waecChecker),
                    ),
                    QuickAction(
                      label: 'JAMB',
                      icon: Icons.assignment_rounded,
                      backgroundColor: AppColors.primary700,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.jambServices),
                    ),
                    QuickAction(
                      label: 'Bulk SMS',
                      icon: Icons.sms_rounded,
                      backgroundColor: AppColors.secondary700,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.bulkSms),
                    ),
                    QuickAction(
                      label: 'NIN',
                      icon: Icons.badge_outlined,
                      backgroundColor: AppColors.primary600,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.ninServices),
                    ),
                    QuickAction(
                      label: 'BVN',
                      icon: Icons.fingerprint_rounded,
                      backgroundColor: AppColors.secondary600,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.bvnServices),
                    ),
                    QuickAction(
                      label: 'CAC',
                      icon: Icons.business_center_outlined,
                      backgroundColor: AppColors.accent600,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.cacServices),
                    ),
                    QuickAction(
                      label: 'SCUML',
                      icon: Icons.verified_user_outlined,
                      backgroundColor: AppColors.success600,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.scumlServices),
                    ),
                    QuickAction(
                      label: 'TIN',
                      icon: Icons.receipt_long_outlined,
                      backgroundColor: AppColors.warning700,
                      iconColor: Colors.white,
                      onTap: () => context.push(RouteNames.tinServices),
                    ),
                    QuickAction(
                      label: 'More',
                      icon: Icons.grid_view_rounded,
                      backgroundColor: AppColors.neutral700,
                      iconColor: Colors.white,
                      onTap: () => context.go(RouteNames.services),
                    ),
                  ],
                ),

                const SizedBox(height: 24),

                // Promo banners
                bannersAsync.when(
                  loading: () => Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppDimensions.screenPaddingH,
                    ),
                    child: KDShimmer(
                      child: Container(
                        height: AppDimensions.bannerHeight,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(
                            AppDimensions.bannerRadius,
                          ),
                        ),
                      ),
                    ),
                  ),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (banners) => banners.isEmpty
                      ? const SizedBox.shrink()
                      : BannerSlider(
                          banners: banners,
                          onBannerTap: (banner) {
                            if (banner.actionType == 'route' &&
                                banner.actionUrl != null) {
                              context.push(banner.actionUrl!);
                            }
                          },
                        ),
                ),

                const SizedBox(height: 24),

                // Recent transactions
                KDSectionHeader(
                  title: 'Recent transactions',
                  actionLabel: 'See all',
                  onActionTap: () => context.go(RouteNames.transactions),
                ),
                const SizedBox(height: 4),
                recentTxAsync.when(
                  loading: () => const TransactionListShimmer(itemCount: 4),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (transactions) => transactions.isEmpty
                      ? const KDEmptyState(
                          title: 'No transactions yet',
                          message:
                              'Your transactions will appear here after your first purchase.',
                          icon: Icons.receipt_long_outlined,
                        )
                      : Column(
                          children: transactions
                              .map(
                                (tx) => TransactionTile(
                                  title: tx.title,
                                  subtitle: tx.subtitle,
                                  amount: tx.amount,
                                  date: tx.date,
                                  status: _mapStatus(tx.status),
                                  type: _mapType(tx.type),
                                  isCredit: tx.isCredit,
                                  onTap: () => context.push(
                                    '${RouteNames.transactions}/${tx.id}',
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                ),

                SizedBox(height: 32 + MediaQuery.paddingOf(context).bottom),
              ],
            ),
          ),
        ),
      ),
    );
  }

  TransactionStatus _mapStatus(TxStatus status) {
    switch (status) {
      case TxStatus.success:
        return TransactionStatus.success;
      case TxStatus.pending:
        return TransactionStatus.pending;
      case TxStatus.failed:
        return TransactionStatus.failed;
    }
  }

  TransactionType _mapType(TxType type) {
    switch (type) {
      case TxType.data:
        return TransactionType.data;
      case TxType.airtime:
        return TransactionType.airtime;
      case TxType.cable:
        return TransactionType.cable;
      case TxType.electricity:
        return TransactionType.electricity;
      case TxType.fund:
        return TransactionType.fund;
      case TxType.transfer:
      case TxType.withdrawal:
        return TransactionType.transfer;
      case TxType.referral:
        return TransactionType.referral;
      case TxType.recharge:
        return TransactionType.recharge;
      case TxType.waec:
        return TransactionType.waec;
      case TxType.neco:
        return TransactionType.neco;
      case TxType.nabteb:
        return TransactionType.nabteb;
      case TxType.jamb:
        return TransactionType.jamb;
      case TxType.sms:
        return TransactionType.sms;
    }
  }
}

class _MajorAssistantFab extends StatelessWidget {
  const _MajorAssistantFab({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Open MAJOR AI Assistant',
    button: true,
    child: Tooltip(
      message: 'MAJOR AI Assistant',
      child: FloatingActionButton.extended(
        heroTag: 'major-ai-fab',
        onPressed: onPressed,
        backgroundColor: AppColors.primary600,
        icon: const Icon(Icons.waving_hand_rounded, color: Colors.white)
            .animate(onPlay: (controller) => controller.repeat(reverse: true))
            .rotate(begin: -0.12, end: 0.12, duration: 700.ms),
        label: const Text(
          'AI Help',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
      ),
    ),
  );
}
