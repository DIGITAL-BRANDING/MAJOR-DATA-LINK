# MAJOR DATA-LINK — Production Flutter Fintech App

A premium, production-grade VTU and fintech application built with Flutter.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Flutter (Latest Stable) |
| Language | Dart 3.3+ |
| State Management | Riverpod 2.x |
| Navigation | GoRouter 14.x |
| HTTP Client | Dio 5.x |
| Local Storage | Hive (encrypted) + Flutter Secure Storage |
| Backend | Firebase (Auth, Firestore, FCM, Crashlytics) |
| VTU API | Alrahuz Data API |
| Architecture | Clean Architecture + MVVM + Repository Pattern |
| UI | Material 3 + Custom Design System |

---

## Features

- **Buy Data** — MTN, Glo, Airtel, 9Mobile with auto-network detection
- **Buy Airtime** — All networks with quick-amount chips
- **Airtime to Cash** — Convert airtime at 85% rate
- **Cable TV** — DStv, GOtv, StarTimes with smartcard validation
- **Electricity** — All DISCOs with meter validation and token delivery
- **Result Checker** — WAEC, NECO, NABTEB scratch cards
- **JAMB Services** — PIN, result check, profile code
- **Bulk SMS** — Contact picker, CSV import, unit tracking
- **Recharge Card Printing** — Generate and print PIN cards with PDF export
- **Data Card Printing** — Same flow for data cards
- **Wallet** — Fund, transfer, withdraw with virtual account
- **Referral System** — Code sharing, commission tracking, withdrawal
- **KYC** — BVN, NIN, document upload, selfie capture
- **Notifications** — Firebase push + in-app notification centre
- **Support** — Live chat, WhatsApp, ticket system, FAQ

---

## Project Structure

```
lib/
├── core/              # Infrastructure: DI, router, network, theme, storage, security
├── features/          # One folder per feature (clean architecture layers inside each)
│   ├── auth/          # Login, register, OTP, biometric, PIN
│   ├── home/          # Dashboard, services grid
│   ├── buy_data/      # Data purchase flow
│   ├── buy_airtime/   # Airtime purchase flow
│   ├── cable_tv/      # Cable TV subscription
│   ├── electricity/   # Electricity bill payment
│   ├── wallet/        # Wallet management
│   ├── transactions/  # Transaction history
│   ├── referral/      # Referral dashboard
│   ├── kyc/           # Identity verification
│   ├── profile/       # User profile management
│   ├── settings/      # App settings
│   ├── notifications/ # Notification centre
│   └── support/       # Customer support
└── shared/
    ├── widgets/       # Reusable UI components (22 widgets)
    └── providers/     # Shared Riverpod providers
```

---

## Setup

### Prerequisites

- Flutter SDK `>=3.22.0`
- Dart `>=3.3.0`
- Android Studio / VS Code
- Firebase project
- Alrahuz Data API account

### 1. Clone and install

```bash
git clone https://github.com/your-org/Imam-datasub.git
cd Imam-Datasub
flutter pub get
```

### 2. Firebase setup

```bash
# Install FlutterFire CLI
dart pub global activate flutterfire_cli

# Configure Firebase (creates firebase_options.dart)
flutterfire configure --project=your-firebase-project-id
```

### 3. Environment configuration

```bash
cp .env.example .env.development
# Edit .env.development and add your Alrahuz API token
```

### 4. Android signing (for release)

Create `android/key.properties`:
```properties
storePassword=your_keystore_password
keyPassword=your_key_password
keyAlias=your_key_alias
storeFile=/path/to/your/keystore.jks
```

Generate a keystore:
```bash
keytool -genkey -v -keystore imam-datasub.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias imam-datasub
```

### 5. Run development build

```bash
flutter run --dart-define-from-file=.env.development
```

---

## Building for Release

### Debug APK
```bash
flutter build apk --debug
```

### Release APK (signed)
```bash
flutter build apk --release \
  --obfuscate \
  --split-debug-info=build/symbols/
```

