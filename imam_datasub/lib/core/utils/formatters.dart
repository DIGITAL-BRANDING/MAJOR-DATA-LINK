import 'package:intl/intl.dart';

class AppFormatters {
  AppFormatters._();

  // ── Currency ──────────────────────────────────────────────
  static final _naira = NumberFormat.currency(
    locale: 'en_NG',
    symbol: '₦',
    decimalDigits: 2,
  );

  static final _nairaCompact = NumberFormat.compactCurrency(
    locale: 'en_NG',
    symbol: '₦',
    decimalDigits: 1,
  );

  static final _number = NumberFormat('#,##0.##', 'en_NG');

  static String formatAmount(double amount) => _naira.format(amount);

  static String formatAmountCompact(double amount) {
    if (amount >= 1000000) return _nairaCompact.format(amount);
    return _naira.format(amount);
  }

  static String formatNumber(num value) => _number.format(value);

  static String formatAmountNaira(String raw) {
    final parsed = double.tryParse(raw.replaceAll(',', '')) ?? 0;
    return _naira.format(parsed);
  }

  // ── Date / Time ───────────────────────────────────────────
  static final _dateFormat = DateFormat('dd MMM yyyy');
  static final _dateTimeFormat = DateFormat('dd MMM yyyy, hh:mm a');
  static final _timeFormat = DateFormat('hh:mm a');
  static final _shortDate = DateFormat('dd/MM/yyyy');
  static final _monthYear = DateFormat('MMM yyyy');
  static final _fullDate = DateFormat('EEEE, dd MMMM yyyy');

  static String formatDate(DateTime date) => _dateFormat.format(date);
  static String formatDateTime(DateTime date) => _dateTimeFormat.format(date);
  static String formatTime(DateTime date) => _timeFormat.format(date);
  static String formatShortDate(DateTime date) => _shortDate.format(date);
  static String formatMonthYear(DateTime date) => _monthYear.format(date);
  static String formatFullDate(DateTime date) => _fullDate.format(date);

  static String formatRelativeDate(DateTime date) {
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inSeconds < 60) return 'Just now';
    if (diff.inMinutes < 60) {
      final m = diff.inMinutes;
      return '$m ${m == 1 ? 'minute' : 'minutes'} ago';
    }
    if (diff.inHours < 24) {
      final h = diff.inHours;
      return '$h ${h == 1 ? 'hour' : 'hours'} ago';
    }
    if (diff.inDays == 1) return 'Yesterday';
    if (diff.inDays < 7) return '${diff.inDays} days ago';
    return _dateFormat.format(date);
  }

  static String formatTransactionDate(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final txDate = DateTime(date.year, date.month, date.day);

    if (txDate == today) return 'Today, ${_timeFormat.format(date)}';
    if (txDate == yesterday) return 'Yesterday, ${_timeFormat.format(date)}';
    return _dateTimeFormat.format(date);
  }

  // ── Phone ──────────────────────────────────────────────────
  static String maskPhone(String phone) {
    if (phone.length < 7) return phone;
    return '${phone.substring(0, 4)}****${phone.substring(phone.length - 3)}';
  }

  static String formatPhone(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length == 11) {
      return '${digits.substring(0, 4)} ${digits.substring(4, 7)} ${digits.substring(7)}';
    }
    return phone;
  }

  // ── Card / Account ────────────────────────────────────────
  static String maskAccountNumber(String account) {
    if (account.length < 6) return account;
    return '**** **** ${account.substring(account.length - 4)}';
  }

  static String maskBvn(String bvn) {
    if (bvn.length < 5) return bvn;
    return '***${bvn.substring(3, 8)}***';
  }

  // ── PIN masking ───────────────────────────────────────────
  static String maskPin(String pin) => '●' * pin.length;

  // ── Recharge pin display ──────────────────────────────────
  static String formatRechargePin(String pin) {
    if (pin.length == 16) {
      return '${pin.substring(0, 4)}-${pin.substring(4, 8)}-${pin.substring(8, 12)}-${pin.substring(12)}';
    }
    return pin;
  }

  // ── File size ─────────────────────────────────────────────
  static String formatFileSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  // ── Data size ─────────────────────────────────────────────
  static String formatDataSize(String size) {
    // Normalize data plan sizes like "1024MB" → "1 GB"
    final upper = size.toUpperCase();
    if (upper.contains('GB')) return size;
    if (upper.contains('MB')) {
      final mb = double.tryParse(upper.replaceAll('MB', '').trim()) ?? 0;
      if (mb >= 1024) return '${(mb / 1024).toStringAsFixed(0)} GB';
    }
    return size;
  }

  // ── Percentage ────────────────────────────────────────────
  static String formatPercent(double value, {int decimals = 1}) {
    return '${value.toStringAsFixed(decimals)}%';
  }

  // ── Countdown ────────────────────────────────────────────
  static String formatCountdown(int seconds) {
    final m = seconds ~/ 60;
    final s = seconds % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  // ── Referral code ─────────────────────────────────────────
  static String formatReferralCode(String userId) {
    return 'KD${userId.substring(0, 6).toUpperCase()}';
  }
}
