import 'app_config.dart';

/// All API endpoints in one place.
class AppEndpoints {
  AppEndpoints._();

  static String get _base => AppConfig.baseUrl;

  // Auth
  static String get login => '$_base/auth/login';
  static String get register => '$_base/auth/register';
  static String get logout => '$_base/auth/logout';
  static String get refreshToken => '$_base/auth/token/refresh';
  static String get sendOtp => '$_base/otp/send';
  static String get verifyOtp => '$_base/otp/verify';
  static String get forgotPassword => '$_base/password/forgot';
  static String get resetPassword => '$_base/password/reset';

  // User / Profile
  static String get userProfile => '$_base/user/profile';
  static String get updateProfile => '$_base/user/profile/sync';
  static String get changePassword => '$_base/user/password/change';
  static String get setPin => '$_base/user/pin/set';
  static String get changePin => '$_base/user/pin/change';
  static String get verifyPin => '$_base/user/pin/verify';
  static String get setLoginPin => '$_base/user/login-pin/set';
  static String get changeLoginPin => '$_base/user/login-pin/change';
  static String get deleteAccount => '$_base/user/account';
  static String get deactivateAccount => '$_base/user/deactivate';

  // Wallet
  static String get walletBalance => '$_base/wallet/balance';
  static String get walletTransactions => '$_base/wallet/transactions';
  static String get fundWallet => '$_base/wallet/fund';
  static String get fundWalletDynamic => '$_base/wallet/fund/dynamic';
  static String get redeemCoupon => '$_base/wallet/coupon/redeem';
  static String get fundWalletVerify => '$_base/wallet/fund/verify';
  static String get virtualAccount => '$_base/wallet/virtual-account';
  static String get withdrawalRequest => '$_base/wallet/withdraw';

  // Data
  static String get dataNetworks => '$_base/data/networks';
  static String dataPlans(String network) => '$_base/data/plans/$network';
  static String dataPlanCategories(String network) =>
      '$_base/data/plans/$network/categories';
  static String get purchaseData => '$_base/data/purchase';
  static String get dataHistory => '$_base/data/history';

  // Airtime
  static String get purchaseAirtime => '$_base/airtime/purchase';
  static String get airtimeHistory => '$_base/airtime/history';
  static String get airtimeToCash => '$_base/airtime/cash';

  // Cable TV
  static String get cableProviders => '$_base/cable/providers';
  static String cablePlans(String provider) => '$_base/cable/plans/$provider';
  static String get validateSmartcard => '$_base/cable/validate';
  static String get subscribeCable => '$_base/cable/subscribe';

  // Electricity
  static String get electricityProviders => '$_base/electricity/providers';
  static String get validateMeter => '$_base/electricity/validate';
  static String get purchaseElectricity => '$_base/electricity/purchase';
  static String get electricityHistory => '$_base/electricity/history';

  // Result checker
  static String get waecResult => '$_base/result/waec';
  static String get necoResult => '$_base/result/neco';
  static String get nabtebResult => '$_base/result/nabteb';
  static String resultPrice(String exam) => '$_base/result/$exam/price';
  static String get waecPin => '$_base/result/waec/pin';
  static String get necoPin => '$_base/result/neco/pin';
  static String get nabtebPin => '$_base/result/nabteb/pin';

  // JAMB
  static String get jambProfile => '$_base/jamb/profile';
  static String get jambResult => '$_base/jamb/result';
  static String get jambPin => '$_base/jamb/pin';
  static String get jambChange => '$_base/jamb/change-institution';

  // Bulk SMS
  static String get sendBulkSms => '$_base/sms/send';
  static String get smsBalance => '$_base/sms/balance';
  static String get smsHistory => '$_base/sms/history';
  static String get smsPricing => '$_base/sms/pricing';

  // Recharge / Data cards
  static String get generateRechargeCard => '$_base/cards/recharge/generate';
  static String get generateDataCard => '$_base/cards/data/generate';
  static String get cardHistory => '$_base/cards/history';

  // Transactions
  static String get transactions => '$_base/transactions';
  static String transactionDetail(String id) => '$_base/transactions/$id';
  static String get exportTransactions => '$_base/transactions/export';

  // Beneficiaries
  static String get beneficiaries => '$_base/beneficiaries';
  static String beneficiary(String id) => '$_base/beneficiaries/$id';

  // Referral
  static String get referralStats => '$_base/referral/stats';
  static String get referralHistory => '$_base/referral/history';
  static String get withdrawCommission => '$_base/referral/withdraw';

  // KYC
  static String get kycStatus => '$_base/kyc/status';
  static String get kycBanks => '$_base/kyc/banks';
  static String get verifyBvn => '$_base/kyc/bvn';

  // Notifications
  static String get notifications => '$_base/notifications';
  static String get markNotificationRead => '$_base/notifications/read';
  static String get registerFcmToken => '$_base/notifications/fcm';
  static String get unregisterFcmToken => '$_base/notifications/fcm/unregister';

  // Support
  static String get createTicket => '$_base/support/tickets';
  static String get myTickets => '$_base/support/tickets/mine';
  static String ticket(String id) => '$_base/support/tickets/$id';
  static String ticketMessages(String id) =>
      '$_base/support/tickets/$id/messages';
  static String get faq => '$_base/support/faq';

  // App config
  static String get appSettings => '$_base/app/settings';
  static String get banners => '$_base/app/banners';
  static String get announcements => '$_base/app/announcements';

  // Admin
  static String get adminMe => '$_base/admin/me';
  static String adminDataPrices({String? network}) => network == null
      ? '$_base/admin/data-prices'
      : '$_base/admin/data-prices?network=$network';
  static String adminDataPrice(String id) => '$_base/admin/data-prices/$id';
  static String adminSyncDataPrices(String network) =>
      '$_base/admin/data-prices/sync/$network';
  static String get adminApplyDataMarkup =>
      '$_base/admin/data-prices/apply-markup';
  static String get adminServicePrices => '$_base/admin/service-prices';
  static String adminServicePrice(String service) =>
      '$_base/admin/service-prices/$service';
  static String get adminProviderBalance => '$_base/admin/provider-balance';
  static String get adminRefreshProviderBalance =>
      '$_base/admin/provider-balance/refresh';
  static String get adminNotificationBroadcast =>
      '$_base/admin/notifications/broadcast';
}
