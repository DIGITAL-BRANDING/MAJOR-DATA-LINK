# ── Flutter ──────────────────────────────────────────────────
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }
-dontwarn io.flutter.embedding.**

# ── Firebase ─────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── Play Integrity ────────────────────────────────────────────
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.android.play.core.**

# ── Biometric ────────────────────────────────────────────────
-keep class androidx.biometric.** { *; }

# ── Kotlin ───────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings { <fields>; }
-keepclassmembers class kotlin.Metadata { public <methods>; }

# ── OkHttp / Dio ─────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# ── Serialization ─────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keep class com.imamdatasub.app.** { *; }

# ── Prevent stripping of native libs ─────────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
