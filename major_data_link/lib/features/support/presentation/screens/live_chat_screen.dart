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
          ..addAll((data['messages'] as List? ?? const []).whereType<Map>());
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
      appBar: AppBar(title: const Text('Live Chat')),
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
            child: _messages.isEmpty
                ? const Center(
                    child: Text(
                      'Send a message to begin chatting with support.',
                    ),
                  )
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) {
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
                                ? Theme.of(context).colorScheme.primary
                                : Colors.white,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Text(
                            m['body']?.toString() ?? '',
                            style: TextStyle(
                              color: mine ? Colors.white : Colors.black87,
                            ),
                          ),
                        ),
                      );
                    },
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
                      onSubmitted: (_) => _send(),
                      decoration: InputDecoration(
                        counterText: '',
                        hintText: _closed
                            ? 'This conversation was closed.'
                            : 'Write a message…',
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
