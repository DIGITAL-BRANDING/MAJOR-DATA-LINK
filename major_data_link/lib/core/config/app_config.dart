/// Application configuration
/// Supports development, staging, and production environments
class AppConfig {
  AppConfig._();

  // â”€â”€ Environment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const _env = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static bool get isDevelopment => _env == 'development';
  static bool get isStaging => _env == 'staging';
  static bool get isProduction => _env == 'production';
  static bool get isDebug => isDevelopment || isStaging;

  // â”€â”€ App Info â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const String appName = 'MAJOR DATA-LINK';
  static const String packageName = 'com.majordatalink.app';
  static const String appVersion = '1.0.0';
  static const int buildNumber = 1;

  // â”€â”€ API Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const String _definedApiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    if (_definedApiBaseUrl.isNotEmpty) return _definedApiBaseUrl;

    switch (_env) {
      case 'development':
        return 'http://10.0.2.2:8787/api';
      case 'staging':
        return 'https://staging.majordatalink.ng/api';
      default:
        return 'https://major-data-link-production.up.railway.app/api';
    }
  }

  // ── Timeouts ────────────────────────────────────────────────
  // Previously 30s each with up to 3 retries at 2s/4s/8s backoff - on a
  // single endpoint that keeps timing out, that compounded to roughly
  // 30 + 32 + 34 + 38 = ~134 seconds worst case, and the app's own boot
  // sequence (splash) chains at least two such calls back to back. Trimmed
  // down so a genuinely dead connection fails fast instead of leaving the
  // user staring at a spinner for over a minute - see retry_interceptor.dart
  // for the matching backoff change, and splash_screen.dart for making the
  // two boot-time calls run concurrently instead of sequentially.
  static const Duration connectTimeout = Duration(seconds: 12);
  static const Duration receiveTimeout = Duration(seconds: 15);
  static const Duration sendTimeout = Duration(seconds: 15);

  // ── Retry ───────────────────────────────────────────────────
  static const int maxRetries = 2;
  static const Duration retryDelay = Duration(seconds: 1);

  // â”€â”€ Token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const Duration tokenRefreshBuffer = Duration(minutes: 5);

  // â”€â”€ Cache TTL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const Duration dataPlansCache = Duration(minutes: 15);
  static const Duration walletBalanceCache = Duration(seconds: 30);
  static const Duration profileCache = Duration(minutes: 60);

  // â”€â”€ Pagination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const int transactionPageSize = 20;
  static const int smsContactPageSize = 50;

  // â”€â”€ Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const int pinLength = 4;
  static const int otpLength = 6;
  static const int maxPinAttempts = 5;
  static const Duration pinLockoutDuration = Duration(minutes: 30);
  static const Duration sessionTimeout = Duration(hours: 24);

  // â”€â”€ Wallet Limits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const double minFundAmount = 100.0;
  static const double maxFundAmount = 200000.0;
  static const double minTransferAmount = 100.0;
  static const double maxDailyTransfer = 500000.0;

  // â”€â”€ Referral â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const String referralScheme = 'https://imamdatasubweb-production-d2d7.up.railway.app//ref/';
  static const double referralCommissionRate = 0.02; // 2%
  static const double minCommissionWithdrawal = 500.0;

  // â”€â”€ Support â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const String adminWhatsApp = '+2348037289774';
  static const String supportWhatsApp = '+2348037289774';
  // Second phone line (shown alongside the WhatsApp number on
  // privacy/terms/support pages, not a WhatsApp-enabled number).
  static const String supportPhoneAlt = '07025859543';
  // Official WhatsApp Channel — broadcast updates/announcements.
  static const String supportWhatsAppChannelUrl =
      'https://whatsapp.com/channel/0029Vb8KzHy5PO0stgnsNy0l';
  // Single address - used for the tap-to-email button and anywhere only one
  // valid mailto: target makes sense.
  static const String supportEmail = 'kindnesscomp20@gmail.com';
  // Both addresses together, for display-only contexts (privacy policy,
  // terms) - matches imam_datasub_backend/src/routes/legal.routes.ts's
  // SUPPORT_EMAIL, which already shows both on the web-hosted versions of
  // these same pages. Not valid as a mailto: target (the " / " separator
  // isn't a real address) - use supportEmail above for that.
  static const String supportEmailDisplay =
      'kindnesscomp20@gmail.com / sunusiusama94@gmail.com';
  static const String privacyPolicyUrl =
      'https://imamdatasubweb-production-4f62.up.railway.app/privacy-policy';
  static const String termsUrl =
      'https://imamdatasubweb-production-4f62.up.railway.app/terms';
  // Base for referral share links (ReferralEntity.shareLink appends /ref/CODE).
  // Previously pointed at imamdatasub.com.ng, a domain that was never live -
  // every shared referral link 404'd. No dedicated landing page exists yet for
  // /ref/:code either, so this alone doesn't make the link fully functional;
  // it just makes it point somewhere real instead of a dead domain. Update
  // this to a custom domain later if one gets set up.
  static const String referralLinkBaseUrl =
      'https://imamdatasubweb-production-4f62.up.railway.app';

  // â”€â”€ Play Integrity â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const String playIntegrityCloudProjectNumber = '123456789';

  // â”€â”€ Feature Flags (overridden by Remote Config) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static bool enableBiometric = true;
  static bool enableReferral = true;
  static bool enableLiveChat = true;
  static bool enableAirtimeToCash = true;
  static bool enableBulkSms = true;
  static bool enableRechargeCard = true;

  // â”€â”€ Networks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const List<String> supportedNetworks = [
    'MTN',
    'GLO',
    'AIRTEL',
    '9MOBILE',
  ];

  // â”€â”€ Cable TV Providers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const List<String> cableProviders = ['DSTV', 'GOTV', 'STARTIMES'];

  // â”€â”€ Electricity Providers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  static const List<String> electricityProviders = [
    'IKEDC',
    'EKEDC',
    'KEDCO',
    'AEDC',
    'PHEDC',
    'EEDC',
    'IBEDC',
    'KAEDCO',
    'JED',
    'BEDC',
  ];
}

