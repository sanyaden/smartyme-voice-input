import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Handler for voice input in WebView
/// Bridges native Flutter speech recognition with JavaScript
class VoiceInputHandler {
  final InAppWebViewController webViewController;
  final stt.SpeechToText _speech = stt.SpeechToText();
  
  bool _isListening = false;
  bool _isAvailable = false;
  String _currentTranscript = '';
  
  VoiceInputHandler({required this.webViewController}) {
    _initializeSpeech();
    _setupJavaScriptHandlers();
  }
  
  /// Initialize speech recognition
  Future<void> _initializeSpeech() async {
    try {
      // Request microphone permission
      final status = await Permission.microphone.request();
      if (status != PermissionStatus.granted) {
        print('[VoiceInput] Microphone permission denied');
        _isAvailable = false;
        return;
      }
      
      // Initialize speech recognition
      _isAvailable = await _speech.initialize(
        onStatus: (status) => _handleStatusChange(status),
        onError: (error) => _handleError(error),
      );
      
      print('[VoiceInput] Speech recognition available: $_isAvailable');
    } catch (e) {
      print('[VoiceInput] Failed to initialize speech: $e');
      _isAvailable = false;
    }
  }
  
  /// Setup JavaScript handlers for WebView communication
  void _setupJavaScriptHandlers() {
    // Handler to check voice capability
    webViewController.addJavaScriptHandler(
      handlerName: 'check_voice_capability',
      callback: (args) async {
        return {
          'available': _isAvailable,
          'platform': 'flutter',
          'features': {
            'continuous': true,
            'interimResults': true,
            'languages': _speech.locales?.map((l) => l.localeId).toList() ?? [],
          }
        };
      },
    );
    
    // Handler for voice input control
    webViewController.addJavaScriptHandler(
      handlerName: 'voice_input',
      callback: (args) async {
        if (args.isEmpty) return {'error': 'No arguments provided'};
        
        final Map<String, dynamic> message = args[0] is String 
            ? json.decode(args[0]) 
            : args[0];
        
        final String action = message['action'] ?? '';
        
        switch (action) {
          case 'start':
            return await _startListening();
          case 'stop':
            return await _stopListening();
          case 'status':
            return _getStatus();
          default:
            return {'error': 'Unknown action: $action'};
        }
      },
    );
  }
  
  /// Start voice recognition
  Future<Map<String, dynamic>> _startListening() async {
    if (!_isAvailable) {
      _sendErrorToWebView('Voice recognition not available');
      return {'success': false, 'error': 'Voice recognition not available'};
    }
    
    if (_isListening) {
      return {'success': true, 'message': 'Already listening'};
    }
    
    try {
      _currentTranscript = '';
      
      await _speech.listen(
        onResult: (result) => _handleSpeechResult(result),
        listenFor: Duration(seconds: 30),
        pauseFor: Duration(seconds: 3),
        partialResults: true,
        cancelOnError: true,
        listenMode: stt.ListenMode.confirmation,
      );
      
      _isListening = true;
      _sendStatusToWebView(true);
      
      return {'success': true};
    } catch (e) {
      final error = 'Failed to start listening: $e';
      _sendErrorToWebView(error);
      return {'success': false, 'error': error};
    }
  }
  
  /// Stop voice recognition
  Future<Map<String, dynamic>> _stopListening() async {
    if (!_isListening) {
      return {'success': true, 'message': 'Not currently listening'};
    }
    
    try {
      await _speech.stop();
      _isListening = false;
      _sendStatusToWebView(false);
      
      // Send final transcript if any
      if (_currentTranscript.isNotEmpty) {
        _sendResultToWebView(_currentTranscript, true);
      }
      
      return {'success': true};
    } catch (e) {
      final error = 'Failed to stop listening: $e';
      _sendErrorToWebView(error);
      return {'success': false, 'error': error};
    }
  }
  
  /// Get current status
  Map<String, dynamic> _getStatus() {
    return {
      'isListening': _isListening,
      'isAvailable': _isAvailable,
      'hasPermission': true, // We check this during init
    };
  }
  
  /// Handle speech recognition results
  void _handleSpeechResult(stt.SpeechRecognitionResult result) {
    _currentTranscript = result.recognizedWords;
    
    // Send result to WebView
    _sendResultToWebView(
      result.recognizedWords,
      result.finalResult,
    );
    
    // If final result, stop listening
    if (result.finalResult) {
      _isListening = false;
      _sendStatusToWebView(false);
    }
  }
  
  /// Handle status changes
  void _handleStatusChange(String status) {
    print('[VoiceInput] Status changed: $status');
    
    switch (status) {
      case 'listening':
        _isListening = true;
        _sendStatusToWebView(true);
        break;
      case 'notListening':
      case 'done':
        _isListening = false;
        _sendStatusToWebView(false);
        break;
    }
  }
  
