import { useState, useEffect, useCallback, useRef } from 'react';
import { useSpeechRecognition, type DeviceCompatibilityInfo } from './useSpeechRecognition';
import { debugLog } from '../lib/debug';

// Detect if running in Flutter InAppWebView
function isInFlutterWebView(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for InAppWebView specific markers
  const hasFlutterMarker = userAgent.includes('flutter') || 
                           userAgent.includes('dart');
  
  // Check for WebView indicators on mobile platforms
  const isMobileWebView = /android.*wv|iphone.*mobile.*safari.*webview/i.test(userAgent);
  
  // Check for specific Flutter InAppWebView JavaScript interfaces
  const hasFlutterInterface = typeof (window as any).flutter_inappwebview !== 'undefined';
  
  // Additional check: WebView typically has limited features
  const isWebViewEnvironment = !window.matchMedia('(display-mode: browser)').matches &&
                               /android|iphone|ipad/i.test(userAgent);
  
  return hasFlutterMarker || hasFlutterInterface || (isMobileWebView && isWebViewEnvironment);
}

// Get WebView-specific browser info
function getWebViewInfo(): { browser: string; platform: string } {
  const userAgent = navigator.userAgent;
  
  let browser = 'webview';
  let platform = 'unknown';
  
  if (/android/i.test(userAgent)) {
    platform = 'android';
    if (/chrome/i.test(userAgent)) {
      browser = 'chrome-webview';
    } else {
      browser = 'android-webview';
    }
  } else if (/iphone|ipad/i.test(userAgent)) {
    platform = 'ios';
    if (/crios/i.test(userAgent)) {
      browser = 'chrome-ios';
    } else if (/fxios/i.test(userAgent)) {
      browser = 'firefox-ios';
    } else {
      browser = 'safari-webview';
    }
  }
  
  return { browser, platform };
}

export interface FlutterWebViewVoiceOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  autoRetry?: boolean; // Automatically retry on failures
  maxRetries?: number; // Maximum number of retry attempts
}

export interface FlutterWebViewVoiceState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  isWebView: boolean;
  webViewInfo: { browser: string; platform: string } | null;
  deviceInfo: DeviceCompatibilityInfo | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useFlutterWebViewVoice({
  onResult,
  onError,
  onStart,
  onEnd,
  autoRetry = true,
  maxRetries = 3
}: FlutterWebViewVoiceOptions = {}): FlutterWebViewVoiceState {
  const [isWebView] = useState(() => isInFlutterWebView());
  const [webViewInfo] = useState(() => isWebView ? getWebViewInfo() : null);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Custom compatibility check for WebView
  const handleCompatibilityCheck = useCallback((isSupported: boolean, deviceInfo: DeviceCompatibilityInfo) => {
    if (isWebView) {
      debugLog('webview', '[FlutterWebViewVoice] Running in Flutter WebView:', webViewInfo);
      
      // Override compatibility for known working WebView configurations
      if (webViewInfo?.platform === 'ios' && webViewInfo.browser === 'safari-webview') {
        // iOS Safari WebView typically works well
        return true;
      } else if (webViewInfo?.platform === 'android' && webViewInfo.browser === 'chrome-webview') {
        // Android Chrome WebView may have issues but worth trying
        return true;
      }
    }
    return isSupported;
  }, [isWebView, webViewInfo]);
  
  // Handle WebView-specific errors
  const handleWebViewError = useCallback((error: string, errorType?: string) => {
    debugLog('voice', '[FlutterWebViewVoice] Error:', error, errorType);
    
    // Check if it's a recoverable error in WebView
    const isRecoverableError = errorType === 'no-speech' || 
                               errorType === 'network' ||
                               errorType === 'immediate-end';
    
    if (isWebView && autoRetry && isRecoverableError && retryCount < maxRetries) {
      debugLog('voice', `[FlutterWebViewVoice] Retrying... (attempt ${retryCount + 1}/${maxRetries}`);
      
      // Clear any existing timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      
      // Retry with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Trigger retry by calling startListening again
        speechRecognition.startListening();
      }, delay);
      
      // Show user-friendly message
      if (retryCount === 0) {
        onError?.('Voice input interrupted. Retrying...');
      }
    } else {
      // Reset retry count on non-recoverable error or max retries reached
      setRetryCount(0);
      
      // Provide WebView-specific error messages
      if (isWebView) {
        if (errorType === 'not-allowed') {
          onError?.('Microphone access denied. Please check your app permissions.');
        } else if (errorType === 'immediate-end' && retryCount >= maxRetries) {
          onError?.('Voice input not available in this browser. Please type your message instead.');
        } else {
          onError?.(error);
        }
      } else {
        onError?.(error);
      }
    }
  }, [isWebView, autoRetry, maxRetries, retryCount, onError]);
  
  // Handle successful start
  const handleWebViewStart = useCallback(() => {
    // Reset retry count on successful start
    setRetryCount(0);
    
    // Clear any retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    onStart?.();
  }, [onStart]);
  
  // Use the base speech recognition hook with WebView-specific handlers
  const speechRecognition = useSpeechRecognition({
    onResult,
    onError: handleWebViewError,
    onStart: handleWebViewStart,
    onEnd,
    onCompatibilityCheck: handleCompatibilityCheck,
    continuous: false, // Keep it simple for WebView
    interimResults: true
  });
  
  // Enhanced start listening for WebView
  const startListening = useCallback(async () => {
    if (isWebView) {
      debugLog('voice', '[FlutterWebViewVoice] Starting voice input in WebView environment');
      
      // Check if we're in a secure context (required for speech API)
      if (!window.isSecureContext) {
        onError?.('Voice input requires a secure connection (HTTPS). Please use the secure version of the app.');
        return;
      }
      
      // For iOS WebView, we might need to trigger user interaction first
      if (webViewInfo?.platform === 'ios') {
        // iOS requires user gesture for audio APIs
        debugLog('webview', '[FlutterWebViewVoice] iOS WebView detected, ensuring user gesture');
      }
    }
    
    // Reset retry count when manually starting
    setRetryCount(0);
    
    try {
      await speechRecognition.startListening();
    } catch (error) {
      debugLog('voice', '[FlutterWebViewVoice] Failed to start:', error);
      if (isWebView) {
        onError?.('Voice input failed to start. Please ensure microphone permissions are granted in your device settings.');
      }
    }
  }, [isWebView, webViewInfo, speechRecognition, onError]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    isListening: speechRecognition.isListening,
    isSupported: speechRecognition.isSupported,
    transcript: speechRecognition.transcript,
    interimTranscript: speechRecognition.interimTranscript,
    isWebView,
    webViewInfo,
    deviceInfo: speechRecognition.deviceInfo,
    startListening,
    stopListening: speechRecognition.stopListening,
    toggleListening: speechRecognition.toggleListening,
    resetTranscript: speechRecognition.resetTranscript
  };
}