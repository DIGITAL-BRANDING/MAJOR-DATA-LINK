import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';
import '../../../../core/config/app_config.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/constants/app_strings.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../core/utils/formatters.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_shimmer.dart';
import '../../../../shared/widgets/kd_text_field.dart';

// ── Ticket entity ──────────────────────────────────────────
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.subject,
    required this.status,
    required this.createdAt,
    this.lastMessage,
  });

  final String id;
  final String subject;
  final String status;
  final DateTime createdAt;
  final String? lastMessage;

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: json['id']?.toString() ?? '',
      subject: json['subject']?.toString() ?? '',
      status: json['status']?.toString() ?? 'open',
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ??
          DateTime.now(),
      lastMessage: json['last_message']?.toString(),
    );
  }

  bool get isOpen =>
      status.toLowerCase() == 'open' || status.toLowerCase() == 'pending';
}

// ── Ticket providers ───────────────────────────────────────
final myTicketsProvider =
    FutureProvider.autoDispose<List<SupportTicket>>((ref) async {
  try {
    final dio = ref.read(dioClientProvider);
    final response = await dio.get(AppEndpoints.myTickets);
    final list = (response.data['data'] ?? response.data) as List<dynamic>;
    return list
        .map((e) =>
            SupportTicket.fromJson(e as Map<String, dynamic>))
        .toList();
  } catch (_) {
    return [];
  }
});

// ── FAQ entity ─────────────────────────────────────────────
class FaqItem {
  const FaqItem({required this.question, required this.answer});
  final String question;
  final String answer;
}

const _faqs = [
  FaqItem(
    question: 'How do I fund my wallet?',
    answer:
        'You can fund your wallet by bank transfer to your virtual account or by card payment via Paystack. Go to Wallet → Add Money to get started.',
  ),
  FaqItem(
    question: 'How long does data purchase take?',
    answer:
        'Data purchases are usually instant (within seconds). If your data does not arrive within 5 minutes, please contact support with your transaction reference.',
  ),
  FaqItem(
    question: 'What is the referral commission rate?',
    answer:
        'You earn 2% commission on every successful transaction made by users you refer. Commission is credited to your wallet and can be withdrawn at any time.',
  ),
  FaqItem(
    question: 'How do I verify my identity (KYC)?',
    answer:
        'Go to Profile → KYC Verification and follow the steps: BVN verification, NIN verification, ID document upload, and selfie capture.',
  ),
  FaqItem(
    question: 'What happens if a transaction fails?',
    answer:
        'If a transaction fails, your wallet balance is automatically refunded within a few minutes. If it takes longer, contact support with your reference number.',
  ),
  FaqItem(
    question: 'How do I set a transaction PIN?',
    answer:
        'Go to Settings → Transaction PIN to set or change your 4-digit PIN. This PIN is required to authorise all purchases.',
  ),
];

// ── Main support screen ────────────────────────────────────
class SupportScreen extends ConsumerStatefulWidget {
  const SupportScreen({super.key});

  @override
  ConsumerState<SupportScreen> createState() => _SupportScreenState();
}

class _SupportScreenState extends ConsumerState<SupportScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _launchWhatsApp() async {
    final url = Uri.parse(
      'https://wa.me/${AppConfig.supportWhatsApp.replaceAll('+', '')}?text=Hello%20Imam%20Datasub%20Support',
    );
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      context.showSnackBar('WhatsApp not available on this device',
          isError: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(AppStrings.support),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Contact'),
            Tab(text: 'My tickets'),
            Tab(text: 'FAQ'),
          ],
          labelStyle: const TextStyle(
              fontSize: 13, fontWeight: FontWeight.w700),
        ),
      ),
      body: SafeArea(
        top: false,
        child: TabBarView(
          controller: _tabs,
          children: [
            _ContactTab(onWhatsApp: _launchWhatsApp),
            const _TicketsTab(),
            const _FaqTab(),
          ],
        ),
      ),
    );
  }
}

// ── Contact tab ────────────────────────────────────────────
class _ContactTab extends StatelessWidget {
  const _ContactTab({required this.onWhatsApp});
  final VoidCallback onWhatsApp;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          Text('How can we help?',
              style: context.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(
            'Our support team is available 24/7. Choose your preferred channel.',
            style: context.textTheme.bodyMedium
                ?.copyWith(color: AppColors.neutral500),
          ),
          const SizedBox(height: 24),

          _ContactCard(
            icon: Icons.support_agent_rounded,
            title: AppStrings.liveChat,
            subtitle: 'Chat with us in real-time',
            color: AppColors.primary500,
            onTap: () => context.showSnackBar(
                'Live chat coming soon. Use WhatsApp for now.'),
          ),
          const SizedBox(height: 12),
          _ContactCard(
            icon: Icons.chat_rounded,
            title: AppStrings.whatsapp,
            subtitle: 'Message us on WhatsApp',
            color: AppColors.success600,
            onTap: onWhatsApp,
          ),
          const SizedBox(height: 12),
          _ContactCard(
            icon: Icons.email_outlined,
            title: 'Email support',
            subtitle: AppConfig.supportEmail,
            color: AppColors.secondary500,
            onTap: () => launchUrl(
              Uri.parse('mailto:${AppConfig.supportEmail}'),
            ),
          ),
          const SizedBox(height: 32),

          // ── New ticket ─────────────────────────────────
          Text('Open a support ticket',
              style: context.textTheme.titleSmall),
          const SizedBox(height: 12),
          _NewTicketForm(),
        ],
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: KDCard(
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 24),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(subtitle,
                      style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.neutral500)),
                ],
              ),
            ),
            Icon(Icons.arrow_forward_ios_rounded,
                size: 14, color: AppColors.neutral400),
          ],
        ),
      ),
    );
  }
}

