import ExpoModulesCore
import AVFoundation

public class TextToSpeechModule: Module {
  private let speechSynthesizer = AVSpeechSynthesizer()
  
  public func definition() -> ModuleDefinition {
    Name("TextToSpeech")

    Events("onStart", "onDone", "onError")

    OnCreate {
      self.speechSynthesizer.delegate = self
    }

    AsyncFunction("speak") { (text: String, pitch: Float, rate: Float, promise: Promise) in
      DispatchQueue.main.async {
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.pitchMultiplier = pitch
        utterance.rate = rate * AVSpeechUtteranceDefaultSpeechRate
        
        self.speechSynthesizer.speak(utterance)
        promise.resolve(true)
      }
    }

    AsyncFunction("stop") { (promise: Promise) in
      DispatchQueue.main.async {
        self.speechSynthesizer.stopSpeaking(at: .immediate)
        promise.resolve(true)
      }
    }

    AsyncFunction("isSpeaking") { (promise: Promise) in
      DispatchQueue.main.async {
        promise.resolve(self.speechSynthesizer.isSpeaking)
      }
    }
  }
}

extension TextToSpeechModule: AVSpeechSynthesizerDelegate {
  public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
    sendEvent("onStart", [:])
  }
  
  public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    sendEvent("onDone", [:])
  }
  
  public func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    sendEvent("onDone", [:])
  }
}
