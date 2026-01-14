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

    AsyncFunction("startListening") { (promise: Promise) in
      SFSpeechRecognizer.requestAuthorization { authStatus in
        switch authStatus {
        case .authorized:
          OperationQueue.main.addOperation {
            do {
              try self.startRecording(promise: promise)
            } catch {
              promise.reject("START_ERROR", "Failed to start recording: \(error.localizedDescription)")
            }
          }
        case .denied:
          promise.reject("PERMISSION_DENIED", "User denied access to speech recognition")
        case .restricted:
          promise.reject("PERMISSION_RESTRICTED", "Speech recognition restricted on this device")
        case .notDetermined:
          promise.reject("PERMISSION_NOT_DETERMINED", "Speech recognition permission not determined")
        @unknown default:
          promise.reject("UNKNOWN_ERROR", "Unknown authorization status")
        }
      }
    }

    AsyncFunction("stopListening") { (promise: Promise) in
      if audioEngine.isRunning {
        audioEngine.stop()
        recognitionRequest?.endAudio()
        promise.resolve(true)
      } else {
        promise.resolve(false)
      }
    }
  }

  private func startRecording(promise: Promise) throws {
    // Cancel existing task if any
    if let recognitionTask = recognitionTask {
      recognitionTask.cancel()
      self.recognitionTask = nil
    }

    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
    try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

    recognitionRequest = SFSpeechAudioBufferRecognitionRequest()

    guard let recognitionRequest = recognitionRequest else {
      throw NSError(domain: "SpeechRecognition", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unable to create recognition request"])
    }

    recognitionRequest.shouldReportPartialResults = true

    // Keep reference to input node before accessing it via installTap
    let inputNode = audioEngine.inputNode

    recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
      guard let self = self else { return }
      
      var isFinal = false

      if let result = result {
        let transcript = result.bestTranscription.formattedString
        self.sendEvent("onPartialResult", [
          "transcript": transcript,
          "isFinal": result.isFinal
        ])
        isFinal = result.isFinal
      }

      if error != nil || isFinal {
        self.audioEngine.stop()
        inputNode.removeTap(onBus: 0)
        self.recognitionRequest = nil
        self.recognitionTask = nil
        
        if let error = error {
            // Don't send error if it was just cancelled/stopped intentionally
            // validation logic could be more robust here
            self.sendEvent("onError", ["message": error.localizedDescription])
        }
      }
    }

    let recordingFormat = inputNode.outputFormat(forBus: 0)
    inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { (buffer, when) in
      self.recognitionRequest?.append(buffer)
    }

    audioEngine.prepare()
    try audioEngine.start()
    
    promise.resolve(true)
  }

  private func cleanup() {
    audioEngine.stop()
    recognitionRequest?.endAudio()
    recognitionTask?.cancel()
  }
}
