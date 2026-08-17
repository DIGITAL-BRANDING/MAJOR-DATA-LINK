import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/config/app_endpoints.dart';
import '../../../../core/network/dio_client.dart';

class DeliveriesScreen extends ConsumerStatefulWidget {
  const DeliveriesScreen({super.key});
  @override
  ConsumerState<DeliveriesScreen> createState() => _DeliveriesScreenState();
}

class _DeliveriesScreenState extends ConsumerState<DeliveriesScreen> {
  List<Map<String, dynamic>> _items = [];
  String? _error;
  bool _loading = true;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ref.read(dioProvider).get(AppEndpoints.deliveryList);
      setState(
        () => _items = List<Map<String, dynamic>>.from(r.data['data'] ?? []),
      );
    } on DioException catch (e) {
      setState(
        () => _error =
            e.response?.data?['message']?.toString() ??
            'Unable to load deliveries.',
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _download(String id) async {
    try {
      final r = await ref
          .read(dioProvider)
          .get(AppEndpoints.deliveryDownload(id));
      final url = Uri.tryParse(r.data['data']?['url']?.toString() ?? '');
      if (url == null ||
          !await launchUrl(url, mode: LaunchMode.externalApplication))
        throw Exception();
    } catch (_) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Unable to open download. Please try again.'),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('My Deliveries')),
    body: RefreshIndicator(
      onRefresh: _load,
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
          ? ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(_error!),
                ),
              ],
            )
          : _items.isEmpty
          ? ListView(
              children: const [
                SizedBox(height: 180),
                Center(child: Text('No deliveries yet.')),
              ],
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final d = _items[i];
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.file_download_outlined),
                    title: Text(d['title']?.toString() ?? 'Delivery'),
                    subtitle: Text(
                      '${d['file_name'] ?? ''}\n${d['created_at'] ?? ''}',
                    ),
                    isThreeLine: true,
                    trailing: IconButton(
                      icon: const Icon(Icons.download_rounded),
                      onPressed: () => _download(d['id'].toString()),
                    ),
                  ),
                );
              },
            ),
    ),
  );
}
