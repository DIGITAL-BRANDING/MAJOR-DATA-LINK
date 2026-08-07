/// Auth status enum — kept in a separate file to avoid circular imports
/// between injection.dart and app_router.dart.
///
/// - [pinSetupRequired]: valid session, but the account has no 6-digit login
///   PIN yet - the user must create one before reaching Home (no skipping).
/// - [pinLockRequired]: valid session AND a login PIN already exists on this
///   device - the app is locked behind a local PIN entry (no server call)
///   until the correct PIN is entered.
enum AuthStatus {
  authenticated,
  unauthenticated,
  loading,
  pinSetupRequired,
  pinLockRequired,
}
