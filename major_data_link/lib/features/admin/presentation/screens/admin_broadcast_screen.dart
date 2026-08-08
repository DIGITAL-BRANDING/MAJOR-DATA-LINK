import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';
import '../../data/admin_pricing_repository.dart';
import '../providers/admin_pricing_provider.dart';

class AdminBroadcastScreen extends ConsumerStatefulWidget {
  const AdminBroadcastScreen({super.key});

  @override
  ConsumerState<AdminBroadcastScreen> createState() =>
      _AdminBroadcastScreenState();
}

class _AdminBroadcastScreenState extends ConsumerState<AdminBroadcastScreen> {
  final _titleController = TextEditingController();
  final _bodyController = TextEditingController();
  String _audience = 'ALL_USERS';
  bool _sending = false;

  @override
  void dispose() {
    _titleController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final title = _titleController.text.trim();
    final body = _bodyController.text.trim();
    if (title.isEmpty || body.isEmpty) {
      context.showSnackBar('Enter a title and message', isError: true);
      return;
    }

    setState(() => _sending = true);
    try {
      final count = await ref
          .read(adminPricingRepositoryProvider)
          .sendBroadcast(title: title, body: body, audience: _audience);
      _titleController.clear();
      _bodyController.clear();
      ref.invalidate(adminBroadcastHistoryProvider);
      if (mounted) context.showSnackBar('Sent to $count user(s)');
    } catch (e) {
      if (mounted) context.showSnackBar(e.toString(), isError: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final history = ref.watch(adminBroadcastHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Send Notification')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
          children: [
            KDCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'New broadcast',
                    style: context.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 12),
                  KDTextField(
                    controller: _titleController,
                    label: 'Title',
                  ),
                  const SizedBox(height: 12),
                  KDTextField(
                    controller: _bodyController,
                    label: 'Message',
                    maxLines: 4,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _audience,
                    decoration: const InputDecoration(labelText: 'Audience'),
                    items: const [
                      DropdownMenuItem(
                          value: 'ALL_USERS', child: Text('All users')),
                      DropdownMenuItem(
                          value: 'KYC_VERIFIED_ONLY',
                          child: Text('KYC verified only')),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => _audience = value);
                    },
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: KDButton(
                      label: 'Send',
                      isLoading: _sending,
                      onPressed: _sending ? null : _send,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Recent broadcasts',
              style: context.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            history.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, _) => Padding(
                padding: const EdgeInsets.all(16),
                child: Text(error.toString()),
              ),
              data: (broadcasts) {
                if (broadcasts.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No broadcasts sent yet'),
                  );
                }
                return Column(
                  children: broadcasts
                      .map((b) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: KDCard(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    b.title,
                                    style: context.textTheme.titleSmall
                                        ?.copyWith(
                                            fontWeight: FontWeight.w800),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    b.body,
                                    style: context.textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    '${b.recipientCount} recipient(s) • '
                                    '${b.readCount} read • by ${b.sentBy}',
                                    style: context.textTheme.bodySmall
                                        ?.copyWith(
                                            color: AppColors.neutral500),
                                  ),
                                ],
                              ),
                            ),
                          ))
                      .toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
