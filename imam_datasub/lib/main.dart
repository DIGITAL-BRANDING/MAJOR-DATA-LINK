import 'dart:async';
import 'dart:io';
import 'package:android_play_install_referrer/android_play_install_referrer.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'app.dart';
import 'core/config/firebase_options.dart';
import 'core/di/injection.dart';
import 'core/utils/logger.dart';

/// Key referral_screen.dart's registration flow (see register_screen.dart's
/// initState) reads and clears - see referral-link.routes.ts's GET /ref/:code
/// server-side for where the referrer string this parses actually comes from.
const _pendingReferralCodeKey = 'kd_pending_referral_code';

/// Best-effort: reads the Play Install Referrer string, set only when this
/// install originated from a `/ref/CODE` link (see referral-link.routes.ts),
/// and stashes the code for register_screen.dart to pick up. Android-only -
/// iOS has no equivalent API. Must never throw or block startup: this plugin
/// throws if Play Services are unavailable, and per its own docs, referrer
/// data straight up isn't available for debug/sideloaded builds - only real
/// Play Store installs (including internal/closed testing tracks).
Future<void> _capturePendingReferralCode(SharedPreferences prefs) async {
  if (!Platform.isAndroid) return;
  try {
    final details = await AndroidPlayInstallReferrer.installReferrer;
    final referrer = details.installReferrer;
    if (referrer == null || referrer.isEmpty) return;

    final code = Uri.splitQueryString(referrer)['ref_code'];
    if (code != null && code.isNotEmpty) {
      await prefs.setString(_pendingReferralCodeKey, code);
    }
  } catch (error, stack) {
    appLogger.w('Install referrer read failed (non-fatal)', error: error, stackTrace: stack);
  }
}

void main() {
  var firebaseReady = false;

  void recordStartupError(Object error, StackTrace stack, {bool fatal = false}) {
    appLogger.e('Startup error', error: error, stackTrace: stack);
    if (!firebaseReady) return;

    try {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: fatal);
    } catch (crashlyticsError, crashlyticsStack) {
      appLogger.e(
        'Crashlytics reporting failed',
        error: crashlyticsError,
        stackTrace: crashlyticsStack,
      );
    }
  }

  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      await SystemChrome.setPreferredOrientations([
        DeviceOrientation.portraitUp,
        DeviceOrientation.portraitDown,
      ]);

      SystemChrome.setSystemUIOverlayStyle(
        const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
      );

      try {
        if (Firebase.apps.isEmpty) {
          await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform,
          );
        } else {
          Firebase.app();
        }
        firebaseReady = true;
      } catch (error, stack) {
        recordStartupError(error, stack);
      }

      FlutterError.onError = (errorDetails) {
        FlutterError.presentError(errorDetails);
        if (!firebaseReady) return;
        FirebaseCrashlytics.instance.recordFlutterFatalError(errorDetails);
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        recordStartupError(error, stack, fatal: true);
        return true;
      };

      final container = ProviderContainer();

      // flutter_secure_storage backs onto the iOS Keychain, which - unlike
      // every other app data store - survives a full uninstall by default.
      // Without this check, uninstalling and reinstalling to "start fresh"
      // (e.g. to test a second account) instead resurrects the previous
      // account's session, cached login PIN, and lockout counters, exactly
      // as if the app had never been removed at all. SharedPreferences DOES
      // get cleared on uninstall on both platforms, so its mere absence here
      // is itself the signal that this is a genuinely fresh install.
      final prefs = await SharedPreferences.getInstance();
      const hasRunBeforeKey = 'kd_has_run_before';
      if (prefs.getBool(hasRunBeforeKey) != true) {
        await container.read(secureStorageProvider).clearAll();
        await prefs.setBool(hasRunBeforeKey, true);
        // Only meaningful on a genuinely fresh install - the referrer is tied
        // to install time, so there's nothing to gain (and no harm) in
        // skipping this on later launches.
        await _capturePendingReferralCode(prefs);
      }

      final hive = container.read(hiveStorageProvider);
      await hive.initialize();

      appLogger.i('App initialized, launching MAJOR DATA-LINK');

      runApp(
        UncontrolledProviderScope(
          container: container,
          child: const MajorDataLinkApp(),
        ),
      );
    },
    (error, stack) {
      recordStartupError(error, stack, fatal: true);
    },
  );
}

