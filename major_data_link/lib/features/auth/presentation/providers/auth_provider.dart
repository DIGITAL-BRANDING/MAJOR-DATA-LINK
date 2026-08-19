import 'package:dartz/dartz.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/router/auth_status.dart';
import '../../../../core/security/biometric_service.dart';
import '../../data/datasources/auth_local_datasource.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/usecases/auth_usecases.dart';
import '../../../transactions/presentation/providers/transactions_provider.dart';
import '../../../wallet/presentation/providers/wallet_provider.dart';

// Ã¢â€â‚¬Ã¢â€â‚¬ Data layer providers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>((ref) {
  return AuthRemoteDataSourceImpl(ref.read(dioClientProvider));
});

final authLocalDataSourceProvider = Provider<AuthLocalDataSource>((ref) {
  return AuthLocalDataSourceImpl(
    ref.read(secureStorageProvider),
    ref.read(hiveStorageProvider),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(
    remote: ref.read(authRemoteDataSourceProvider),
    local: ref.read(authLocalDataSourceProvider),
    networkInfo: ref.read(networkInfoProvider),
    refreshCoordinator: ref.read(tokenRefreshCoordinatorProvider),
  );
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Use case providers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
final loginUseCaseProvider = Provider(
  (ref) => LoginUseCase(ref.read(authRepositoryProvider)),
);
final registerUseCaseProvider = Provider(
  (ref) => RegisterUseCase(ref.read(authRepositoryProvider)),
);
final sendOtpUseCaseProvider = Provider(
  (ref) => SendOtpUseCase(ref.read(authRepositoryProvider)),
);
final verifyOtpUseCaseProvider = Provider(
  (ref) => VerifyOtpUseCase(ref.read(authRepositoryProvider)),
);
final forgotPasswordUseCaseProvider = Provider(
  (ref) => ForgotPasswordUseCase(ref.read(authRepositoryProvider)),
);
final resetPasswordUseCaseProvider = Provider(
  (ref) => ResetPasswordUseCase(ref.read(authRepositoryProvider)),
);
final getCurrentUserUseCaseProvider = Provider(
  (ref) => GetCurrentUserUseCase(ref.read(authRepositoryProvider)),
);
final logoutUseCaseProvider = Provider(
  (ref) => LogoutUseCase(ref.read(authRepositoryProvider)),
);
final biometricLoginUseCaseProvider = Provider(
  (ref) => BiometricLoginUseCase(ref.read(authRepositoryProvider)),
);
final setTransactionPinUseCaseProvider = Provider(
  (ref) => SetTransactionPinUseCase(ref.read(authRepositoryProvider)),
);
final verifyTransactionPinUseCaseProvider = Provider(
  (ref) => VerifyTransactionPinUseCase(ref.read(authRepositoryProvider)),
);
final changeTransactionPinUseCaseProvider = Provider(
  (ref) => ChangeTransactionPinUseCase(ref.read(authRepositoryProvider)),
);
final changePasswordUseCaseProvider = Provider(
  (ref) => ChangePasswordUseCase(ref.read(authRepositoryProvider)),
);
final setLoginPinUseCaseProvider = Provider(
  (ref) => SetLoginPinUseCase(ref.read(authRepositoryProvider)),
);
final changeLoginPinUseCaseProvider = Provider(
  (ref) => ChangeLoginPinUseCase(ref.read(authRepositoryProvider)),
);
final unlockWithLoginPinUseCaseProvider = Provider(
  (ref) => UnlockWithLoginPinUseCase(ref.read(authRepositoryProvider)),
);
final resetLoginPinUseCaseProvider = Provider(
  (ref) => ResetLoginPinUseCase(ref.read(authRepositoryProvider)),
);

// Ã¢â€â‚¬Ã¢â€â‚¬ Auth State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
class AuthState {
  const AuthState({
    this.user,
    this.status = AuthStatus.unauthenticated,
    this.isLoading = false,
    this.errorMessage,
    this.needsLoginPinForVerification = false,
    this.pendingTransactionPinSetup = false,
  });

  final UserEntity? user;
  final AuthStatus status;
  final bool isLoading;
  final String? errorMessage;

  /// True after a login attempt on a new/unrecognized device comes back with
  /// LOGIN_PIN_REQUIRED - the account already has a login PIN, so the login
  /// screen should reveal a 6-digit PIN field and resubmit with it included.
  final bool needsLoginPinForVerification;

  /// True when a fresh login/register/reset also needs a transaction PIN
  /// AND a login PIN, and the login PIN screen is showing first - once that
  /// completes, this tells completeLoginPinSetup() to chain into the
  /// transaction PIN screen next instead of going straight to Home.
  final bool pendingTransactionPinSetup;

  bool get isAuthenticated => status == AuthStatus.authenticated;

  AuthState copyWith({
    UserEntity? user,
    AuthStatus? status,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    bool? needsLoginPinForVerification,
    bool? pendingTransactionPinSetup,
  }) {
    return AuthState(
      user: user ?? this.user,
      status: status ?? this.status,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      needsLoginPinForVerification:
          needsLoginPinForVerification ?? this.needsLoginPinForVerification,
      pendingTransactionPinSetup:
          pendingTransactionPinSetup ?? this.pendingTransactionPinSetup,
    );
  }
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Auth Notifier Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._ref) : super(const AuthState()) {
    _ready = _checkSession();
  }

  final Ref _ref;

  /// Shared by login(), register(), and resetLoginPinWithPassword() so the
  /// "which mandatory setup screen comes next" logic lives in exactly one
  /// place. Order: login PIN first (if needed), then transaction PIN (if
  /// needed) - see pendingTransactionPinSetup and completeLoginPinSetup().
  AuthState _applyPostAuthResult(AuthLoginResult result) {
    final AuthStatus status;
    if (result.requiresLoginPinSetup) {
      status = AuthStatus.pinSetupRequired;
    } else if (result.requiresPinSetup) {
      status = AuthStatus.transactionPinSetupRequired;
    } else {
      status = AuthStatus.authenticated;
    }
    return state.copyWith(
      user: result.user,
      status: status,
      isLoading: false,
      clearError: true,
      needsLoginPinForVerification: false,
      pendingTransactionPinSetup:
          result.requiresLoginPinSetup && result.requiresPinSetup,
    );
  }

  /// Resolves once the very first `_checkSession()` run (kicked off in the
  /// constructor above) has fully updated `state`. Callers that need to
  /// branch on the resolved status right after app start - the splash
  /// screen, specifically - must await this before reading `state`, or they
  /// race the constructor's fire-and-forget `_checkSession()` call and will
  /// almost always observe the pre-check default state instead of the real
  /// one (which is exactly what let a PIN-locked session fall through as if
  /// it were freshly unauthenticated).
  late final Future<void> _ready;
  Future<void> get ready => _ready;

  Future<void> _checkSession() async {
    state = state.copyWith(isLoading: true);
    final repository = _ref.read(authRepositoryProvider);
    final hasSession = await repository.hasValidSession();

    if (!hasSession) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
      );
      _syncRouterAuthState();
      return;
    }

    final result = await _ref.read(getCurrentUserUseCaseProvider).call();
    await result.fold<Future<void>>(
      (failure) async {
        state = state.copyWith(
          status: AuthStatus.unauthenticated,
          isLoading: false,
        );
      },
      (user) async {
        // A valid session on this device: gate on the local login PIN
        // (no server call - see AuthRepository.unlockWithLoginPin) rather
        // than dropping straight into the app.
        // A device that's never cached a local login PIN must be forced
        // through setup - whether that's a brand new device (fresh install,
        // valid session but this device never captured a PIN) or an
        // existing session from before this feature existed at all. Previously
        // this fell through to `authenticated` here, which is exactly why
        // already-logged-in users never saw the PIN screen: they have a
        // valid session but (correctly) no local PIN yet, and this used to
        // let that combination straight through instead of forcing setup.
        final hasLocalPin =
            await _ref.read(authLocalDataSourceProvider).hasLoginPinSet();
        state = state.copyWith(
          user: user,
          status: hasLocalPin
              ? AuthStatus.pinLockRequired
              : AuthStatus.pinSetupRequired,
          isLoading: false,
        );
      },
    );
    _syncRouterAuthState();
  }

  Future<bool> login({
    required String identifier,
    required String password,
    String? loginPin,
    bool rememberMe = false,
  }) async {
    state = state.copyWith(
      isLoading: true,
      clearError: true,
      needsLoginPinForVerification: false,
    );

    final result = await _ref
        .read(loginUseCaseProvider)
        .call(
          identifier: identifier,
          password: password,
          loginPin: loginPin,
          rememberMe: rememberMe,
        );

    return result.fold(
      (failure) {
        // The account already has a login PIN (this is an
        // unrecognized/new device) - reveal the PIN field instead of
        // just showing a generic error.
        final needsPin = failure.code == 'LOGIN_PIN_REQUIRED';
        state = state.copyWith(
          isLoading: false,
          errorMessage: needsPin
              ? 'Enter your 6-digit login PIN to continue'
              : failure.message,
          needsLoginPinForVerification: needsPin,
        );
        return false;
      },
      (loginResult) {
        _invalidateUserScopedProviders();
        state = _applyPostAuthResult(loginResult);
        _syncRouterAuthState();
        return true;
      },
    );
  }

  Future<Either<Failure, AuthLoginResult>> register({
    required String fullName,
    required String email,
    required String phone,
    required String password,
    String? referralCode,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    final result = await _ref
        .read(registerUseCaseProvider)
        .call(
          fullName: fullName,
          email: email,
          phone: phone,
          password: password,
          referralCode: referralCode,
        );

    result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
      },
      (loginResult) {
        // New registrants always need to set a login PIN (and a transaction
        // PIN) right after this - both requiresLoginPinSetup and
        // requiresPinSetup will be true here since the account was just
        // created, so _applyPostAuthResult chains login PIN -> transaction
        // PIN -> Home.
        _invalidateUserScopedProviders();
        state = _applyPostAuthResult(loginResult);
        _syncRouterAuthState();
      },
    );

    return result;
  }

  Future<bool> verifyOtp({
    required String destination,
    required String otp,
    required String purpose,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    final result = await _ref
        .read(verifyOtpUseCaseProvider)
        .call(destination: destination, otp: otp, purpose: purpose);

    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
        return false;
      },
      (user) {
        if (user.isNotEmpty) {
          _invalidateUserScopedProviders();
          state = state.copyWith(
            user: user,
            status: AuthStatus.authenticated,
            isLoading: false,
            clearError: true,
          );
          _syncRouterAuthState();
        } else {
          state = state.copyWith(isLoading: false, clearError: true);
        }
        return true;
      },
    );
  }

  Future<bool> sendOtp({
    required String destination,
    required String purpose,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    final result = await _ref
        .read(sendOtpUseCaseProvider)
        .call(destination: destination, purpose: purpose);

    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
        return false;
      },
      (_) {
        state = state.copyWith(isLoading: false, clearError: true);
        return true;
      },
    );
  }

  Future<bool> tryBiometricLogin() async {
    final localDs = _ref.read(authLocalDataSourceProvider);
    final isEnabled = await localDs.isBiometricEnabled();
    if (!isEnabled) return false;

    final biometricService = _ref.read(biometricServiceProvider);
    final isAvailable = await biometricService.isAvailable();
    if (!isAvailable) return false;

    final authResult = await biometricService.authenticate(
      title: 'Unlock MAJOR DATA-LINK',
      subtitle: 'Use your fingerprint or face to sign in',
    );

    if (authResult != BiometricResult.success) return false;

    final result = await _ref.read(biometricLoginUseCaseProvider).call();
    return result.fold((failure) => false, (user) {
      _invalidateUserScopedProviders();
      state = state.copyWith(
        user: user,
        status: AuthStatus.authenticated,
        isLoading: false,
      );
      _syncRouterAuthState();
      return true;
    });
  }

  /// Called from the mandatory PIN-setup screen right after login/register.
  Future<bool> completeLoginPinSetup(String pin) async {
    state = state.copyWith(isLoading: true, clearError: true);
    final result = await _ref.read(setLoginPinUseCaseProvider).call(pin: pin);
    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
        return false;
      },
      (_) {
        final needsTransactionPin = state.pendingTransactionPinSetup;
        state = state.copyWith(
          status: needsTransactionPin
              ? AuthStatus.transactionPinSetupRequired
              : AuthStatus.authenticated,
          isLoading: false,
          clearError: true,
          pendingTransactionPinSetup: false,
        );
        _syncRouterAuthState();
        return true;
      },
    );
  }

  /// Called from the mandatory transaction-PIN screen - either chained
  /// right after login PIN setup for a brand new account, or reached
  /// directly if only the transaction PIN was still missing.
  Future<bool> completeTransactionPinSetup(String pin) async {
    state = state.copyWith(isLoading: true, clearError: true);
    final result =
        await _ref.read(setTransactionPinUseCaseProvider).call(pin: pin);
    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
        return false;
      },
      (_) {
        state = state.copyWith(
          status: AuthStatus.authenticated,
          isLoading: false,
          clearError: true,
        );
        _syncRouterAuthState();
        return true;
      },
    );
  }

  /// Recovery flow for a forgotten login PIN - proves identity with the
  /// account password instead, then behaves exactly like a fresh login
  /// (the backend always comes back with requiresLoginPinSetup: true here,
  /// so the mandatory setup screen naturally follows via _applyPostAuthResult).
  Future<bool> resetLoginPinWithPassword({
    required String identifier,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    final result = await _ref.read(resetLoginPinUseCaseProvider).call(
          identifier: identifier,
          password: password,
        );
    return result.fold(
      (failure) {
        state = state.copyWith(isLoading: false, errorMessage: failure.message);
        return false;
      },
      (loginResult) {
        _invalidateUserScopedProviders();
        state = _applyPostAuthResult(loginResult);
        _syncRouterAuthState();
        return true;
      },
    );
  }

  /// Called from the local PIN-lock screen shown on app resume. Purely
  /// local - no server call - so a wrong/locked-out PIN never touches the
  /// network. Returns the underlying Either so the screen can show
  /// "X attempts remaining" / lockout messaging.
  Future<Either<Failure, bool>> unlockWithPin(String pin) async {
    final result = await _ref.read(unlockWithLoginPinUseCaseProvider).call(pin: pin);
    result.fold((_) {}, (_) {
      state = state.copyWith(status: AuthStatus.authenticated);
      _syncRouterAuthState();
    });
    return result;
  }

  /// Resolves almost immediately - AuthRepositoryImpl.logout() clears the
  /// local session (fast, on-device) before returning and only notifies the
  /// backend afterwards, in the background, rather than making this wait on
  /// a network round trip. See that method's doc comment for why: this used
  /// to be gated behind the remote call and could take up to ~40 seconds on
  /// a slow or dead connection, with no loading indicator shown while it
  /// happened - exactly the "press sign out and the app just sits there"
  /// symptom this fixes.
  Future<void> logout() async {
    await _ref.read(logoutUseCaseProvider).call();
    _invalidateUserScopedProviders();
    state = const AuthState(status: AuthStatus.unauthenticated);
    _syncRouterAuthState();
  }

  void clearError() => state = state.copyWith(clearError: true);

  void _syncRouterAuthState() {
    _ref.read(authStateProvider.notifier).state = AsyncValue.data(state.status);
  }

  /// Drops every provider that caches data scoped to a specific account
  /// (wallet balance, recent/paginated transactions). These providers are
  /// process-lifetime singletons that only fetch once and then sit in
  /// memory - without this, switching accounts (logout -> login as someone
  /// else) or logging into a freshly created account in the same app
  /// session would leave the previous user's wallet balance and
  /// transaction history on screen until an unrelated refresh happened to
  /// overwrite it. Called on every transition into or out of an
  /// authenticated session so a new session always starts from a clean
  /// slate rather than reusing another account's cached state.
  void _invalidateUserScopedProviders() {
    _ref.invalidate(walletNotifierProvider);
    _ref.invalidate(recentTransactionsProvider);
    _ref.invalidate(transactionListProvider);
  }

  Future<void> refreshUser() async {
    final result = await _ref
        .read(getCurrentUserUseCaseProvider)
        .call(forceRefresh: true);
    result.fold((_) {}, (user) => state = state.copyWith(user: user));
  }
}

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((
  ref,
) {
  return AuthNotifier(ref);
});

// Convenience providers
final currentUserProvider = Provider<UserEntity?>((ref) {
  return ref.watch(authNotifierProvider).user;
});

final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authNotifierProvider).isAuthenticated;
});

