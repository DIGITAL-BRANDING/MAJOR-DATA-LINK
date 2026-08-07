import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'formatters.dart';

// ── String Extensions ─────────────────────────────────────────
extension StringX on String {
  String get capitalize =>
      isEmpty ? this : '${this[0].toUpperCase()}${substring(1).toLowerCase()}';

  String get titleCase => split(' ').map((w) => w.capitalize).join(' ');

  String get initials {
    final parts = trim().split(' ');
    if (parts.isEmpty) return '';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
  }

  bool get isValidEmail =>
      RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
          .hasMatch(this);

  bool get isValidNigerianPhone =>
      RegExp(r'^(0[789][01]\d{8})$').hasMatch(replaceAll(RegExp(r'\s|-'), ''));

  bool get isNumeric => RegExp(r'^\d+$').hasMatch(this);

  String get maskPhone => AppFormatters.maskPhone(this);
  String get maskAccount => AppFormatters.maskAccountNumber(this);

  void copyToClipboard(BuildContext context, {String? message}) {
    Clipboard.setData(ClipboardData(text: this));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message ?? 'Copied to clipboard'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

extension NullableStringX on String? {
  bool get isNullOrEmpty => this == null || this!.isEmpty;
  String get orEmpty => this ?? '';
}

// ── Double / num Extensions ───────────────────────────────────
extension DoubleX on double {
  String get toNaira => AppFormatters.formatAmount(this);
  String get toNairaCompact => AppFormatters.formatAmountCompact(this);
  String get toPercent => AppFormatters.formatPercent(this);

  bool get isZero => this == 0.0;
}

extension IntX on int {
  String get toOrdinal {
    if (this >= 11 && this <= 13) return '${this}th';
    switch (this % 10) {
      case 1:
        return '${this}st';
      case 2:
        return '${this}nd';
      case 3:
        return '${this}rd';
      default:
        return '${this}th';
    }
  }

  Duration get seconds => Duration(seconds: this);
  Duration get minutes => Duration(minutes: this);
  Duration get milliseconds => Duration(milliseconds: this);
}

// ── DateTime Extensions ───────────────────────────────────────
extension DateTimeX on DateTime {
  String get toDateString => AppFormatters.formatDate(this);
  String get toDateTimeString => AppFormatters.formatDateTime(this);
  String get toTimeString => AppFormatters.formatTime(this);
  String get toRelative => AppFormatters.formatRelativeDate(this);
  String get toTransactionDate => AppFormatters.formatTransactionDate(this);

  bool get isToday {
    final now = DateTime.now();
    return year == now.year && month == now.month && day == now.day;
  }

  bool get isYesterday {
    final yesterday = DateTime.now().subtract(const Duration(days: 1));
    return year == yesterday.year &&
        month == yesterday.month &&
        day == yesterday.day;
  }

  bool get isThisWeek {
    final now = DateTime.now();
    return now.difference(this).inDays < 7;
  }
}

// ── Context Extensions ────────────────────────────────────────
extension ContextX on BuildContext {
  ThemeData get theme => Theme.of(this);
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get textTheme => Theme.of(this).textTheme;
  MediaQueryData get mediaQuery => MediaQuery.of(this);
  Size get screenSize => MediaQuery.of(this).size;
  double get screenWidth => MediaQuery.of(this).size.width;
  double get screenHeight => MediaQuery.of(this).size.height;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
  bool get isTablet => MediaQuery.of(this).size.shortestSide > 600;
  EdgeInsets get padding => MediaQuery.of(this).padding;
  EdgeInsets get viewInsets => MediaQuery.of(this).viewInsets;
  bool get isKeyboardVisible => MediaQuery.of(this).viewInsets.bottom > 0;

  void showSnackBar(
    String message, {
    bool isError = false,
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(this).hideCurrentSnackBar();
    ScaffoldMessenger.of(this).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: duration,
        backgroundColor: isError ? colors.error : null,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }

  void hideKeyboard() => FocusScope.of(this).unfocus();

  Future<T?> showKDBottomSheet<T>(Widget child) {
    return showModalBottomSheet<T>(
      context: this,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => child,
    );
  }
}

// ── Widget Extensions ─────────────────────────────────────────
extension WidgetX on Widget {
  Widget get center => Center(child: this);
  Widget get expanded => Expanded(child: this);
  Widget get flexible => Flexible(child: this);

  Widget paddingAll(double value) =>
      Padding(padding: EdgeInsets.all(value), child: this);

  Widget paddingH(double h) =>
      Padding(padding: EdgeInsets.symmetric(horizontal: h), child: this);

  Widget paddingV(double v) =>
      Padding(padding: EdgeInsets.symmetric(vertical: v), child: this);

  Widget paddingOnly({
    double left = 0,
    double right = 0,
    double top = 0,
    double bottom = 0,
  }) =>
      Padding(
        padding: EdgeInsets.only(
            left: left, right: right, top: top, bottom: bottom),
        child: this,
      );

  Widget marginAll(double value) =>
      Container(margin: EdgeInsets.all(value), child: this);

  Widget marginH(double h) =>
      Container(margin: EdgeInsets.symmetric(horizontal: h), child: this);

  Widget sizedBox({double? width, double? height}) =>
      SizedBox(width: width, height: height, child: this);

  Widget onTap(VoidCallback? onTap, {bool withFeedback = true}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: this,
      );

  Widget clip({double radius = 8}) => ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: this,
      );
}

// ── List Extensions ───────────────────────────────────────────
extension ListX<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
  T? get lastOrNull => isEmpty ? null : last;

  List<T> get reversed => List.from(this)..reversed;

  List<Widget> divideWith(Widget divider) {
    if (isEmpty) return [];
    final result = <Widget>[];
    for (int i = 0; i < length; i++) {
      result.add(this[i] as Widget);
      if (i < length - 1) result.add(divider);
    }
    return result;
  }
}

// ── Color Extensions ──────────────────────────────────────────
extension ColorX on Color {
  Color withOpacityValue(double opacity) =>
      withValues(alpha: opacity.clamp(0.0, 1.0));
}
