import ExpoModulesCore
import Speech

public class SpeechRecognitionModule: Module {
  private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private let audioEngine = AVAudioEngine()

  public func definition() -> ModuleDefinition {
    Name("SpeechRecognition")

    Events("onPartialResult", "onError")

    OnDestroy {
      self.cleanup()
    }

    AsyncFunction("checkPermission") { (promise: Promise) in
      let authStatus = SFSpeechRecognizer.authorizationStatus()
      NSLog("[VOICE_PERMISSION_CHECK] iOS authorization status: \(authStatus.rawValue)")
      promise.resolve(authStatus == .authorized)
    }

    AsyncFunction("startListening") { (promise: Promise) in
      NSLog("[VOICE_NATIVE_START] iOS: Requesting speech recognition authorization")
      SFSpeechRecognizer.requestAuthorization { authStatus in
        NSLog("[VOICE_NATIVE_START] iOS: Authorization status: \(authStatus.rawValue)")
        switch authStatus {
        case .authorized:
          OperationQueue.main.addOperation {
            do {
              NSLog("[VOICE_NATIVE_START] iOS: Starting recording")
              try self.startRecording(promise: promise)
            } catch {
              NSLog("[VOICE_ERROR] iOS: Failed to start recording: \(error.localizedDescription)")
              promise.reject("START_ERROR", "Failed to start recording: \(error.localizedDescription)")
            }
          }
        case .denied:
          NSLog("[VOICE_ERROR] iOS: Permission denied")
          promise.reject("PERMISSION_DENIED", "User denied access to speech recognition")
        case .restricted:
          NSLog("[VOICE_ERROR] iOS: Permission restricted")
          promise.reject("PERMISSION_RESTRICTED", "Speech recognition restricted on this device")
        case .notDetermined:
          NSLog("[VOICE_ERROR] iOS: Permission not determined")
          promise.reject("PERMISSION_NOT_DETERMINED", "Speech recognition permission not determined")
        @unknown default:
          NSLog("[VOICE_ERROR] iOS: Unknown authorization status")
          promise.reject("UNKNOWN_ERROR", "Unknown authorization status")
        }
      }
    }

    AsyncFunction("stopListening") { (promise: Promise) in
      NSLog("[VOICE_NATIVE_STOP] iOS: Stopping listening")
      if audioEngine.isRunning {
        audioEngine.stop()
        recognitionRequest?.endAudio()
        NSLog("[VOICE_NATIVE_STOP] iOS: Audio engine stopped")
        promise.resolve(true)
      } else {
        NSLog("[VOICE_NATIVE_STOP] iOS: Audio engine was not running")
        promise.resolve(false)
      }
    }
  }

  private func startRecording(promise: Promise) throws {
    // Cancel existing task if any
    if let recognitionTask = recognitionTask {
      NSLog("[VOICE_NATIVE_START] iOS: Cancelling existing recognition task")
      recognitionTask.cancel()
      self.recognitionTask = nil
    }

    NSLog("[VOICE_NATIVE_START] iOS: Setting up audio session")
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

    guard let recognitionRequest = recognitionRequest else {
      NSLog("[VOICE_ERROR] iOS: Failed to create recognition request")
      throw NSError(domain: "SpeechRecognition", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to create recognition request"])
    }

    recognitionRequest.shouldReportPartialResults = true
    NSLog("[VOICE_NATIVE_START] iOS: Recognition request created with partial results enabled")

    // Keep reference to input node before accessing it via installTap
    let inputNode = audioEngine.inputNode
    NSLog("[VOICE_NATIVE_START] iOS: Audio input node obtained")

    recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
      guard let self = self else { return }
      
      var isFinal = false

      if let result = result {
        let transcript = result.bestTranscription.formattedString
        NSLog("[VOICE_PARTIAL] iOS: Received transcript (length: \(transcript.count), isFinal: \(result.isFinal))")
        self.sendEvent("onPartialResult", [
          "transcript": transcript,
          "isFinal": result.isFinal
        ])
        isFinal = result.isFinal
      }

      if error != nil || isFinal {
        NSLog("[VOICE_NATIVE_STOP] iOS: Recognition task ending (error: \(error?.localizedDescription ?? "none"), isFinal: \(isFinal))")
        self.audioEngine.stop()
        inputNode.removeTap(onBus: 0)
        self.recognitionRequest = nil
        self.recognitionTask = nil
        
        if let error = error {
            // Don't send error if it was just cancelled/stopped intentionally
            let errorCode = (error as NSError).code
            if errorCode != 216 { // 216 is the "cancelled" error code
              NSLog("[VOICE_ERROR] iOS: Recognition error: \(error.localizedDescription)")
              self.sendEvent("onError", ["message": error.localizedDescription])
            }
        }
      }
    }

    let recordingFormat = inputNode.outputFormat(forBus: 0)
    NSLog("[VOICE_NATIVE_START] iOS: Installing audio tap (sample rate: \(recordingFormat.sampleRate), channels: \(recordingFormat.channelCount))")
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { (buffer, when) in
      self.recognitionRequest?.append(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()
    NSLog("[VOICE_NATIVE_START] iOS: Audio engine started successfully")
    
    promise.resolve(true)
  }

  private func cleanup() {
    audioEngine.stop()
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
  }
}
