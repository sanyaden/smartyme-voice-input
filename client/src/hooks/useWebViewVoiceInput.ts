import { useState, useEffect, useCallback, useRef } from 'react';
import { flutterBridge } from '@/lib/flutter-bridge';
import { useSpeechRecognition, type DeviceCompatibilityInfo } from './useSpeechRecognition';

export interface WebViewVoiceInputOptions {
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  preferFlutterVoice?: boolean; // Prefer Flutter's native voice over browser
}

export interface WebViewVoiceInputState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  inputMethod: 'flutter' | 'browser' | 'none';
  deviceInfo: DeviceCompatibilityInfo | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useWebViewVoiceInput({
  onResult,
  onError,
  onStart,
  onEnd,
  preferFlutterVoice = true
}: WebViewVoiceInputOptions = {}): WebViewVoiceInputState {
  const [inputMethod, setInputMethod] = useState<'flutter' | 'browser' | 'none'>('none');
  const [isFlutterListening, setIsFlutterListening] = useState(false);
  const [flutterTranscript, setFlutterTranscript] = useState('');
  const [flutterInterimTranscript, setFlutterInterimTranscript] = useState('');
  const flutterVoiceAvailable = useRef(false);
  const unsubscribers = useRef<(() => void)[]>([]);

  // Use browser speech recognition as fallback
  const browserSpeech = useSpeechRecognition({
    onResult: (transcript, isFinal) => {
      if (inputMethod === 'browser') {
        onResult?.(transcript, isFinal);
      }
    },
    onError: (error, errorType) => {
      if (inputMethod === 'browser') {
        onError?.(error);
      }
    },
    onStart: () => {
      if (inputMethod === 'browser') {
        onStart?.();
      }
    },
    onEnd: () => {
      if (inputMethod === 'browser') {
        onEnd?.();
      }
    }
  });

  // Check Flutter voice availability on mount
  useEffect(() => {
    const checkFlutterVoice = async () => {
      if (flutterBridge.isWebView) {
        try {
          // Check if Flutter supports voice input
          const response = await flutterBridge.sendToFlutter('check_voice_capability', {});
          flutterVoiceAvailable.current = response?.available === true;
          
          if (flutterVoiceAvailable.current && preferFlutterVoice) {
            setInputMethod('flutter');
            console.log('[WebViewVoice] Flutter voice input available and selected');
          } else if (browserSpeech.isSupported) {
            setInputMethod('browser');
            console.log('[WebViewVoice] Using browser voice input');
          } else {
            setInputMethod('none');
            console.log('[WebViewVoice] No voice input available');
          }
        } catch (error) {
          console.log('[WebViewVoice] Flutter voice check failed, falling back to browser');
          if (browserSpeech.isSupported) {
            setInputMethod('browser');
          } else {
            setInputMethod('none');
          }
        }
      } else {
        // Not in WebView, use browser speech
        if (browserSpeech.isSupported) {
          setInputMethod('browser');
        } else {
          setInputMethod('none');
        }
      }
    };

    checkFlutterVoice();
  }, [browserSpeech.isSupported, preferFlutterVoice]);

  // Setup Flutter voice input listeners
  useEffect(() => {
    if (inputMethod === 'flutter') {
      // Clear previous listeners
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];

      // Setup voice input result listener
      const unsubResult = flutterBridge.onVoiceInputResult((transcript, isFinal) => {
        console.log('[WebViewVoice] Flutter voice result:', { transcript, isFinal });
        
        if (isFinal) {
          setFlutterTranscript(prev => prev + transcript);
          setFlutterInterimTranscript('');
          onResult?.(transcript, true);
        } else {
          setFlutterInterimTranscript(transcript);
          onResult?.(transcript, false);
        }
      });

      // Setup voice input error listener
      const unsubError = flutterBridge.onVoiceInputError((error) => {
        console.error('[WebViewVoice] Flutter voice error:', error);
        setIsFlutterListening(false);
        onError?.(error);
        
        // Try fallback to browser if Flutter fails
        if (browserSpeech.isSupported && error.includes('not available')) {
          console.log('[WebViewVoice] Falling back to browser voice input');
          setInputMethod('browser');
          // Automatically start browser speech if Flutter failed while listening
          if (isFlutterListening) {
            browserSpeech.startListening();
          }
        }
      });

      // Setup voice input status listener
      const unsubStatus = flutterBridge.onVoiceInputStatus((isListening) => {
        console.log('[WebViewVoice] Flutter voice status:', isListening);
        setIsFlutterListening(isListening);
        
        if (isListening) {
          onStart?.();
        } else {
          onEnd?.();
        }
      });

      unsubscribers.current = [unsubResult, unsubError, unsubStatus];
    }

    return () => {
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
    };
  }, [inputMethod, browserSpeech.isSupported, onResult, onError, onStart, onEnd]);

  // Start listening function
  const startListening = useCallback(async () => {
    console.log('[WebViewVoice] Start listening, method:', inputMethod);
    
    if (inputMethod === 'flutter') {
      try {
        setFlutterTranscript('');
        setFlutterInterimTranscript('');
        await flutterBridge.startVoiceInput();
        setIsFlutterListening(true);
      } catch (error) {
        console.error('[WebViewVoice] Failed to start Flutter voice:', error);
        onError?.('Failed to start voice input. Please check microphone permissions.');
        
        // Try fallback to browser
        if (browserSpeech.isSupported) {
          console.log('[WebViewVoice] Attempting browser fallback');
          setInputMethod('browser');
          await browserSpeech.startListening();
        }
      }
    } else if (inputMethod === 'browser') {
      await browserSpeech.startListening();
    } else {
      onError?.('Voice input is not available on this device. Please type your message instead.');
    }
  }, [inputMethod, browserSpeech, onError]);

  // Stop listening function
  const stopListening = useCallback(() => {
    console.log('[WebViewVoice] Stop listening, method:', inputMethod);
    
    if (inputMethod === 'flutter' && isFlutterListening) {
      flutterBridge.stopVoiceInput().catch(error => {
        console.error('[WebViewVoice] Failed to stop Flutter voice:', error);
      });
      setIsFlutterListening(false);
    } else if (inputMethod === 'browser') {
      browserSpeech.stopListening();
    }
  }, [inputMethod, isFlutterListening, browserSpeech]);

  // Toggle listening function
  const toggleListening = useCallback(() => {
    const isCurrentlyListening = inputMethod === 'flutter' ? isFlutterListening : browserSpeech.isListening;
    
    if (isCurrentlyListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [inputMethod, isFlutterListening, browserSpeech.isListening, startListening, stopListening]);

  // Reset transcript function
  const resetTranscript = useCallback(() => {
    if (inputMethod === 'flutter') {
      setFlutterTranscript('');
      setFlutterInterimTranscript('');
    } else if (inputMethod === 'browser') {
      browserSpeech.resetTranscript();
    }
  }, [inputMethod, browserSpeech]);

  // Determine current state based on input method
  const isListening = inputMethod === 'flutter' ? isFlutterListening : browserSpeech.isListening;
  const isSupported = inputMethod !== 'none';
  const transcript = inputMethod === 'flutter' ? flutterTranscript : browserSpeech.transcript;
  const interimTranscript = inputMethod === 'flutter' ? flutterInterimTranscript : browserSpeech.interimTranscript;

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    inputMethod,
    deviceInfo: browserSpeech.deviceInfo,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript
  };
}