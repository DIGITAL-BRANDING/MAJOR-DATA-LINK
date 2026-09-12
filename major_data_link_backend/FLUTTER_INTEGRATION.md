# Flutter Integration Notes

Your Flutter app currently sends provider credentials from `DioClient`:

```dart
'api-token': AppConfig.apiToken,
'Authorization': 'Token ${AppConfig.apiToken}',
```

For production, remove those provider headers from the mobile app. The app should call your backend only, and the backend should call Alrahuz.

## 1. Point Flutter to the backend

For Android emulator:

```bash
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8787/api
```

For a physical phone:

```bash
flutter run --dart-define=API_BASE_URL=http://YOUR_PC_LAN_IP:8787/api
```

## 2. Send Firebase ID token to backend

Update `lib/core/network/interceptors/auth_interceptor.dart` so every Dio request includes the signed-in Firebase user's ID token:

```dart
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor();

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  }
}
```

Then update the constructor usage in `DioClient` to match.

## 3. Remove provider token from Flutter

In `lib/core/network/dio_client.dart`, remove:

```dart
'api-token': AppConfig.apiToken,
'Authorization': 'Token ${AppConfig.apiToken}',
```

The backend `.env` should hold:

```bash
ALRAHUZ_API_TOKEN=your_real_provider_token
```

## 4. Recommended endpoint order

Start with these because the app already depends on them:

- `GET /api/user/profile`
- `POST /api/user/pin/set`
- `POST /api/user/pin/verify`
- `GET /api/wallet/balance`
- `GET /api/wallet/virtual-account`
- `GET /api/data/plans/:network`
- `POST /api/data/purchase`
- `POST /api/airtime/purchase`
- `GET /api/transactions`

After that, add payment webhooks, cable, electricity, KYC, support tickets, referrals, and admin dashboard routes.

## 5. Changing the app's backend URL after release (no new APK needed)

Every already-installed app can be re-pointed at a new backend origin — e.g.
after migrating off Railway, or failing over to a backup deployment —
without a new Play Store release. This only works for apps built with the
change in this section already included (i.e. this is a one-time capability
you ship once, then use forever after).

**How it works:**

1. `AppConfig` (Prisma model, singleton row `id="default"`) has a nullable
   `apiBaseUrl` column, editable from **AdminJS → Settings → App Config**
   (SUPER_ADMIN only). Leaving it blank means "use whatever URL is compiled
   into the app" — this is always the safe default and cannot brick a build.
2. The public `GET /api/app-config` endpoint (already called by every app on
   every cold start, for the force-update check) now also returns
   `api_base_url`.
3. The Flutter app's `splash_screen.dart` caches that value in
   `flutter_secure_storage` for the **next** cold start — never the session
   that just fetched it, so an in-progress purchase or wallet call is never
   redirected mid-flight.
4. `main.dart` loads the cached value into `AppConfig` before Dio is ever
   constructed, so from the following launch onward, every request goes to
   the new origin.

**Validation (defense in depth, checked twice):**

- Backend (`app-config.resource.ts`): must be `https://`, must have a real
  host, rejects `localhost`/`127.0.0.1`/`10.0.2.2`, rejects a trailing
  slash. Invalid input is rejected before it ever reaches the database.
- Flutter (`AppConfig.isValidRemoteBaseUrl`): re-checks `https://` + a
  non-empty host before ever persisting a value to secure storage or using
  it to build a Dio client — so even a compromised or buggy backend
  response can't push an unusable value onto a user's device.

**Rollout checklist:**

1. `npx prisma migrate deploy` (adds the `apiBaseUrl` column).
2. Ship one Flutter release containing this capability — after this,
   changing the URL is admin-panel-only, no further releases needed for
   that purpose.
3. Set `apiBaseUrl` in AdminJS and confirm on one internal-testing device
   before rolling out — there is no per-device "undo" once a device has
   cached the new value.
4. If SSL pinning (`network_security_config.xml`'s commented-out `pin-set`)
   is ever enabled for the *old* domain, make sure the *new* domain either
   has its own pin-set added first, or is left unpinned — otherwise Android
   will refuse the TLS handshake to the new origin.
