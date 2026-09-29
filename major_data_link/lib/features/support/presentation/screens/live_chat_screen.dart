import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../../core/config/app_config.dart';
import '../../../../core/di/injection.dart';

class LiveChatScreen extends ConsumerStatefulWidget {
  const LiveChatScreen({super.key});
  @override
  ConsumerState<LiveChatScreen> createState() => _LiveChatScreenState();
}

class _LiveChatScreenState extends ConsumerState<LiveChatScreen> {
  final _draft = TextEditingController();
  final _scroll = ScrollController();
  final _messages = <Map<dynamic, dynamic>>[];
  io.Socket? _socket;
  bool _connected = false;
  bool _closed = false;
  bool _agentTyping = false;
  String? _error;
  @override
  void initState() {
    super.initState();
    unawaited(_connect());
  }

  Future<void> _connect() async {
    final token = await ref.read(secureStorageProvider).getAccessToken();
    if (!mounted) return;
    if (token == null || token.isEmpty) {
      setState(() => _error = 'Please sign in again to use live chat.');
      return;
    }
    final api = Uri.parse(AppConfig.baseUrl);
    final origin = '${api.scheme}://${api.authority}';
    final socket = io.io(
      origin,
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setPath('/socket.io')
          .setAuth({'token': token})
          .enableReconnection()
          .build(),
    );
    _socket = socket;
    socket.onConnect((_) {
      if (mounted)
        setState(() {
          _connected = true;
          _error = null;
        });
    });
    socket.onDisconnect((_) {
      if (mounted) setState(() => _connected = false);
    });
    socket.onConnectError((_) {
      if (mounted) setState(() => _error = 'Unable to connect to support.');
    });
    socket.on('chat:history', (data) {
      if (data is! Map || !mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(
            (data['messages'] as List? ?? const [])
                .whereType<Map<dynamic, dynamic>>(),
          );
        _closed = data['status'] == 'CLOSED';
      });
      _scrollEnd();
    });
    socket.on('chat:message', (data) {
      if (data is! Map || !mounted) return;
      final id = data['id']?.toString();
      if (_messages.any((m) => m['id']?.toString() == id)) return;
      setState(() => _messages.add(data));
      _scrollEnd();
    });
    socket.on('chat:closed', (_) {
      if (mounted) setState(() => _closed = true);
    });
    socket.on('chat:typing', (data) {
      if (data is Map && data['sender_type'] == 'ADMIN' && mounted) {
        setState(() => _agentTyping = data['typing'] == true);
      }
    });
  }

  void _scrollEnd() => WidgetsBinding.instance.addPostFrameCallback((_) {
    if (_scroll.hasClients)
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
      );
  });
  void _send() {
    final body = _draft.text.trim();
    if (body.isEmpty || !_connected || _closed) return;
    _socket?.emit('chat:send', {'body': body});
    _draft.clear();
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _draft.dispose();
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            const CircleAvatar(
              radius: 18,
              backgroundColor: Colors.white24,
              child: Icon(Icons.support_agent_rounded, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Support', style: TextStyle(fontSize: 16)),
                Text(
                  _agentTyping
                      ? 'typing…'
                      : _connected
                      ? 'Online — usually replies quickly'
                      : 'Connecting…',
                  style: const TextStyle(fontSize: 11),
                ),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            color: Colors.amber.shade50,
            child: const Text(
              'Chat only with support. Never send your PIN, OTP, card, NIN, or BVN here.',
              style: TextStyle(fontSize: 12),
            ),
          ),
          if (_error != null)
            Padding(padding: const EdgeInsets.all(12), child: Text(_error!)),
          Expanded(
            child: Container(
              color: const Color(0xFFF4EFE3),
              child: _messages.isEmpty
                  ? const Center(
                      child: Text(
                        'Send a message to begin chatting with support.',
                      ),
                    )
                  : ListView.builder(
                      controller: _scroll,
                      padding: const EdgeInsets.all(16),
                      itemCount: _messages.length + (_agentTyping ? 1 : 0),
                      itemBuilder: (_, i) {
                        if (i == _messages.length) {
                          return const _TypingBubble();
                        }
                        final m = _messages[i];
                        final mine = m['sender_type'] == 'USER';
                        return Align(
                          alignment: mine
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 10),
                            padding: const EdgeInsets.all(11),
                            constraints: const BoxConstraints(maxWidth: 290),
                            decoration: BoxDecoration(
                              color: mine
                                  ? const Color(0xFFDCF8C6)
                                  : Colors.white,
                              borderRadius: BorderRadius.only(
                                topLeft: const Radius.circular(16),
                                topRight: const Radius.circular(16),
                                bottomLeft: Radius.circular(mine ? 16 : 3),
                                bottomRight: Radius.circular(mine ? 3 : 16),
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x14000000),
                                  blurRadius: 2,
                                ),
                              ],
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  m['body']?.toString() ?? '',
                                  style: const TextStyle(color: Colors.black87),
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  _timeLabel(m['created_at']),
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey.shade600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _draft,
                      enabled: _connected && !_closed,
                      maxLength: 4000,
                      minLines: 1,
                      maxLines: 4,
                      textCapitalization: TextCapitalization.sentences,
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: _closed
                            ? 'This conversation was closed.'
                            : 'Write a message…',
                        filled: true,
                        fillColor: const Color(0xFFF7F7F7),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(24),
                        ),
                      ),
                    ),
                  ),
                  IconButton.filled(
                    onPressed: _connected && !_closed ? _send : null,
                    icon: const Icon(Icons.send_rounded),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _timeLabel(dynamic value) {
  final time = DateTime.tryParse(value?.toString() ?? '')?.toLocal();
  if (time == null) return '';
  final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
  return '$hour:${time.minute.toString().padLeft(2, '0')} ${time.hour >= 12 ? 'PM' : 'AM'}';
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();
  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [_Dot(), _Dot(), _Dot()],
      ),
    ),
  );
}

class _Dot extends StatelessWidget {
  const _Dot();
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(horizontal: 2),
    child: Icon(Icons.circle, size: 6, color: Colors.grey),
  );
}
