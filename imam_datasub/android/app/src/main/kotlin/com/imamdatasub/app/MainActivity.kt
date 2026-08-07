package com.imamdatasub.app

import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.IntegrityTokenRequest
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.Executor

class MainActivity : FlutterFragmentActivity() {

    private val CHANNEL = "com.imamdatasub.app/security"
    private val BIOMETRIC_CHANNEL = "com.imamdatasub.app/biometric"
    private val INTEGRITY_CHANNEL = "com.imamdatasub.app/integrity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Prevent screenshots in release builds
        if (!isDebuggableBuild()) {
            window.setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            )
        }
    }

    private fun isDebuggableBuild(): Boolean {
        return (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ── Security Channel ────────────────────────────────────
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isRooted" -> result.success(isDeviceRooted())
                "getAndroidId" -> result.success(getSecureAndroidId())
                "getDeviceFingerprint" -> result.success(getDeviceFingerprint())
                else -> result.notImplemented()
            }
        }

        // ── Biometric Channel ───────────────────────────────────
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, BIOMETRIC_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isBiometricAvailable" -> result.success(checkBiometricAvailability())
                "authenticate" -> {
                    val title = call.argument<String>("title") ?: "Authenticate"
                    val subtitle = call.argument<String>("subtitle") ?: "Use biometric to continue"
                    authenticateWithBiometric(title, subtitle, result)
                }
                else -> result.notImplemented()
            }
        }

        // ── Play Integrity Channel ──────────────────────────────
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, INTEGRITY_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getIntegrityToken" -> {
                    val nonce = call.argument<String>("nonce") ?: ""
                    getPlayIntegrityToken(nonce, result)
                }
                else -> result.notImplemented()
            }
        }
    }

    // ── Root detection ──────────────────────────────────────────
    private fun isDeviceRooted(): Boolean {
        val rootIndicators = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su"
        )
        return rootIndicators.any { java.io.File(it).exists() }
    }

    // ── Device Fingerprint ──────────────────────────────────────
    private fun getSecureAndroidId(): String {
        return android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        ) ?: ""
    }

    private fun getDeviceFingerprint(): String {
        return buildString {
            append(Build.MANUFACTURER)
            append(Build.MODEL)
            append(Build.DEVICE)
            append(Build.PRODUCT)
            append(getSecureAndroidId())
        }.let {
            val digest = java.security.MessageDigest.getInstance("SHA-256")
            digest.digest(it.toByteArray()).joinToString("") { byte -> "%02x".format(byte) }
        }
    }

    // ── Biometric Authentication ────────────────────────────────
    private fun checkBiometricAvailability(): Boolean {
        val biometricManager = BiometricManager.from(this)
        return biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
                    or BiometricManager.Authenticators.BIOMETRIC_WEAK
        ) == BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun authenticateWithBiometric(
        title: String,
        subtitle: String,
        result: MethodChannel.Result
    ) {
        val executor: Executor = ContextCompat.getMainExecutor(this)

        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                result.error("AUTH_ERROR", errString.toString(), errorCode)
            }

            override fun onAuthenticationSucceeded(authResult: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(authResult)
                result.success(true)
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                result.error("AUTH_FAILED", "Authentication failed", null)
            }
        }

        val biometricPrompt = BiometricPrompt(this, executor, callback)

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                        or BiometricManager.Authenticators.BIOMETRIC_WEAK
            )
            .setNegativeButtonText("Use PIN instead")
            .build()

        biometricPrompt.authenticate(promptInfo)
    }

    // ── Play Integrity ──────────────────────────────────────────
    private fun getPlayIntegrityToken(nonce: String, result: MethodChannel.Result) {
        val integrityManager = IntegrityManagerFactory.create(applicationContext)

        val request = IntegrityTokenRequest.builder()
            .setNonce(nonce)
            .build()

        integrityManager.requestIntegrityToken(request)
            .addOnSuccessListener { response ->
                result.success(response.token())
            }
            .addOnFailureListener { exception ->
                result.error(
                    "INTEGRITY_ERROR",
                    exception.message ?: "Play Integrity check failed",
                    null
                )
            }
    }
}
