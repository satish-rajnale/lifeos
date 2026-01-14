package expo.modules.texttospeech

import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.Locale

class TextToSpeechModule : Module() {
  private var textToSpeech: TextToSpeech? = null
  private var isInitialized = false

  override fun definition() = ModuleDefinition {
    Name("TextToSpeech")

    Events("onStart", "onDone", "onError")

    OnCreate {
      Handler(Looper.getMainLooper()).post {
        textToSpeech = TextToSpeech(appContext.reactContext) { status ->
          if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.language = Locale.US
            isInitialized = true
            
            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
              override fun onStart(utteranceId: String?) {
                sendEvent("onStart", mapOf<String, Any>())
              }

              override fun onDone(utteranceId: String?) {
                sendEvent("onDone", mapOf<String, Any>())
              }

              override fun onError(utteranceId: String?) {
                sendEvent("onError", mapOf("message" to "TTS error occurred"))
              }
            })
          } else {
            isInitialized = false
          }
        }
      }
    }

    AsyncFunction("speak") { text: String, pitch: Float, rate: Float, promise: Promise ->
      Handler(Looper.getMainLooper()).post {
        if (!isInitialized) {
          promise.reject("NOT_INITIALIZED", "TextToSpeech not initialized", null)
          return@post
        }

        try {
          textToSpeech?.setPitch(pitch)
          textToSpeech?.setSpeechRate(rate)
          
          val result = textToSpeech?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "utterance_id")
          
          if (result == TextToSpeech.SUCCESS) {
            promise.resolve(true)
          } else {
            promise.reject("SPEAK_ERROR", "Failed to speak text", null)
          }
        } catch (e: Exception) {
          promise.reject("SPEAK_EXCEPTION", e.message, e)
        }
      }
    }

    AsyncFunction("stop") { promise: Promise ->
      Handler(Looper.getMainLooper()).post {
        try {
          textToSpeech?.stop()
          promise.resolve(true)
        } catch (e: Exception) {
          promise.reject("STOP_ERROR", e.message, e)
        }
      }
    }

    AsyncFunction("isSpeaking") { promise: Promise ->
      Handler(Looper.getMainLooper()).post {
        try {
          val speaking = textToSpeech?.isSpeaking ?: false
          promise.resolve(speaking)
        } catch (e: Exception) {
          promise.resolve(false)
        }
      }
    }

    OnDestroy {
      Handler(Looper.getMainLooper()).post {
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        textToSpeech = null
      }
    }
  }
}
