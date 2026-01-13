package expo.modules.speechrecognition

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise

class SpeechRecognitionModule : Module() {
  private var speechRecognizer: SpeechRecognizer? = null
  private var intent: Intent? = null

  override fun definition() = ModuleDefinition {
    Name("SpeechRecognition")

    Events("onPartialResult", "onError")

    AsyncFunction("checkPermission") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        android.util.Log.w("SpeechRecognition", "[VOICE_PERMISSION_CHECK] Android: No activity found")
        promise.resolve(false)
        return@AsyncFunction
      }

      val hasPermission = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.RECORD_AUDIO
      ) == PackageManager.PERMISSION_GRANTED

      android.util.Log.i("SpeechRecognition", "[VOICE_PERMISSION_CHECK] Android: hasPermission = $hasPermission")
      promise.resolve(hasPermission)
    }

    AsyncFunction("startListening") { promise: Promise ->
      android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: startListening called")
      
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        android.util.Log.e("SpeechRecognition", "[VOICE_ERROR] Android: No current activity found")
        promise.reject("ACTIVITY_NOT_FOUND", "No current activity found", null)
        return@AsyncFunction
      }

      // Check for RECORD_AUDIO permission
      val hasPermission = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.RECORD_AUDIO
      ) == PackageManager.PERMISSION_GRANTED

      android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: hasPermission = $hasPermission")

      if (!hasPermission) {
        android.util.Log.e("SpeechRecognition", "[VOICE_ERROR] Android: Permission denied")
        promise.reject("PERMISSION_DENIED", "Microphone permission not granted. Please grant permission in Settings.", null)
        return@AsyncFunction
      }

      // Check if speech recognition is available
      val isAvailable = SpeechRecognizer.isRecognitionAvailable(activity)
      android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: isRecognitionAvailable = $isAvailable")
      
      if (!isAvailable) {
        android.util.Log.e("SpeechRecognition", "[VOICE_ERROR] Android: Speech recognition not available")
        promise.reject("NOT_AVAILABLE", "Speech recognition is not available. Please ensure Google app is installed and updated.", null)
        return@AsyncFunction
      }

      Handler(Looper.getMainLooper()).post {
        try {
          if (speechRecognizer == null) {
            android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: Creating speech recognizer")
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
              override fun onReadyForSpeech(params: Bundle?) {
                android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: onReadyForSpeech")
              }
              
              override fun onBeginningOfSpeech() {
                android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: onBeginningOfSpeech - User started speaking")
              }
              
              override fun onRmsChanged(rmsdB: Float) {
                // Log volume level periodically to show audio is being captured
                if (rmsdB > 0) {
                  android.util.Log.d("SpeechRecognition", "[VOICE_AUDIO] Android: Audio level = $rmsdB dB")
                }
              }
              
              override fun onBufferReceived(buffer: ByteArray?) {
                android.util.Log.d("SpeechRecognition", "[VOICE_AUDIO] Android: Audio buffer received (size: ${buffer?.size ?: 0})")
              }
              
              override fun onEndOfSpeech() {
                android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_STOP] Android: onEndOfSpeech")
              }
              
              override fun onError(error: Int) {
                 val errorMessage = getErrorText(error)
                 val errorCode = getErrorCode(error)
                 
                 // Ignore "No match" error during partial listening as it's common
                 if (error == SpeechRecognizer.ERROR_NO_MATCH) {
                   android.util.Log.w("SpeechRecognition", "[VOICE_ERROR] Android: ERROR_NO_MATCH (ignoring)")
                   return
                 }

                 android.util.Log.e("SpeechRecognition", "[VOICE_ERROR] Android: error = $errorCode, message = $errorMessage")
                 sendEvent("onError", mapOf(
                   "message" to errorMessage,
                   "code" to errorCode
                 ))
                 
                 // Clean up recognizer on critical errors
                 if (error == SpeechRecognizer.ERROR_CLIENT || 
                     error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                   android.util.Log.w("SpeechRecognition", "[VOICE_ERROR] Android: Destroying recognizer due to critical error")
                   speechRecognizer?.destroy()
                   speechRecognizer = null
                 }
              }

              override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (matches != null && matches.isNotEmpty()) {
                  val text = matches[0]
                  android.util.Log.i("SpeechRecognition", "[VOICE_PARTIAL] Android: Final result (length: ${text.length})")
                  sendEvent("onPartialResult", mapOf(
                    "transcript" to text,
                    "isFinal" to true
                  ))
                }
              }

              override fun onPartialResults(partialResults: Bundle?) {
                 val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                 if (matches != null && matches.isNotEmpty()) {
                   val text = matches[0]
                   android.util.Log.i("SpeechRecognition", "[VOICE_PARTIAL] Android: Partial result (length: ${text.length})")
                   sendEvent("onPartialResult", mapOf(
                     "transcript" to text,
                     "isFinal" to false
                   ))
                 }
              }

              override fun onEvent(eventType: Int, params: Bundle?) {}
            })
          }

          if (intent == null) {
            android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: Creating recognition intent")
            intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
              putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
              putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
              putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
              // This is critical for reliable continuous speech on some devices
              putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3) 
            }
          }

          android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: Starting listening")
          speechRecognizer?.startListening(intent)
          android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_START] Android: startListening completed successfully")
          promise.resolve(true)
        } catch (e: Exception) {
          android.util.Log.e("SpeechRecognition", "[VOICE_ERROR] Android: Exception in startListening: ${e.message}", e)
          promise.reject("START_ERROR", e.message, e)
        }
      }
    }

    AsyncFunction("stopListening") { promise: Promise ->
      android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_STOP] Android: stopListening called")
      Handler(Looper.getMainLooper()).post {
        try {
           speechRecognizer?.stopListening()
           android.util.Log.i("SpeechRecognition", "[VOICE_NATIVE_STOP] Android: stopListening completed")
           promise.resolve(true)
        } catch (e: Exception) {
           android.util.Log.e("SpeechRecognition", "[VOICE_ERROR] Android: Exception in stopListening: ${e.message}", e)
           promise.resolve(false)
        }
      }
    }
    
    OnDestroy {
        Handler(Looper.getMainLooper()).post {
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
    }
  }

  private fun getErrorCode(errorCode: Int): String {
    return when (errorCode) {
      SpeechRecognizer.ERROR_AUDIO -> "ERROR_AUDIO"
      SpeechRecognizer.ERROR_CLIENT -> "ERROR_CLIENT"
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "ERROR_INSUFFICIENT_PERMISSIONS"
      SpeechRecognizer.ERROR_NETWORK -> "ERROR_NETWORK"
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "ERROR_NETWORK_TIMEOUT"
      SpeechRecognizer.ERROR_NO_MATCH -> "ERROR_NO_MATCH"
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "ERROR_RECOGNIZER_BUSY"
      SpeechRecognizer.ERROR_SERVER -> "ERROR_SERVER"
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "ERROR_SPEECH_TIMEOUT"
      else -> "ERROR_UNKNOWN"
    }
  }

  private fun getErrorText(errorCode: Int): String {
    return when (errorCode) {
      SpeechRecognizer.ERROR_AUDIO -> "Microphone is in use by another app. Please close other apps using the microphone."
      SpeechRecognizer.ERROR_CLIENT -> "Speech recognition failed. This may happen if Google app is outdated or another app is using the microphone."
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission not granted. Please enable microphone access in Settings."
      SpeechRecognizer.ERROR_NETWORK -> "Internet connection required. Speech recognition needs an active connection."
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout. Please check your internet connection."
      SpeechRecognizer.ERROR_NO_MATCH -> "No speech detected. Please speak clearly."
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy. Please wait a moment and try again."
      SpeechRecognizer.ERROR_SERVER -> "Google speech services error. Please try again later."
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected. Please speak into the microphone."
      else -> "Speech recognition error (code: $errorCode). Please try again."
    }
  }
}
