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
        promise.resolve(false)
        return@AsyncFunction
      }

      val hasPermission = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.RECORD_AUDIO
      ) == PackageManager.PERMISSION_GRANTED

      promise.resolve(hasPermission)
    }

    AsyncFunction("startListening") { promise: Promise ->
      val activity = appContext.activityProvider?.currentActivity
      if (activity == null) {
        promise.reject("ACTIVITY_NOT_FOUND", "No current activity found", null)
        return@AsyncFunction
      }

      // Check for RECORD_AUDIO permission
      val hasPermission = ContextCompat.checkSelfPermission(
        activity,
        Manifest.permission.RECORD_AUDIO
      ) == PackageManager.PERMISSION_GRANTED

      if (!hasPermission) {
        promise.reject("PERMISSION_DENIED", "Microphone permission not granted. Please grant permission in Settings.", null)
        return@AsyncFunction
      }

      // Check if speech recognition is available
      if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
        promise.reject("NOT_AVAILABLE", "Speech recognition is not available. Please ensure Google app is installed and updated.", null)
        return@AsyncFunction
      }

      Handler(Looper.getMainLooper()).post {
        try {
          if (speechRecognizer == null) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(activity)
            speechRecognizer?.setRecognitionListener(object : RecognitionListener {
              override fun onReadyForSpeech(params: Bundle?) {}
              override fun onBeginningOfSpeech() {}
              override fun onRmsChanged(rmsdB: Float) {}
              override fun onBufferReceived(buffer: ByteArray?) {}
              override fun onEndOfSpeech() {}
              
              override fun onError(error: Int) {
                 // Ignore "No match" error during partial listening as it's common
                 if (error == SpeechRecognizer.ERROR_NO_MATCH) return

                 val errorMessage = getErrorText(error)
                 val errorCode = getErrorCode(error)
                 sendEvent("onError", mapOf(
                   "message" to errorMessage,
                   "code" to errorCode
                 ))
                 
                 // Clean up recognizer on critical errors
                 if (error == SpeechRecognizer.ERROR_CLIENT || 
                     error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                   speechRecognizer?.destroy()
                   speechRecognizer = null
                 }
              }

              override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (matches != null && matches.isNotEmpty()) {
                  val text = matches[0]
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
            intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
              putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
              putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
              putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
              // This is critical for reliable continuous speech on some devices
              putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3) 
            }
          }

          speechRecognizer?.startListening(intent)
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("START_ERROR", e.message, e)
        }
      }
    }

    AsyncFunction("stopListening") { promise: Promise ->
      Handler(Looper.getMainLooper()).post {
        try {
           speechRecognizer?.stopListening()
           promise.resolve(true)
        } catch (e: Exception) {
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
