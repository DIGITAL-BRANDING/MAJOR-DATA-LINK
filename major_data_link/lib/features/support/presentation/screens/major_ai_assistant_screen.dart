import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/config/app_endpoints.dart';
import '../../../../core/constants/app_colors.dart';
import '../../../../core/di/injection.dart';
import '../../../../shared/widgets/pin_confirmation_sheet.dart';

/// A deterministic, transaction-safe service assistant.
/// It does not call an external LLM and never receives a transaction PIN in chat.
class MajorAiAssistantScreen extends ConsumerStatefulWidget {
  const MajorAiAssistantScreen({super.key, this.ticketId});
  final String? ticketId;

  @override
  ConsumerState<MajorAiAssistantScreen> createState() =>
      _MajorAiAssistantScreenState();
}

enum _Language { choose, hausa, english }

enum _Task { choose, data, airtime, fund }

enum _Step { language, task, network, dataType, phone, plan, amount, review, done }

class _MajorAiAssistantScreenState
    extends ConsumerState<MajorAiAssistantScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<_Message> _messages = [];
  _Language _language = _Language.choose;
  _Task _task = _Task.choose;
  _Step _step = _Step.language;
  String? _network;
  String? _dataType;
  String? _phone;
  double? _amount;
  List<Map<String, dynamic>> _plans = const [];
  Map<String, dynamic>? _plan;
  bool _busy = false;

  bool get _hausa => _language == _Language.hausa;
  String get _t => _hausa ? 'MAJOR Mataimaki' : 'MAJOR Assistant';
  String tr(String en, String ha) => _hausa ? ha : en;

  @override
  void initState() {
    super.initState();
    _bot(
      'Sannu! Welcome to MAJOR AI Assistant.\n\nPlease choose a language / Zaɓi yaren tattaunawa:',
      options: const ['Hausa', 'English'],
    );
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _bot(String text, {List<String> options = const []}) {
    setState(() => _messages.add(_Message(text, false, options)));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients)
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
    });
  }

  void _user(String text) {
    setState(() => _messages.add(_Message(text, true, const [])));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 220), curve: Curves.easeOut);
      }
    });
  }

  Future<void> _answer(String value) async {
    final text = value.trim();
    if (text.isEmpty || _busy) return;
    _input.clear();
    _user(text);
    final normalized = text.toLowerCase();
    if (_step == _Step.task && RegExp(r'(fund|top ?up|wallet|cika wallet|saka kudi|add money|deposit)').hasMatch(normalized)) {
      setState(() { _task = _Task.fund; _step = _Step.amount; });
      _bot(tr('How much would you like to add to your wallet?', 'Nawa kake so ka saka a wallet ɗinka?'));
      return;
    }
    final mentionedNetwork = _parseNetwork(normalized);
    if (mentionedNetwork != null && _network != null && mentionedNetwork != _network && _step != _Step.language && _step != _Step.task) {
      setState(() { _network = mentionedNetwork; _dataType = null; _plans = const []; _plan = null; _step = _task == _Task.data ? _Step.dataType : _Step.phone; });
      _bot(tr('Okay, I changed the network to $mentionedNetwork. Let us continue.', 'To, na canza network zuwa $mentionedNetwork. Mu ci gaba.'), options: _task == _Task.data ? const ['Corporate', 'Data Share', 'Gifting', 'SME', 'SME 2', 'Data Coupon'] : const []);
      return;
    }
    if (RegExp(
      r"(support|agent|human|live chat|ma'aikaci|mutum)",
    ).hasMatch(normalized)) {
      await _fallback('Customer requested human support');
      return;
    }
    if (_step == _Step.language) {
      setState(() {
        _language = normalized.contains('hausa')
            ? _Language.hausa
            : _Language.english;
        _step = _Step.task;
      });
      _bot(
        tr('What would you like to do?', 'Me kake so in taimaka maka da shi?'),
        options: [
          tr('Buy Data', 'Siyan Data'),
          tr('Buy Airtime', 'Siyan Airtime'),
          tr('Fund Wallet', 'Cika Wallet'),
        ],
      );
    } else if (_step == _Step.task) {
      Map<String, dynamic>? parsed;
      if (RegExp(r'(last|saved|previous|karshe|ajiye)').hasMatch(normalized)) {
        try {
          final response = await ref
              .read(dioClientProvider)
              .get(AppEndpoints.assistantBeneficiaries);
          final recipients = ((response.data['data'] ?? []) as List<dynamic>)
              .cast<Map<String, dynamic>>();
          final wanted = normalized.contains('data')
              ? 'data'
              : normalized.contains('airtime')
              ? 'airtime'
              : null;
          final recipient = recipients.cast<Map<String, dynamic>?>().firstWhere(
            (item) =>
                item != null && (wanted == null || item['type'] == wanted),
            orElse: () => null,
          );
          if (recipient == null) {
            _bot(
              tr(
                'I could not find a saved recipient yet. Please provide the phone number.',
                'Ban samu saved recipient ba tukuna. Rubuta lambar waya.',
              ),
            );
            setState(() => _step = _Step.phone);
            return;
          }
          parsed = {
            'workflow': recipient['type'],
            'fields': {
              'phone': recipient['phone'],
              'network': recipient['network'],
            },
          };
          _bot(
            tr(
              'I found ${recipient['phone']} as your recent recipient.',
              'Na samu ${recipient['phone']} a recent recipients.',
            ),
          );
        } on DioException {
          _bot(
            tr(
              'I could not load saved recipients. Please provide the phone number.',
              'Ba a iya ɗauko saved recipients ba. Rubuta lambar waya.',
            ),
          );
          setState(() => _step = _Step.phone);
          return;
        }
      } else {
        parsed = await _parseIntent(text);
      }
      unawaited(_audit(stage: _step.name, outcome: 'waiting'));
      final fields = parsed?['fields'] as Map<String, dynamic>? ?? const {};
      final workflow = parsed?['workflow']?.toString();
      if (workflow != null && workflow != 'data' && workflow != 'airtime') {
        _bot(
          tr(
            'I recognise that service, but its secure purchase workflow is not active yet. Please use its service page for now.',
            'Na gane wannan sabis, amma secure purchase workflow ɗinsa bai fara aiki ba tukuna. Yi amfani da service page ɗinsa a yanzu.',
          ),
          options: [tr('Talk to support', 'Yi magana da support')],
        );
        return;
      }
      final isData =
          parsed?['workflow'] == 'data' ||
          normalized.contains('data') ||
          normalized.contains('bundle');
      final network = fields['network']?.toString();
      final phone = fields['phone']?.toString();
      final amount = _number(fields['amount']);
      setState(() {
        _task = isData ? _Task.data : _Task.airtime;
        _network = network;
        _phone = phone;
      });
      if (network == null) {
        setState(() => _step = _Step.network);
        _bot(
          tr(
            'Which network: MTN, Airtel, Glo or 9mobile?',
            'Wanne layi/network: MTN, Airtel, Glo ko 9mobile?',
          ),
          options: const ['MTN', 'Airtel', 'Glo', '9mobile'],
        );
        return;
      }
      final dataType = fields['data_type']?.toString();
      if (isData && dataType == null) {
        setState(() { _network = network; _step = _Step.dataType; });
        _bot(tr('Which data type: Corporate, Data Share, Gifting, SME, SME 2 or Data Coupon?', 'Wanne nau’in Data: Corporate, Data Share, Gifting, SME, SME 2 ko Data Coupon?'), options: const ['Corporate', 'Data Share', 'Gifting', 'SME', 'SME 2', 'Data Coupon']);
        return;
      }
      if (phone == null) {
        setState(() => _step = _Step.phone);
        _bot(
          tr(
            'Enter the Nigerian phone number to receive it.',
            'Rubuta lambar Najeriya da za a tura mata.',
          ),
        );
        return;
      }
      if (isData) {
        setState(() => _step = _Step.plan);
        await _loadPlans();
        return;
      }
      if (amount <= 0) {
        setState(() => _step = _Step.amount);
        _bot(
          tr(
            'How much airtime should I buy? (e.g. 500)',
            'Nawa zan saya na airtime? (misali 500)',
          ),
        );
        return;
      }
      _bot(
        tr(
          'Checking your wallet before confirmation…',
          'Ana duba wallet ɗinka kafin tabbatarwa…',
        ),
      );
      setState(() {
        _amount = amount;
        _step = _Step.review;
      });
      await _review();
    } else if (_step == _Step.network) {
      final network = _parseNetwork(normalized);
      if (network == null) {
        _bot(
          tr(
            'Please choose MTN, Airtel, Glo or 9mobile.',
            'Don Allah zaɓi MTN, Airtel, Glo ko 9mobile.',
          ),
        );
        return;
      }
      setState(() {
        _network = network;
        _step = _task == _Task.data ? _Step.dataType : _Step.phone;
      });
      if (_task == _Task.data) {
        _bot(tr('Which data type: Corporate, Data Share, Gifting, SME, SME 2 or Data Coupon?', 'Wanne nau’in Data: Corporate, Data Share, Gifting, SME, SME 2 ko Data Coupon?'), options: const ['Corporate', 'Data Share', 'Gifting', 'SME', 'SME 2', 'Data Coupon']);
        return;
      }
      _bot(
        tr(
          'Enter the Nigerian phone number to receive it.',
          'Rubuta lambar Najeriya da za a tura mata.',
        ),
      );
    } else if (_step == _Step.dataType) {
      final dataType = normalized.contains('corporate') ? 'CORPORATE' : normalized.contains('share') ? 'DATA SHARE' : normalized.contains('gift') ? 'GIFTING' : (normalized.contains('sme 2') || normalized.contains('sme2')) ? 'SME2' : normalized.contains('coupon') ? 'DATA COUPON' : normalized.contains('sme') ? 'SME' : null;
      if (dataType == null) { _bot(tr('Please choose one of the data types.', 'Zaɓi ɗaya daga cikin nau’in Data.')); return; }
      setState(() { _dataType = dataType; _step = _Step.phone; });
      _bot(tr('Enter the Nigerian phone number to receive it.', 'Rubuta lambar Najeriya da za a tura mata.'));
    } else if (_step == _Step.phone) {
      final phone = text.replaceAll(RegExp(r'\D'), '');
      if (phone.length != 11 || !phone.startsWith('0')) {
        _bot(
          tr(
            'Please enter a valid 11-digit Nigerian number.',
            'Don Allah rubuta ingantacciyar lamba mai digit 11.',
          ),
        );
        return;
      }
      setState(() {
        _phone = phone;
        _step = _task == _Task.data ? _Step.plan : _Step.amount;
      });
      if (_task == _Task.data)
        await _loadPlans();
      else
        _bot(
          tr(
            'How much airtime should I buy? (e.g. 500)',
            'Nawa zan saya na airtime? (misali 500)',
          ),
        );
    } else if (_step == _Step.plan) {
      final cleaned = normalized.replaceAll(RegExp(r'[^a-z0-9.]'), '');
      final chosen = _plans
          .where(
            (p) =>
                '${p['name']} ${p['size']} ${p['price'] ?? p['amount']}'.toLowerCase().replaceAll(RegExp(r'[^a-z0-9.]'), '').contains(cleaned),
          )
          .toList();
      final plan = chosen.isNotEmpty
          ? chosen.first
          : (_plans.length == 1 ? _plans.first : null);
      if (plan == null) {
        _bot(
          tr(
            'Choose one of the listed plans.',
            'Zaɓi ɗaya daga cikin plan ɗin da aka jera.',
          ),
        );
        return;
      }
      setState(() {
        _plan = plan;
        _amount = _number(plan['price'] ?? plan['amount']);
        _step = _Step.review;
      });
      await _review();
    } else if (_step == _Step.amount) {
      final amount = double.tryParse(text.replaceAll(RegExp(r'[^0-9.]'), ''));
      if (amount == null || amount < 50) {
        _bot(
          tr(
            'Enter an airtime amount of at least ₦50.',
            'Rubuta kuɗin airtime daga ₦50 zuwa sama.',
          ),
        );
        return;
      }
      if (_task == _Task.fund) {
        _bot(tr('I will open the secure wallet funding page. Enter card or bank details only there; never send them in this chat.', 'Zan buɗe secure wallet funding page. Shigar da bayanan card ko banki a can kawai; kada ka turo su a chat.'), options: [tr('Continue to funding', 'Ci gaba zuwa funding'), tr('Start again', 'Fara kuma')]);
        setState(() { _amount = amount; _step = _Step.review; });
        return;
      }
      setState(() {
        _amount = amount;
        _step = _Step.review;
      });
      await _review();
    } else if (_step == _Step.review) {
      if (_task == _Task.fund && RegExp(r'(continue|ci gaba|yes|eh|confirm)').hasMatch(normalized)) {
        Navigator.of(context).pushNamed('/fund-wallet');
        return;
      }
      if (normalized.contains('yes') ||
          normalized.contains('eh') ||
          normalized.contains('i') ||
          normalized.contains('confirm'))
        await _confirmPurchase();
      else {
        _reset();
      }
    }
  }

  String? _parseNetwork(String value) {
    if (value.contains('mtn')) return 'MTN';
    if (value.contains('airtel')) return 'AIRTEL';
    if (value.contains('glo')) return 'GLO';
    if (value.contains('9') || value.contains('nine')) return '9MOBILE';
    return null;
  }

  Future<Map<String, dynamic>?> _parseIntent(String message) async {
    try {
      final response = await ref
          .read(dioClientProvider)
          .post(AppEndpoints.assistantParse, data: {'message': message});
      return (response.data['data'] as Map?)?.cast<String, dynamic>();
    } on DioException {
      return null;
    }
  }

  double _number(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  Future<void> _loadPlans() async {
    setState(() => _busy = true);
    try {
      final response = await ref
          .read(dioClientProvider)
          .get(
            AppEndpoints.dataPlans(_network!),
            queryParameters: _dataType == null ? null : {'category': _dataType},
          );
      final raw = (response.data['data'] ?? response.data) as List<dynamic>;
      _plans = raw.cast<Map<String, dynamic>>().toList();
      final list = _plans
          .map(
            (p) =>
                '${p['name'] ?? p['size']} — ₦${_number(p['price'] ?? p['amount']).toStringAsFixed(0)}',
          )
          .join('\n');
      _bot(
        tr(
          'Which data plan do you want? Reply with its size, for example “1GB”.\n\n$list',
          'Wanne data plan kake so? Amsa da girman data, misali “1GB”.\n\n$list',
        ),
      );
    } on DioException {
      _bot(
        tr(
          'I could not load plans right now. Please try again.',
          'Ba a samu damar ɗauko plan yanzu ba. Sake gwadawa.',
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _review() async {
    try {
      final response = await ref
          .read(dioClientProvider)
          .get(AppEndpoints.walletBalance);
      final wallet = response.data['data'] ?? response.data;
      final balance = _number(wallet['balance'] ?? wallet['total_balance']);
      if (balance < _amount!) {
        _bot(
          tr(
            'Your wallet balance is ₦${balance.toStringAsFixed(0)}, but this needs ₦${_amount!.toStringAsFixed(0)}. Please fund your wallet first.',
            'Wallet ɗinka yana da ₦${balance.toStringAsFixed(0)}, amma wannan na bukatar ₦${_amount!.toStringAsFixed(0)}. Da fatan ka cika wallet ɗin ka farko.',
          ),
        );
        _reset(keepMessages: true);
        return;
      }
      final item = _task == _Task.data
          ? '${_plan!['name'] ?? _plan!['size']}'
          : tr('airtime', 'airtime');
      _bot(
        tr(
          'Summary: $item on $_network for $_phone — ₦${_amount!.toStringAsFixed(0)}. Wallet balance: ₦${balance.toStringAsFixed(0)}.\n\nProceed?',
          'Takaitawa: $item na $_network zuwa $_phone — ₦${_amount!.toStringAsFixed(0)}. Wallet: ₦${balance.toStringAsFixed(0)}.\n\nA ci gaba?',
        ),
        options: [
          tr('Yes, confirm', 'Eh, tabbatar'),
          tr('No, start again', 'A’a, a fara kuma'),
        ],
      );
    } on DioException {
      _bot(
        tr(
          'I could not check your wallet. Please try again.',
          'Ba a iya duba wallet ɗinka ba. Sake gwadawa.',
        ),
      );
    }
  }

  Future<void> _confirmPurchase() async {
    final confirmed = await showPinConfirmationSheet(
      context: context,
      ref: ref,
      title: tr('Confirm purchase', 'Tabbatar da siya'),
      subtitle: tr(
        'Use your transaction PIN. Your PIN is never sent in this chat.',
        'Yi amfani da transaction PIN. Ba a taɓa aika PIN ɗinka a chat ba.',
      ),
    );
    if (!confirmed) {
      _bot(
        tr(
          'Purchase cancelled. Your wallet was not charged.',
          'An soke siya. Ba a cire kuɗi daga wallet ba.',
        ),
      );
      return;
    }
    setState(() => _busy = true);
    try {
      final dio = ref.read(dioClientProvider);
      final response = await dio.post(
        _task == _Task.data
            ? AppEndpoints.purchaseData
            : AppEndpoints.purchaseAirtime,
        data: _task == _Task.data
            ? {
                'network': _network,
                'plan_id': '${_plan!['id'] ?? _plan!['plan_id']}',
                'phone': _phone,
                'amount': _amount,
              }
            : {'network': _network, 'phone': _phone, 'amount': _amount},
        options: Options(headers: {'Idempotency-Key': const Uuid().v4()}),
      );
      final ok =
          response.data['status'] == true ||
          response.data['status'] == 'success';
      unawaited(
        _audit(
          stage: 'purchase',
          outcome: ok ? 'success' : 'failed',
          transactionRef: (response.data['data'] as Map?)?['reference']
              ?.toString(),
        ),
      );
      _bot(
        ok
            ? tr(
                'Done! ${response.data['message'] ?? 'Your purchase was successful.'}',
                'An gama! ${response.data['message'] ?? 'Siyanka ta yi nasara.'}',
              )
            : tr(
                '${response.data['message'] ?? 'Purchase failed.'} Your wallet has not been charged for a failed provider transaction.',
                '${response.data['message'] ?? 'Siyan ta gaza.'} Ba za a cire maka kuɗi idan provider ya gaza ba.',
              ),
      );
      _reset(keepMessages: true);
    } on DioException catch (e) {
      unawaited(
        _audit(
          stage: 'purchase',
          outcome: 'failed',
          errorCode: 'PURCHASE_ERROR',
        ),
      );
      _bot(
        tr(
          e.response?.data?['message']?.toString() ??
              'Purchase failed. Please try again.',
          e.response?.data?['message']?.toString() ??
              'Siyan ta gaza. Sake gwadawa.',
        ),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _audit({
    required String stage,
    required String outcome,
    String? errorCode,
    String? transactionRef,
  }) async {
    try {
      await ref
          .read(dioClientProvider)
          .post(
            AppEndpoints.assistantEvents,
            data: {
              'intent': _task.name,
              'stage': stage,
              'outcome': outcome,
              if (errorCode != null) 'error_code': errorCode,
              if (transactionRef != null) 'transaction_ref': transactionRef,
            },
          );
    } on DioException {
      // Observability must never block a customer transaction.
    }
  }

  Future<void> _fallback(String reason) async {
    try {
      final response = await ref
          .read(dioClientProvider)
          .post(
            AppEndpoints.assistantFallback,
            data: {'reason': reason, 'stage': _step.name},
          );
      final ticket =
          (response.data['data'] as Map?)?['ticket_id']?.toString() ??
          'created';
      _bot(
        tr(
          'I connected you to human support. Ticket: $ticket.',
          'Na haɗa ka da human support. Ticket: $ticket.',
        ),
      );
    } on DioException {
      _bot(
        tr(
          'Support is temporarily unavailable. Please open Support from your account menu.',
          'Ba a samu support yanzu ba. Buɗe Support daga account menu.',
        ),
      );
    }
  }

  void _reset({bool keepMessages = false}) {
    setState(() {
      _task = _Task.choose;
      _network = null;
      _dataType = null;
      _phone = null;
      _amount = null;
      _plan = null;
      _plans = const [];
      _step = _Step.task;
    });
    if (keepMessages)
      _bot(
        tr(
          'What else can I help you with?',
          'Me kuma zan taimaka maka da shi?',
        ),
        options: [
          tr('Buy Data', 'Siyan Data'),
          tr('Buy Airtime', 'Siyan Airtime'),
        ],
      );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(_t),
      actions: const [
        Padding(
          padding: EdgeInsets.only(right: 16),
          child: Center(
            child: Text(
              'Secure',
              style: TextStyle(
                color: AppColors.success600,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    ),
    body: Column(
      children: [
        Container(
          width: double.infinity,
          color: AppColors.primary50,
          padding: const EdgeInsets.all(10),
          child: Text(
            tr(
              'Automated service assistant • No external AI • PIN stays private',
              'Mataimakin sabis mai tsari • Babu external AI • PIN yana nan a sirri',
            ),
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: AppColors.primary700),
          ),
        ),
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.all(16),
            itemCount: _messages.length,
            itemBuilder: (_, i) =>
                _Bubble(message: _messages[i], onOption: _answer),
          ),
        ),
        if (_busy) const LinearProgressIndicator(),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    onSubmitted: _answer,
                    decoration: InputDecoration(
                      hintText: tr('Type your reply…', 'Rubuta amsarka…'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _busy ? null : () => _answer(_input.text),
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

class _Message {
  const _Message(this.text, this.user, this.options);
  final String text;
  final bool user;
  final List<String> options;
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.onOption});
  final _Message message;
  final ValueChanged<String> onOption;
  @override
  Widget build(BuildContext context) => Align(
    alignment: message.user ? Alignment.centerRight : Alignment.centerLeft,
    child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      constraints: const BoxConstraints(maxWidth: 330),
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: message.user ? AppColors.primary600 : AppColors.neutral100,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            message.text,
            style: TextStyle(
              color: message.user ? Colors.white : AppColors.neutral800,
              height: 1.35,
            ),
          ),
          if (message.options.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: message.options
                  .map(
                    (option) => OutlinedButton(
                      onPressed: () => onOption(option),
                      child: Text(option),
                    ),
                  )
                  .toList(),
            ),
          ],
        ],
      ),
    ),
  );
}
