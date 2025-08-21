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
    
    // Environment checks
    const isHTTPS = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    
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
    
    // Browser detection
    let browser: DeviceCompatibilityInfo['browser'] = 'unknown';
    if (/Edg\//.test(userAgent)) browser = 'edge';
    else if (/Chrome/.test(userAgent) && !/Edg\//.test(userAgent)) browser = 'chrome';
    else if (/Safari/.test(userAgent) && !/Chrome/.test(userAgent)) browser = 'safari';
    else if (/Firefox/.test(userAgent)) browser = 'firefox';
    
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
        }, 15000); // 15 second timeout
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
            errorMessage = 'Microphone access denied. Please allow microphone access in your browser settings.';
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
    if (!isSupported) {
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
      // Simplified permission check - let speech recognition handle its own permissions
      debugLog('voice', '[Speech] Starting speech recognition without explicit permission check');
      
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
    } catch (error) {
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