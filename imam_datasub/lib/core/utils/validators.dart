/// Form validators for all input fields in the app
class AppValidators {
  AppValidators._();

  // ── Email ─────────────────────────────────────────────────
  static String? email(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Email address is required';
    }
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(value.trim())) {
      return 'Enter a valid email address';
    }
    return null;
  }

  // ── Phone ─────────────────────────────────────────────────
  static String? phone(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Phone number is required';
    }
    // Nigerian phone: 080, 081, 070, 090, 091, etc.
    final phoneRegex = RegExp(r'^(0[789][01]\d{8})$');
    final cleaned = value.replaceAll(RegExp(r'\s|-'), '');
    if (!phoneRegex.hasMatch(cleaned)) {
      return 'Enter a valid Nigerian phone number (e.g. 08012345678)';
    }
    return null;
  }

  // ── Password ──────────────────────────────────────────────
  static String? password(String? value) {
    if (value == null || value.isEmpty) {
      return 'Password is required';
    }
    if (value.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!value.contains(RegExp(r'[A-Za-z]'))) {
      return 'Password must contain at least one letter';
    }
    if (!value.contains(RegExp(r'[0-9]'))) {
      return 'Password must contain at least one number';
    }
    return null;
  }

  static String? confirmPassword(String? value, String original) {
    if (value == null || value.isEmpty) return 'Please confirm your password';
    if (value != original) return 'Passwords do not match';
    return null;
  }

  // ── Full Name ─────────────────────────────────────────────
  static String? fullName(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'Full name is required';
    }
    if (value.trim().length < 3) {
      return 'Enter your full name';
    }
    if (!value.contains(' ')) {
      return 'Enter both first and last name';
    }
    return null;
  }

  // ── Amount ────────────────────────────────────────────────
  static String? amount(String? value, {double min = 100, double? max}) {
    if (value == null || value.trim().isEmpty) {
      return 'Amount is required';
    }
    final parsed = double.tryParse(value.replaceAll(',', ''));
    if (parsed == null) {
      return 'Enter a valid amount';
    }
    if (parsed < min) {
      return 'Minimum amount is ₦${min.toStringAsFixed(0)}';
    }
    if (max != null && parsed > max) {
      return 'Maximum amount is ₦${max.toStringAsFixed(0)}';
    }
    return null;
  }

  // ── PIN ───────────────────────────────────────────────────
  static String? pin(String? value, {int length = 4}) {
    if (value == null || value.isEmpty) return 'PIN is required';
    if (value.length != length) return 'PIN must be $length digits';
    if (!RegExp(r'^\d+$').hasMatch(value)) return 'PIN must contain only numbers';
    // Reject sequential patterns (1234, 0000, 1111)
    if (_isSequential(value)) return 'Choose a more secure PIN';
    return null;
  }

  static bool _isSequential(String pin) {
    // All same digits
    if (pin.split('').toSet().length == 1) return true;
    // Ascending sequence
    bool ascending = true;
    bool descending = true;
    for (int i = 0; i < pin.length - 1; i++) {
      final diff = int.parse(pin[i + 1]) - int.parse(pin[i]);
      if (diff != 1) ascending = false;
      if (diff != -1) descending = false;
    }
    return ascending || descending;
  }

  static String? confirmPin(String? value, String original) {
    if (value == null || value.isEmpty) return 'Please confirm your PIN';
    if (value != original) return 'PINs do not match';
    return null;
  }

  // ── Required ──────────────────────────────────────────────
  static String? required(String? value, {String? fieldName}) {
    if (value == null || value.trim().isEmpty) {
      return '${fieldName ?? 'This field'} is required';
    }
    return null;
  }

  // ── BVN ───────────────────────────────────────────────────
  static String? bvn(String? value) {
    if (value == null || value.trim().isEmpty) return 'BVN is required';
    if (value.length != 11) return 'BVN must be exactly 11 digits';
    if (!RegExp(r'^\d+$').hasMatch(value)) return 'BVN must contain only numbers';
    return null;
  }

  // ── NIN ───────────────────────────────────────────────────
  static String? nin(String? value) {
    if (value == null || value.trim().isEmpty) return 'NIN is required';
    if (value.length != 11) return 'NIN must be exactly 11 digits';
    if (!RegExp(r'^\d+$').hasMatch(value)) return 'NIN must contain only numbers';
    return null;
  }

  // ── Meter number ──────────────────────────────────────────
  static String? meterNumber(String? value) {
    if (value == null || value.trim().isEmpty) return 'Meter number is required';
    if (value.length < 10 || value.length > 13) {
      return 'Enter a valid meter number';
    }
    return null;
  }

  // ── Smartcard number ──────────────────────────────────────
  static String? smartcard(String? value) {
    if (value == null || value.trim().isEmpty) return 'Smartcard number is required';
    if (value.length < 9 || value.length > 12) {
      return 'Enter a valid smartcard number';
    }
    return null;
  }

  // ── Exam number ───────────────────────────────────────────
  static String? examNumber(String? value, {String exam = 'WAEC'}) {
    if (value == null || value.trim().isEmpty) {
      return '$exam exam number is required';
    }
    if (value.length < 7) {
      return 'Enter a valid $exam exam number';
    }
    return null;
  }

  // ── JAMB registration ─────────────────────────────────────
  static String? jambRegNumber(String? value) {
    if (value == null || value.trim().isEmpty) {
      return 'JAMB registration number is required';
    }
    // Format: 2 digits + 2 letters + 10 digits (e.g. 12AB3456789012)
    if (!RegExp(r'^\d{2}[A-Za-z]{2}\d{8}$').hasMatch(value.trim())) {
      return 'Enter a valid JAMB registration number';
    }
    return null;
  }

  // ── Account number ────────────────────────────────────────
  static String? accountNumber(String? value) {
    if (value == null || value.trim().isEmpty) return 'Account number is required';
    if (value.length != 10) return 'Account number must be 10 digits';
    if (!RegExp(r'^\d+$').hasMatch(value)) {
      return 'Account number must contain only numbers';
    }
    return null;
  }

  // ── OTP ───────────────────────────────────────────────────
  static String? otp(String? value, {int length = 6}) {
    if (value == null || value.isEmpty) return 'OTP is required';
    if (value.length != length) return 'Enter the $length-digit OTP';
    if (!RegExp(r'^\d+$').hasMatch(value)) return 'OTP must contain only numbers';
    return null;
  }
}
