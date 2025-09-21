import Flutter
import UIKit
import AVFoundation

@main
@objc class AppDelegate: FlutterAppDelegate {
  
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    
    // Configure audio session for flexible recording and playback
    do {
      let audioSession = AVAudioSession.sharedInstance()
      // Use a more flexible category that allows both recording and playback
      // but doesn't force specific modes that might conflict with just_audio
      try audioSession.setCategory(.playAndRecord, 
                                 options: [.defaultToSpeaker, .allowBluetooth, .mixWithOthers])
      // Don't activate immediately - let plugins manage activation as needed
      print("✅ Audio session category configured (activation deferred to plugins)")
    } catch {
      print("❌ Failed to configure audio session: \(error)")
    }
    
    // Set up method channel for audio session management
    let controller = window?.rootViewController as! FlutterViewController
    let audioSessionChannel = FlutterMethodChannel(name: "com.example.audio_session",
                                                  binaryMessenger: controller.binaryMessenger)
    
    audioSessionChannel.setMethodCallHandler { (call: FlutterMethodCall, result: @escaping FlutterResult) -> Void in
      switch call.method {
      case "resetAudioSession":
        self.resetAudioSession(result: result)
      case "activateAudioSession":
        self.activateAudioSession(result: result)
      case "deactivateAudioSession":
        self.deactivateAudioSession(result: result)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    
    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  
  private func resetAudioSession(result: @escaping FlutterResult) {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      
      // First deactivate
      try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
      
      // Wait a moment
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
        do {
          // Reconfigure
          try audioSession.setCategory(.playAndRecord, 
                                     options: [.defaultToSpeaker, .allowBluetooth])
          
          // Reactivate
          try audioSession.setActive(true)
          
          print("✅ Audio session reset successfully")
          result(true)
        } catch {
          print("❌ Audio session reset failed: \(error)")
          result(FlutterError(code: "AUDIO_SESSION_ERROR", 
                            message: "Failed to reset audio session", 
                            details: error.localizedDescription))
        }
      }
    } catch {
      print("❌ Audio session deactivation failed: \(error)")
      result(FlutterError(code: "AUDIO_SESSION_ERROR", 
                        message: "Failed to deactivate audio session", 
                        details: error.localizedDescription))
    }
  }
  
  private func activateAudioSession(result: @escaping FlutterResult) {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setActive(true)
      print("✅ Audio session activated")
      result(true)
    } catch {
      print("❌ Audio session activation failed: \(error)")
      result(FlutterError(code: "AUDIO_SESSION_ERROR", 
                        message: "Failed to activate audio session", 
                        details: error.localizedDescription))
    }
  }
  
  private func deactivateAudioSession(result: @escaping FlutterResult) {
    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setActive(false, options: .notifyOthersOnDeactivation)
      print("✅ Audio session deactivated")
      result(true)
    } catch {
      print("❌ Audio session deactivation failed: \(error)")
      result(FlutterError(code: "AUDIO_SESSION_ERROR", 
                        message: "Failed to deactivate audio session", 
                        details: error.localizedDescription))
    }
  }
}