  /// Handle speech recognition errors
  void _handleError(stt.SpeechRecognitionError error) {
    print('[VoiceInput] Error: ${error.errorMsg}');
    
    String userFriendlyError;
    switch (error.errorMsg) {
      case 'error_no_match':
        userFriendlyError = 'No speech was recognized. Please try again.';
        break;
      case 'error_audio':
        userFriendlyError = 'Audio recording error. Please check your microphone.';
        break;
      case 'error_permission':
        userFriendlyError = 'Microphone permission denied. Please enable in settings.';
        break;
      case 'error_network':
        userFriendlyError = 'Network error. Please check your connection.';
        break;
      default:
        userFriendlyError = 'Voice input error: ${error.errorMsg}';
    }
    
    _isListening = false;
    _sendErrorToWebView(userFriendlyError);
    _sendStatusToWebView(false);
  }
  
  /// Send voice result to WebView
  void _sendResultToWebView(String transcript, bool isFinal) {
    final message = {
      'type': 'voice_input_result',
      'payload': {
        'transcript': transcript,
        'isFinal': isFinal,
      }
    };
    
    _sendMessageToWebView(message);
  }
  
  /// Send error to WebView
  void _sendErrorToWebView(String error) {
    final message = {
      'type': 'voice_input_error',
      'payload': {
        'error': error,
      }
    };
    
    _sendMessageToWebView(message);
  }
  
  /// Send status update to WebView
  void _sendStatusToWebView(bool isListening) {
    final message = {
      'type': 'voice_input_status',
      'payload': {
        'isListening': isListening,
      }
    };
    
    _sendMessageToWebView(message);
  }
  
  /// Send message to WebView via JavaScript
  void _sendMessageToWebView(Map<String, dynamic> message) {
    final jsonMessage = json.encode(message);
    final jsCode = '''
      if (window.handleFlutterMessage) {
        window.handleFlutterMessage('$jsonMessage');
      } else {
        window.postMessage($jsonMessage, '*');
      }
    ''';
    
    webViewController.evaluateJavascript(source: jsCode);
  }
  
  /// Cleanup resources
  void dispose() {
    if (_isListening) {
      _speech.stop();
    }
  }
}

/// Example WebView implementation with voice input
class WebViewWithVoice extends StatefulWidget {
  final String initialUrl;
  
  const WebViewWithVoice({
    Key? key,
    required this.initialUrl,
  }) : super(key: key);
  
  @override
  _WebViewWithVoiceState createState() => _WebViewWithVoiceState();
}

class _WebViewWithVoiceState extends State<WebViewWithVoice> {
  InAppWebViewController? _webViewController;
  VoiceInputHandler? _voiceHandler;
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: InAppWebView(
          initialUrlRequest: URLRequest(url: Uri.parse(widget.initialUrl)),
          initialOptions: InAppWebViewGroupOptions(
            crossPlatform: InAppWebViewOptions(
              javaScriptEnabled: true,
              useShouldOverrideUrlLoading: true,
              mediaPlaybackRequiresUserGesture: false,
            ),
            android: AndroidInAppWebViewOptions(
              useHybridComposition: true,
            ),
            ios: IOSInAppWebViewOptions(
              allowsInlineMediaPlayback: true,
            ),
          ),
          onWebViewCreated: (controller) {
            _webViewController = controller;
            _voiceHandler = VoiceInputHandler(
              webViewController: controller,
            );
          },
          onLoadStop: (controller, url) {
            // Inject helper script to ensure Flutter bridge is ready
            controller.evaluateJavascript(source: '''
              console.log('[Flutter] WebView loaded, voice bridge ready');
              
              // Notify the web app that Flutter bridge is available
              if (window.flutterBridge) {
                window.flutterBridge.handleFlutterMessage({
                  type: 'bridge_ready',
                  payload: { 
                    hasVoiceInput: true,
                    platform: 'flutter'
                  }
                });
              }
            ''');
          },
          onConsoleMessage: (controller, consoleMessage) {
            print('[WebView Console] ${consoleMessage.message}');
          },
        ),
      ),
    );
  }
  
  @override
  void dispose() {
    _voiceHandler?.dispose();
    super.dispose();
  }
}

/// Usage example in your Flutter app:
/// 
/// ```dart
/// // In your main app or navigation
/// Navigator.push(
///   context,
///   MaterialPageRoute(
///     builder: (context) => WebViewWithVoice(
///       initialUrl: 'https://your-app.com/webview?user_id=123&lesson_id=456',
///     ),
///   ),
/// );
/// ```
/// 
/// Dependencies to add to pubspec.yaml:
/// ```yaml
/// dependencies:
///   flutter_inappwebview: ^5.7.2
///   permission_handler: ^11.0.1
///   speech_to_text: ^6.3.0
/// ```