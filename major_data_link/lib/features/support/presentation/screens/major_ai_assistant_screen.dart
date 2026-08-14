import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/utils/extensions.dart';

/// A support conversation backed by the app's own ticket API.
///
/// The "AI" name is intentionally a product label: messages are routed to
/// MAJOR DATA-LINK support staff and no third-party AI service is contacted.
class MajorAiAssistantScreen extends ConsumerStatefulWidget {
  const MajorAiAssistantScreen({super.key, this.ticketId});

  final String? ticketId;

  @override
  ConsumerState<MajorAiAssistantScreen> createState() =>
      _MajorAiAssistantScreenState();
}

class _MajorAiAssistantScreenState
    extends ConsumerState<MajorAiAssistantScreen>
    with WidgetsBindingObserver {
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _poller;
  String? _ticketId;
  String _subject = 'MAJOR AI Assistant support';
  String _status = 'OPEN';
  List<_ChatMessage> _messages = const [];
  bool _isLoading = true;
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticketId = widget.ticketId;
    if (_ticketId != null) {
      _loadThread();
    } else {
      _isLoading = false;
    }
    _poller = Timer.periodic(const Duration(seconds: 8), (_) => _loadThread());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadThread();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poller?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadThread() async {
    final ticketId = _ticketId;
    if (ticketId == null) return;
    try {
      final response = await ref.read(dioClientProvider).get(AppEndpoints.ticket(ticketId));
      final data = response.data['data'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _subject = data['subject']?.toString() ?? _subject;
        _status = data['status']?.toString() ?? _status;
        _messages = ((data['messages'] ?? []) as List<dynamic>)
            .map((item) => _ChatMessage.fromJson(item as Map<String, dynamic>))
            .toList();
        _isLoading = false;
      });
      _scrollToEnd();
    } on DioException {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _send() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    context.hideKeyboard();
    setState(() => _isSending = true);
    try {
      final dio = ref.read(dioClientProvider);
      if (_ticketId == null) {
        final response = await dio.post(
          AppEndpoints.createTicket,
          data: {'subject': _subject, 'message': text},
        );
        _ticketId = (response.data['data'] as Map<String, dynamic>)['id']?.toString();
      } else {
        await dio.post(AppEndpoints.ticketMessages(_ticketId!), data: {'message': text});
      }
      _messageController.clear();
      await _loadThread();
    } on DioException {
      if (mounted) {
        context.showSnackBar('Unable to send your message. Please try again.', isError: true);
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final isOpen = _status.toUpperCase() != 'CLOSED';
    return Scaffold(
      appBar: AppBar(
        title: const Text('MAJOR AI Assistant'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: Text(
                isOpen ? 'Online' : 'Resolved',
                style: TextStyle(
                  color: isOpen ? AppColors.success600 : AppColors.neutral500,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          _AssistantNotice(isExistingThread: _ticketId != null),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
                    itemCount: _messages.length + 1,
                    itemBuilder: (context, index) {
                      if (index == 0) return const _WelcomeBubble();
                      return _MessageBubble(message: _messages[index - 1]);
                    },
                  ),
          ),
          _Composer(
            controller: _messageController,
            isSending: _isSending,
            onSend: _send,
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  const _ChatMessage({required this.text, required this.isUser, required this.createdAt});

  factory _ChatMessage.fromJson(Map<String, dynamic> json) => _ChatMessage(
        text: json['message']?.toString() ?? '',
        isUser: json['sender_type']?.toString().toUpperCase() == 'USER',
        createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ?? DateTime.now(),
      );

  final String text;
  final bool isUser;
  final DateTime createdAt;
}

class _AssistantNotice extends StatelessWidget {
  const _AssistantNotice({required this.isExistingThread});

  final bool isExistingThread;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        color: AppColors.primary50,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Text(
          isExistingThread
              ? 'New replies are checked automatically while this chat is open.'
              : 'Your first message opens a private support chat with our team.',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 12, color: AppColors.primary700),
        ),
      );
}

class _WelcomeBubble extends StatelessWidget {
  const _WelcomeBubble();

  @override
  Widget build(BuildContext context) => const _Bubble(
        alignment: Alignment.centerLeft,
        color: AppColors.neutral100,
        textColor: AppColors.neutral800,
        text: 'Hello! I am MAJOR AI Assistant. Tell us what you need help with and our support team will reply here. This chat uses MAJOR DATA-LINK support only—no external AI service is used.',
      );
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final _ChatMessage message;

  @override
  Widget build(BuildContext context) => _Bubble(
        alignment: message.isUser ? Alignment.centerRight : Alignment.centerLeft,
        color: message.isUser ? AppColors.primary600 : AppColors.neutral100,
        textColor: message.isUser ? Colors.white : AppColors.neutral800,
        text: message.text,
      );
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.alignment, required this.color, required this.textColor, required this.text});

  final Alignment alignment;
  final Color color;
  final Color textColor;
  final String text;

  @override
  Widget build(BuildContext context) => Align(
        alignment: alignment,
        child: Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          constraints: const BoxConstraints(maxWidth: 300),
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(16)),
          child: Text(text, style: TextStyle(color: textColor, height: 1.35)),
        ),
      );
}

class _Composer extends StatelessWidget {
  const _Composer({required this.controller, required this.isSending, required this.onSend});

  final TextEditingController controller;
  final bool isSending;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  minLines: 1,
                  maxLines: 4,
                  textCapitalization: TextCapitalization.sentences,
                  decoration: const InputDecoration(hintText: 'Type your message...', border: OutlineInputBorder()),
                  onSubmitted: (_) => onSend(),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: isSending ? null : onSend,
                icon: isSending
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send_rounded),
              ),
            ],
          ),
        ),
      );
}
