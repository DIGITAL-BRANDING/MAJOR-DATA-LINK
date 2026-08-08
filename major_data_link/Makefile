# MAJOR DATA-LINK — Developer Makefile
# Usage: make <target>

.PHONY: help setup get clean analyze test build-debug build-release bundle icons splash

# ── Default: show help ─────────────────────────────────────
help:
	@echo ""
	@echo "  MAJOR DATA-LINK — Flutter Build Commands"
	@echo ""
	@echo "  make setup          Install all dependencies and configure project"
	@echo "  make get            flutter pub get"
	@echo "  make clean          Clean build artifacts"
	@echo "  make analyze        Run flutter analyze (zero warnings)"
	@echo "  make test           Run all unit and widget tests"
	@echo "  make build-debug    Build debug APK"
	@echo "  make build-release  Build signed release APK"
	@echo "  make bundle         Build release AAB for Play Store"
	@echo "  make icons          Generate app icons from assets/icon/logo.png"
	@echo "  make splash         Generate native splash screen"
	@echo "  make codegen        Run build_runner for generated code"
	@echo ""

# ── Setup ──────────────────────────────────────────────────
setup: get
	@echo "✓ Setting up project..."
	@dart pub global activate flutterfire_cli
	@echo ""
	@echo "  Next: run 'flutterfire configure' to set up Firebase"
	@echo "  Then: copy .env.example to .env.development and add API keys"

get:
	flutter pub get

# ── Clean ──────────────────────────────────────────────────
clean:
	flutter clean
	flutter pub get

# ── Code Quality ───────────────────────────────────────────
analyze:
	flutter analyze --fatal-warnings --fatal-infos

format:
	dart format lib/ --set-exit-if-changed

# ── Testing ────────────────────────────────────────────────
test:
	flutter test --coverage

test-unit:
	flutter test test/unit/

test-widget:
	flutter test test/widget/

# ── Code Generation ────────────────────────────────────────
codegen:
	dart run build_runner build --delete-conflicting-outputs

codegen-watch:
	dart run build_runner watch --delete-conflicting-outputs

# ── Build ──────────────────────────────────────────────────
build-debug:
	flutter build apk --debug \
		--dart-define-from-file=.env.development

build-release:
	flutter build apk --release \
		--dart-define-from-file=.env.production \
		--obfuscate \
		--split-debug-info=build/symbols/
	@echo ""
	@echo "✓ APK: build/app/outputs/flutter-apk/app-release.apk"

bundle:
	flutter build appbundle --release \
		--dart-define-from-file=.env.production \
		--obfuscate \
		--split-debug-info=build/symbols/
	@echo ""
	@echo "✓ AAB: build/app/outputs/bundle/release/app-release.aab"

bundle-staging:
	flutter build appbundle --release \
		--dart-define-from-file=.env.staging \
		--obfuscate \
		--split-debug-info=build/symbols/

# ── Assets ─────────────────────────────────────────────────
icons:
	flutter pub run flutter_launcher_icons

splash:
	flutter pub run flutter_native_splash:create

# ── Symbols upload to Crashlytics ─────────────────────────
upload-symbols:
	firebase crashlytics:symbols:upload \
		--app=$(FIREBASE_APP_ID) \
		build/symbols/

# ── Version bump helper ────────────────────────────────────
bump-version:
	@echo "Current version: $$(grep 'version:' pubspec.yaml | head -1)"
	@echo "Edit pubspec.yaml manually, then run 'make bundle'"

