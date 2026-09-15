import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/constants/app_dimensions.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../shared/widgets/kd_button.dart';
import '../../../../shared/widgets/kd_card.dart';
import '../../../../shared/widgets/kd_text_field.dart';

/// Manual services are intentionally submitted as support tickets: the
/// backend's admin team processes them and sends the finished document to
/// Deliveries, exactly like the browser application.
class ManualServiceRequestScreen extends ConsumerStatefulWidget {
  const ManualServiceRequestScreen({
    super.key,
    required this.title,
    required this.prompt,
    this.cac = false,
  });

  final String title;
  final String prompt;
  final bool cac;

  @override
  ConsumerState<ManualServiceRequestScreen> createState() =>
      _ManualServiceRequestScreenState();
}

class _ManualServiceRequestScreenState
    extends ConsumerState<ManualServiceRequestScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _business = TextEditingController();
  final _phone = TextEditingController();
  final _details = TextEditingController();
  String _cacType = 'CAC Business Name Registration';
  bool _sending = false;

  @override
  void dispose() {
    _name.dispose();
    _business.dispose();
    _phone.dispose();
    _details.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    context.hideKeyboard();
    setState(() => _sending = true);
    final subject = widget.cac ? 'CAC Service: $_cacType' : widget.title;
    final message = widget.cac
        ? 'CAC service requested: $_cacType\n\nCustomer name: ${_name.text.trim()}\nBusiness name: ${_business.text.trim()}\nPhone: ${_phone.text.trim()}\nAdditional details: ${_details.text.trim().isEmpty ? 'None' : _details.text.trim()}'
        : '${widget.prompt}\n\nCustomer name: ${_name.text.trim()}\nPhone: ${_phone.text.trim()}\nDetails: ${_details.text.trim()}';
    try {
      await ref
          .read(dioClientProvider)
          .post(
            AppEndpoints.createTicket,
            data: {'subject': subject, 'message': message},
          );
      if (!mounted) return;
      _formKey.currentState!.reset();
      _name.clear();
      _business.clear();
      _phone.clear();
      _details.clear();
      context.showSnackBar(
        'Request sent. We will update you when it is processed.',
      );
    } catch (_) {
      if (mounted)
        context.showSnackBar(
          'Unable to send request. Please try again.',
          isError: true,
        );
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.title)),
    body: SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppDimensions.screenPaddingH),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              KDCard(
                backgroundColor: AppColors.primary50,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      widget.cac
                          ? Icons.business_center_outlined
                          : Icons.assignment_outlined,
                      color: AppColors.primary600,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      widget.title,
                      style: context.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(widget.prompt),
                    const SizedBox(height: 12),
                    const Text(
                      'Completed documents are sent securely to Deliveries.',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.neutral600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              if (widget.cac) ...[
                DropdownButtonFormField<String>(
                  value: _cacType,
                  decoration: const InputDecoration(labelText: 'CAC service'),
                  items:
                      const [
                            'CAC Business Name Registration',
                            'CAC Company Registration',
                            'CAC Verification',
                          ]
                          .map(
                            (value) => DropdownMenuItem(
                              value: value,
                              child: Text(value),
                            ),
                          )
                          .toList(),
                  onChanged: (value) => setState(() => _cacType = value!),
                ),
                const SizedBox(height: 16),
              ],
              KDTextField(
                controller: _name,
                label: 'Your full name',
                prefixIcon: Icons.person_outline,
                validator: (v) => (v == null || v.trim().length < 3)
                    ? 'Enter your full name'
                    : null,
              ),
              const SizedBox(height: 16),
              if (widget.cac) ...[
                KDTextField(
                  controller: _business,
                  label: 'Business / company name',
                  prefixIcon: Icons.business_outlined,
                  validator: (v) => (v == null || v.trim().length < 2)
                      ? 'Enter the business name'
                      : null,
                ),
                const SizedBox(height: 16),
              ],
              KDTextField(
                controller: _phone,
                label: 'Phone number',
                prefixIcon: Icons.phone_outlined,
                keyboardType: TextInputType.phone,
                validator: (v) => (v == null || v.trim().length < 7)
                    ? 'Enter a valid phone number'
                    : null,
              ),
              const SizedBox(height: 16),
              KDTextField(
                controller: _details,
                label: widget.cac
                    ? 'Other details (optional)'
                    : 'Request details',
                hint: 'Do not share passwords or OTPs.',
                maxLines: 5,
                validator: widget.cac
                    ? null
                    : (v) => (v == null || v.trim().length < 3)
                          ? 'Please provide request details'
                          : null,
              ),
              const SizedBox(height: 24),
              KDButton(
                label: 'Send request',
                icon: Icons.send_outlined,
                isLoading: _sending,
                onPressed: _submit,
                gradient: AppColors.primaryGradient,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