// ── New ticket form ────────────────────────────────────────
class _NewTicketForm extends ConsumerStatefulWidget {
  @override
  ConsumerState<_NewTicketForm> createState() => _NewTicketFormState();
}

class _NewTicketFormState extends ConsumerState<_NewTicketForm> {
  final _subjectController = TextEditingController();
  final _messageController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _subjectController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_subjectController.text.trim().isEmpty ||
        _messageController.text.trim().isEmpty) {
      context.showSnackBar('Please fill in all fields', isError: true);
      return;
    }
    context.hideKeyboard();
    setState(() => _isSubmitting = true);

    try {
      final dio = ref.read(dioClientProvider);
      await dio.post(
        AppEndpoints.createTicket,
        data: {
          'subject': _subjectController.text.trim(),
          'message': _messageController.text.trim(),
        },
      );

      if (mounted) {
        _subjectController.clear();
        _messageController.clear();
        context.showSnackBar('Ticket created! We\'ll respond within 24 hours.');
        ref.invalidate(myTicketsProvider);
      }
    } catch (e) {
      if (mounted) {
        context.showSnackBar('Failed to create ticket. Please try again.',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return KDCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KDTextField(
            controller: _subjectController,
            label: 'Subject',
            hint: 'e.g. Data purchase not delivered',
            prefixIcon: Icons.subject_rounded,
          ),
          const SizedBox(height: 14),
          KDTextField(
            controller: _messageController,
            label: 'Message',
            hint: 'Describe your issue in detail...',
            maxLines: 4,
            contentPadding: const EdgeInsets.all(14),
          ),
          const SizedBox(height: 16),
          KDButton(
            label: AppStrings.newTicket,
            onPressed: _submit,
            isLoading: _isSubmitting,
            gradient: AppColors.primaryGradient,
            height: AppDimensions.buttonHeightMD,
          ),
        ],
      ),
    );
  }
}

// ── Tickets tab ────────────────────────────────────────────
class _TicketsTab extends ConsumerWidget {
  const _TicketsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ticketsAsync = ref.watch(myTicketsProvider);

    return ticketsAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppDimensions.screenPaddingH),
        child: ListItemShimmer(count: 4),
      ),
      error: (_, __) => KDErrorState(
        message: 'Could not load tickets',
        onRetry: () => ref.invalidate(myTicketsProvider),
      ),
      data: (tickets) {
        if (tickets.isEmpty) {
          return const KDEmptyState(
            title: 'No tickets yet',
            message:
                'Create a support ticket from the Contact tab when you need help.',
            icon: Icons.confirmation_number_outlined,
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(myTicketsProvider.future),
          child: ListView.separated(
            padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
            itemCount: tickets.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, index) {
              final ticket = tickets[index];
              return KDCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            ticket.subject,
                            style: const TextStyle(
                                fontWeight: FontWeight.w700),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: ticket.isOpen
                                ? AppColors.success50
                                : AppColors.neutral100,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            ticket.status.capitalize,
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: ticket.isOpen
                                  ? AppColors.success700
                                  : AppColors.neutral600,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (ticket.lastMessage != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        ticket.lastMessage!,
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.neutral500),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      AppFormatters.formatRelativeDate(ticket.createdAt),
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.neutral400),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ── FAQ tab ────────────────────────────────────────────────
class _FaqTab extends StatefulWidget {
  const _FaqTab();

  @override
  State<_FaqTab> createState() => _FaqTabState();
}

class _FaqTabState extends State<_FaqTab> {
  int? _expanded;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
      itemCount: _faqs.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final faq = _faqs[index];
        final isExpanded = _expanded == index;

        return KDCard(
          onTap: () => setState(
              () => _expanded = isExpanded ? null : index),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      faq.question,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: isExpanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: context.colors.primary,
                    ),
                  ),
                ],
              ),
              AnimatedCrossFade(
                firstChild: const SizedBox.shrink(),
                secondChild: Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    faq.answer,
                    style: context.textTheme.bodyMedium?.copyWith(
                      color: AppColors.neutral500,
                      height: 1.5,
                    ),
                  ),
                ),
                crossFadeState: isExpanded
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
                duration: const Duration(milliseconds: 250),
              ),
            ],
          ),
        );
      },
    );
  }
}
