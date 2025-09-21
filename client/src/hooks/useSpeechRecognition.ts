import { useState, useEffect, useCallback, useRef } from 'react';
import { debugLog } from '@/lib/debug';

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface UseSpeechRecognitionProps {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string, errorType?: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onCompatibilityCheck?: (isSupported: boolean, deviceInfo: DeviceCompatibilityInfo) => void;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface DeviceCompatibilityInfo {
  hasAPI: boolean;
  isSecure: boolean;
  browserSupport: 'full' | 'partial' | 'none';
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  operatingSystem: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown';
  browser: 'chrome' | 'firefox' | 'safari' | 'edge' | 'unknown';
  recommendedAction: 'use' | 'try' | 'fallback';
  limitations: string[];
  alternatives: string[];
}

export function useSpeechRecognition({
  onResult,
  onError,
  onStart,
  onEnd,
  onCompatibilityCheck,
  continuous = false,
  interimResults = true
}: UseSpeechRecognitionProps = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceCompatibilityInfo | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isListeningRef = useRef(false);
  const isInitialized = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Store callbacks in refs to avoid re-render dependencies
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  const onStartRef = useRef(onStart);
  const onEndRef = useRef(onEnd);
  const onCompatibilityCheckRef = useRef(onCompatibilityCheck);
  
  // Update refs when callbacks change
  useEffect(() => {
    onResultRef.current = onResult;
    onErrorRef.current = onError;
    onStartRef.current = onStart;
    onEndRef.current = onEnd;
    onCompatibilityCheckRef.current = onCompatibilityCheck;
  }, [onResult, onError, onStart, onEnd, onCompatibilityCheck]);

  // Comprehensive device compatibility detection
  const detectDeviceCompatibility = useCallback((): DeviceCompatibilityInfo => {
    const userAgent = navigator.userAgent;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasAPI = !!SpeechRecognitionAPI;
    
    // Environment checks - allow local network IPs for testing
    const isHTTPS = window.location.protocol === 'https:' || 
                   window.location.hostname === 'localhost' ||
                   window.location.hostname.startsWith('192.168.') ||
                   window.location.hostname.startsWith('10.') ||
                   window.location.hostname.startsWith('172.');
    
    // Device type detection
    const deviceType = /Mobile|Android|iPhone|iPad/.test(userAgent) 
      ? (/iPad/.test(userAgent) ? 'tablet' : 'mobile')
      : 'desktop';
    
    // Operating system detection
    let operatingSystem: DeviceCompatibilityInfo['operatingSystem'] = 'unknown';
    if (/Mac|iPhone|iPad|iPod/.test(userAgent)) operatingSystem = /iPhone|iPad|iPod/.test(userAgent) ? 'ios' : 'macos';
    else if (/Android/.test(userAgent)) operatingSystem = 'android';
    else if (/Windows/.test(userAgent)) operatingSystem = 'windows';
    else if (/Linux/.test(userAgent)) operatingSystem = 'linux';
    
    // Browser detection - WebView on iOS uses Safari engine
    let browser: DeviceCompatibilityInfo['browser'] = 'unknown';
    const isIOSWebView = operatingSystem === 'ios' && /AppleWebKit/.test(userAgent);
    
    if (/Edg\//.test(userAgent)) browser = 'edge';
    else if (/Chrome/.test(userAgent) && !/Edg\//.test(userAgent)) browser = 'chrome';
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) browser = 'safari';
    else if (/Firefox/.test(userAgent)) browser = 'firefox';
    else if (isIOSWebView) browser = 'safari'; // iOS WebView uses Safari engine
    
    // Determine browser support level
    let browserSupport: DeviceCompatibilityInfo['browserSupport'] = 'none';
    let recommendedAction: DeviceCompatibilityInfo['recommendedAction'] = 'fallback';
    const limitations: string[] = [];
    const alternatives: string[] = [];
    
    if (hasAPI && isHTTPS) {
      if (browser === 'chrome' && operatingSystem !== 'ios') {
        browserSupport = 'partial';
        recommendedAction = 'try';
        limitations.push('May experience quick disconnections or immediate stops');
        alternatives.push('If voice input stops immediately, refresh the page and try again');
      } else if (browser === 'safari' && (operatingSystem === 'macos' || operatingSystem === 'ios')) {
        browserSupport = 'full';
        recommendedAction = 'use';
      } else if (browser === 'edge' && operatingSystem === 'macos') {
        browserSupport = 'partial';
        recommendedAction = 'fallback';
        limitations.push('Edge on macOS has known speech recognition issues');
        alternatives.push('Use Chrome or Safari for better voice input experience');
      } else if (browser === 'edge') {
        browserSupport = 'partial';
        recommendedAction = 'try';
        limitations.push('Edge browser may have intermittent speech recognition issues');
      } else if (hasAPI) {
        browserSupport = 'partial';
        recommendedAction = 'try';
        limitations.push('Limited testing on this browser combination');
      }
    } else {
      if (!hasAPI) {
        limitations.push('Speech Recognition API not available');
        alternatives.push('Type your message instead');
      }
      if (!isHTTPS) {
        limitations.push('Voice input requires HTTPS connection');
        alternatives.push('Use the deployed version of the app');
      }
    }
    
    // Add device-specific alternatives
    if (deviceType === 'mobile') {
      alternatives.push('Use your device\'s built-in voice keyboard');
    }
    
    return {
      hasAPI,
      isSecure: isHTTPS,
      browserSupport,
      deviceType,
      operatingSystem,
      browser,
      recommendedAction,
      limitations,
      alternatives
    };
  }, []);
  
  // Check browser support and environment with comprehensive testing
  useEffect(() => {
    const compatibility = detectDeviceCompatibility();
    setDeviceInfo(compatibility);
    
    // Check for native iOS speech bridge - it might be injected after page load
    const checkNativeSpeech = () => {
      const hasNativeSpeech = !!(window as any).nativeSpeech;
      console.log('[Speech] Checking for native speech bridge:', hasNativeSpeech);
      
      if (hasNativeSpeech) {
        console.log('[Speech] Native iOS speech bridge detected, using native implementation');
        debugLog('voice', '[Speech] Native iOS speech bridge detected, using native implementation');
        setIsSupported(true);
        onCompatibilityCheckRef.current?.(true, compatibility);
        
        // Set up native speech handlers
        const nativeSpeech = (window as any).nativeSpeech;
      
      // Create a wrapper that mimics SpeechRecognition API
      const nativeWrapper = {
        start: () => {
          console.log('🎤🚀 [Speech] START CALLED - Starting native speech recognition with delay...');
          debugLog('voice', '[Speech] Starting native speech recognition');
          // Add a longer delay to ensure TTS audio and previous audio session has fully ended
          setTimeout(() => {
            console.log('🎤⏰ [Speech] Delay completed, calling nativeSpeech.start()');
            try {
              nativeSpeech.start();
              console.log('🎤✨ [Speech] nativeSpeech.start() called successfully');
            } catch (error) {
              console.error('🎤❌ [Speech] Error calling nativeSpeech.start():', error);
            }
          }, 1000);
        },
        stop: () => {
          debugLog('voice', '[Speech] Stopping native speech recognition');
          nativeSpeech.stop();
        },
        abort: () => {
          debugLog('voice', '[Speech] Aborting native speech recognition');
          nativeSpeech.stop();
        }
      };
      
      // Set up callbacks for native speech
      nativeSpeech.onStart = () => {
        console.log('🎤✅ [Speech] Native recognition started successfully');
        debugLog('voice', '[Speech] Native recognition started');
        setIsListening(true);
        isListeningRef.current = true;
        setInterimTranscript('');
        onStartRef.current?.();
      };
      
      nativeSpeech.onEnd = () => {
        console.log('[Speech] Native recognition ended');
        debugLog('voice', '[Speech] Native recognition ended');
        setIsListening(false);
        isListeningRef.current = false;
        
        // Add a longer delay to allow TTS audio and buffers to fully clear
        setTimeout(() => {
          onEndRef.current?.();
        }, 500);
      };
      
      nativeSpeech.onResult = (text: string, isFinal: boolean) => {
        console.log('🔥🔥🔥 [Speech] Native result received:', text, 'isFinal:', isFinal);
        debugLog('voice', '[Speech] Native result:', { text, isFinal });
        
        if (isFinal) {
          // If final result is empty, use the current interim transcript state
          const finalText = text.trim() || interimTranscript;
          if (finalText) {
            console.log('🔥 [Speech] Calling onResultRef with:', finalText);
            setTranscript(finalText);
            setInterimTranscript('');
            onResultRef.current?.(finalText, true);
            console.log('🔥 [Speech] Final transcript set and callback called:', finalText);
          }
        } else {
          setInterimTranscript(text);
          console.log('🔥 [Speech] Interim transcript set:', text);
          // ALSO call the callback for interim results to ensure it's working
          onResultRef.current?.(text, false);
        }
      };
      
      nativeSpeech.onError = (error: string) => {
        console.log('[Speech] Native error:', error);
        debugLog('voice', '[Speech] Native error:', error);
        // Don't treat "No speech detected" or "Recognition request was canceled" as critical errors
        if (!error.includes('No speech detected') && !error.includes('Recognition request was canceled')) {
          onErrorRef.current?.(error, 'native-error');
        }
      };
      
      nativeSpeech.onStatus = (status: string) => {
        console.log('[Speech] Native status:', status);
        debugLog('voice', '[Speech] Native status:', status);
      };
      
      recognitionRef.current = nativeWrapper as any;
      isInitialized.current = true;
      return true; // Return true to indicate native speech was found
      }
      return false; // Return false if native speech not found
    };
    
    // Check immediately and then with a delay for WebView injection
    if (checkNativeSpeech()) {
      return; // Native speech found and initialized
    }
    
    // Check again after a delay in case the bridge is injected later
    setTimeout(() => {
      if (!isInitialized.current && checkNativeSpeech()) {
        console.log('[Speech] Native speech bridge found after delay');
      }
    }, 1000);
    
    const initialSupported = compatibility.recommendedAction !== 'fallback';
    setIsSupported(initialSupported);
    
    // Notify parent component about compatibility
    onCompatibilityCheckRef.current?.(initialSupported, compatibility);
    
    debugLog('voice', '[Speech] Device compatibility analysis:', compatibility);
    
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognitionAPI && !isInitialized.current) {
      isInitialized.current = true;
      const recognition = new SpeechRecognitionAPI();
      // Use simple, reliable settings that work everywhere
      recognition.continuous = false; // Keep it simple - one-shot recognition
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      
      // Set language to a universally supported option
      recognition.lang = 'en-US';
      debugLog('voice', '[Speech] Recognition created with language: en-US');
      
      recognition.onstart = () => {
        debugLog('voice', '[Speech] Recognition started successfully');
        setIsListening(true);
        isListeningRef.current = true;
        setInterimTranscript('');
        
        // Track start time for Edge browser restart logic
        startTimeRef.current = Date.now();
        
        onStartRef.current?.();
        
        // Set up a timeout to keep recognition active for at least 10 seconds
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && recognitionRef.current) {
            debugLog('voice', '[Speech] Auto-stopping after timeout');
            recognitionRef.current.stop();
          }
        }, 30000); // Increased to 30 second timeout to avoid conflicts with conversational mode
      };
      
      recognition.onend = () => {
        debugLog('voice', '[Speech] Recognition ended');
        const endTime = Date.now();
        const duration = startTimeRef.current ? endTime - startTimeRef.current : 0;
        
        // Detect Chrome immediate end issue (recognition ending within 100ms)
        if (duration < 100 && isListeningRef.current) {
          debugLog('voice', '[Speech] Recognition ended too quickly (Chrome issue):', duration + 'ms');
          
          // Mark as not supported and show compatibility message
          setIsSupported(false);
          onErrorRef.current?.('Voice input ended too quickly. This may be a browser compatibility issue. Please try a different browser or type your message.', 'immediate-end');
        }
        
        setIsListening(false);
        isListeningRef.current = false;
        
        // Clear timeout when recognition ends
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        onEndRef.current?.();
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimText = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;
          
          if (result.isFinal) {
            finalTranscript += transcriptText;
          } else {
            interimText += transcriptText;
          }
        }
        
        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          onResultRef.current?.(finalTranscript, true);
        }
        
        if (interimText) {
          setInterimTranscript(interimText);
          onResultRef.current?.(interimText, false);
        }
        
        debugLog('voice', '[Speech] Result:', { final: finalTranscript, interim: interimText });
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        debugLog('voice', '[Speech] Error:', event.error, event);
        setIsListening(false);
        isListeningRef.current = false;
        
        let errorMessage = 'Speech recognition error';
        
        switch (event.error) {
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
          case 'not-allowed':
            // In WebView, permissions might need to be granted at the app level
            const isWebView = window.webkit?.messageHandlers || window.FlutterChannel || window.ReactNativeWebView;
            if (isWebView) {
              errorMessage = 'permission';
              debugLog('voice', '[Speech] Microphone permission needed in WebView');
            } else {
              errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
            }
            break;
          case 'aborted':
            // Don't show error for aborted - this is usually intentional
            debugLog('voice', '[Speech] Recognition aborted');
            return;
          case 'no-speech':
            debugLog('voice', '[Speech] No speech detected - this is common, restarting...');
            // Don't show error for no-speech, just quietly restart if still supposed to be listening
            if (isListeningRef.current) {
              setTimeout(() => {
                if (recognitionRef.current && isListeningRef.current) {
                  debugLog('voice', '[Speech] Restarting after no-speech');
                  try {
                    recognitionRef.current.start();
                  } catch (e) {
                    debugLog('voice', '[Speech] Could not restart after no-speech:', e);
                  }
                }
              }, 100);
            }
            return;
            break;
          case 'audio-capture':
            errorMessage = 'No microphone was found. Please check your device.';
            break;
          case 'language-not-supported':
            debugLog('voice', '[Speech] Language not supported - this device/browser may not support speech recognition');
            const isEdgeOnMac = /Edg/.test(navigator.userAgent) && /Mac/.test(navigator.userAgent);
            errorMessage = isEdgeOnMac 
              ? 'Voice input is not supported in Edge on macOS. Please try Chrome or Safari, or type your message instead.'
              : 'Speech recognition language not supported. Please type your message instead.';
            setIsSupported(false);
            break;
          case 'immediate-end':
            debugLog('voice', '[Speech] Recognition ended immediately - likely browser compatibility issue');
            errorMessage = 'Voice input ended too quickly. This browser may have compatibility issues. Please try refreshing or use a different browser.';
            setIsSupported(false);
            break;
          case 'service-not-allowed':
            errorMessage = 'Speech recognition is not available. Please use Chrome, Edge, or Safari.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        
        onErrorRef.current?.(errorMessage, event.error);
      };
      
      recognition.onaudiostart = () => {
        debugLog('voice', '[Speech] Audio capture started');
      };
      
      recognition.onaudioend = () => {
        debugLog('voice', '[Speech] Audio capture ended');
      };
      
      recognition.onspeechstart = () => {
        debugLog('voice', '[Speech] Speech detected');
      };
      
      recognition.onspeechend = () => {
        debugLog('voice', '[Speech] Speech ended');
      };
      
      recognition.onnomatch = () => {
        debugLog('voice', '[Speech] No match found');
        onErrorRef.current?.('No speech was recognized. Please try again.', 'no-match');
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      if (recognitionRef.current && isListeningRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          debugLog('voice', '[Speech] Error aborting recognition:', e);
        }
      }
    };
  }, []); // Run only once on mount to prevent infinite loops

  const startListening = useCallback(async () => {
    // Check for native speech bridge first
    const hasNativeSpeech = !!(window as any).nativeSpeech;
    
    if (!isSupported && !hasNativeSpeech) {
      let message = 'Voice input is not available in this development environment.';
      
      const isDevelopment = window.location.port === '5000' || window.location.hostname === 'localhost';
      const isReplit = window.location.hostname.includes('replit');
      
      if (isDevelopment && isReplit) {
        message = 'Voice input works best on the deployed version. In the development environment, please type your message instead.';
      } else if (window.location.protocol !== 'https:') {
        message = 'Voice input requires HTTPS. Please use the deployed version of the app.';
      } else if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        message = 'Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.';
      }
      
      console.error('[Speech]', message);
      onErrorRef.current?.(message, 'not-supported');
      return;
    }
    
    if (!recognitionRef.current) {
      console.error('[Speech] Recognition not initialized');
      onErrorRef.current?.('Speech recognition not initialized. Please refresh the page.');
      return;
    }
    
    if (isListeningRef.current) {
      debugLog('voice', '[Speech] Already listening');
      return;
    }
    
    try {
      // Check if we're in a WebView that might not have permissions configured
      const isWebView = window.webkit?.messageHandlers || window.FlutterChannel || window.ReactNativeWebView;
      
      // Try to request permissions if available
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && !isWebView) {
        try {
          debugLog('voice', '[Speech] Requesting microphone permission');
          await navigator.mediaDevices.getUserMedia({ audio: true });
          debugLog('voice', '[Speech] Microphone permission granted');
        } catch (err) {
          debugLog('voice', '[Speech] Microphone permission denied:', err);
          // Continue anyway - let speech recognition API handle it
        }
      } else {
        debugLog('voice', '[Speech] Starting speech recognition without explicit permission check (WebView or no getUserMedia)');
      }
      
      setTranscript('');
      setInterimTranscript('');
      
      // Start recognition with error handling
      try {
        recognitionRef.current.start();
        debugLog('voice', '[Speech] Starting recognition...');
      } catch (startError: any) {
        if (startError.message && startError.message.includes('already started')) {
          // Recognition already started, try to restart
          debugLog('voice', '[Speech] Recognition already started, restarting...');
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              debugLog('voice', '[Speech] Restarted recognition');
            } catch (e) {
              console.error('[Speech] Failed to restart:', e);
              onErrorRef.current?.('Failed to start speech recognition. Please try again.');
            }
          }, 100);
        } else {
          throw startError;
        }
      }
    } catch (error: any) {
      console.error('[Speech] Error starting recognition:', error);
      setIsListening(false);
      isListeningRef.current = false;
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          onErrorRef.current?.('Microphone access denied. Please allow microphone access in your browser settings.');
        } else {
          onErrorRef.current?.('Failed to start speech recognition. Please check your microphone.');
        }
      } else {
        onErrorRef.current?.('Failed to start speech recognition. Please check your microphone.');
      }
    }
  }, [isSupported, onError]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) {
      debugLog('voice', '[Speech] No recognition instance');
      return;
    }
    
    if (!isListeningRef.current) {
      debugLog('voice', '[Speech] Not currently listening');
      return;
    }
    
    try {
      recognitionRef.current.stop();
      debugLog('voice', '[Speech] Stopping recognition...');
      setIsListening(false);
      isListeningRef.current = false;
    } catch (error) {
      console.error('[Speech] Error stopping recognition:', error);
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    deviceInfo,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript
  };
}