### Release App Bundle (for Play Store)
```bash
flutter build appbundle --release \
  --dart-define-from-file=.env.production \
  --obfuscate \
  --split-debug-info=build/symbols/
```

Output: `build/app/outputs/bundle/release/app-release.aab`

### Upload debug symbols to Crashlytics
```bash
firebase crashlytics:symbols:upload \
  --app=YOUR_FIREBASE_APP_ID \
  build/symbols/
```

---

## Google Play Deployment Checklist

- [x] Target SDK 35 (Android 15)
- [x] Minimum SDK 24 (Android 7.0)
- [x] 64-bit support (arm64-v8a)
- [x] App Bundle format
- [x] Play Integrity API integration
- [x] ProGuard / R8 minification + obfuscation
- [x] No cleartext HTTP traffic (network_security_config.xml)
- [x] No backup of sensitive data (backup_rules.xml)
- [x] Runtime permission requests with rationale
- [x] Privacy Policy URL configured
- [x] Terms of Service URL configured
- [x] Firebase Crashlytics integrated
- [x] Screenshot prevention in release builds (FLAG_SECURE)
- [ ] Upload AAB to Play Console (Internal → Closed → Open → Production)
- [ ] Complete Data Safety form in Play Console
- [ ] Set content rating
- [ ] Add `google-services.json` (from Firebase Console)

---

## API Configuration

All API endpoints are in `lib/core/config/app_endpoints.dart`.
Base URL is set in `lib/core/config/app_config.dart`.

To switch VTU providers, only update `AppEndpoints` and the request/response
models in the data layer — the domain and presentation layers are untouched.

---

## Security

| Feature | Implementation |
|---------|---------------|
| Token storage | Android Keystore via Flutter Secure Storage |
| API tokens | JWT with auto-refresh, 5-min buffer before expiry |
| Transaction PIN | PBKDF2-SHA256 hashed, lockout after 5 failures |
| Network | HTTPS only, SSL pinning ready (see network_security_config.xml) |
| Root detection | Native Kotlin + flutter_jailbreak_detection |
| Play Integrity | Called on launch, result verified server-side |
| Hive encryption | AES-256 key stored in Android Keystore |
| Screenshot | FLAG_SECURE set in release builds |
| Biometrics | local_auth — fingerprint + face, PIN fallback |

---

## Lottie Animations

Place these files in `assets/animations/`:

| File | Used in |
|------|---------|
| `splash_logo.json` | Splash screen |
| `success.json` | Purchase success screen |
| `loading.json` | Global loading states |
| `onboarding_1.json` | Onboarding slide 1 |
| `onboarding_2.json` | Onboarding slide 2 |
| `onboarding_3.json` | Onboarding slide 3 |

Free high-quality Lottie files: [lottiefiles.com](https://lottiefiles.com)

---

## App Icons

Generate app icons from `assets/images/logo.png` (1024×1024):

```bash
flutter pub add flutter_launcher_icons
# Add to pubspec.yaml:
# flutter_launcher_icons:
#   android: true
#   ios: true
#   image_path: "assets/images/logo.png"
#   min_sdk_android: 24
flutter pub run flutter_launcher_icons
```

---

## Splash Screen

```bash
flutter pub add flutter_native_splash
# Add config to pubspec.yaml then:
flutter pub run flutter_native_splash:create
```

---

## Testing

```bash
# Unit tests
flutter test test/unit/

# Widget tests
flutter test test/widget/

# Integration tests
flutter test integration_test/
```

---

## Contributing

1. Follow the existing clean architecture pattern
2. Every new feature must have: entity → model → datasource → repository → usecase → provider → screen
3. All network calls return `Either<Failure, T>`
4. All screens handle loading, error, and empty states
5. Run `flutter analyze` before committing — zero warnings policy

---

## License

Proprietary — All rights reserved. © 2025 MAJOR DATA-LINK.

