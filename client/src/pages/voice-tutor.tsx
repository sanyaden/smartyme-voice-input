import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Mic, MicOff, Settings, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getWebViewParams } from "@/contexts/WebViewContext";
import { usePageTitle } from "@/hooks/use-page-title";
import { apiRequest } from "@/lib/queryClient";
import { getScenarioImage, mrSmartImage } from "@/lib/assets";

// Flutter communication bridge
declare global {
  interface Window {
    flutter_inappwebview?: {
      callHandler: (handlerName: string, ...args: any[]) => Promise<any>;
    };
    flutterVoiceTutor?: {
      onSessionReady: () => void;
      onVoiceStatusChange: (status: 'listening' | 'speaking' | 'idle') => void;
      onConversationEnd: () => void;
    };
  }
  interface Navigator {
    standalone?: boolean;
  }
}

interface VoiceTutorParams {
  user_id?: string;
  lesson_id?: string;
  voice?: 'alloy' | 'echo' | 'ballad' | 'coral' | 'sage' | 'shimmer' | 'ash' | 'verse';
  mode?: 'practice' | 'lesson' | 'general';
}

interface VoiceSession {
  id: string;
  status: 'connecting' | 'ready' | 'listening' | 'speaking' | 'ended';
  currentMessage?: string;
  transcript?: string;
  error?: string;
}

export default function VoiceTutorPage() {
  usePageTitle("AI Voice Tutor");
  
  // Get parameters from URL or WebView context
  const urlParams = new URLSearchParams(window.location.search);
  const webViewParams = getWebViewParams();
  
  const params: VoiceTutorParams = {
    user_id: urlParams.get('user_id') || webViewParams.userId,
    lesson_id: urlParams.get('lesson_id') || webViewParams.lessonId,
    voice: (urlParams.get('voice') as any) || 'alloy',
    mode: (urlParams.get('mode') as any) || 'practice'
  };

  // Component state
  const [session, setSession] = useState<VoiceSession>({
    id: '',
    status: 'connecting'
  });
  const [isWebView, setIsWebView] = useState(false);
  const [voiceVolume, setVoiceVolume] = useState(0);
  const [conversationHistory, setConversationHistory] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // WebSocket connection for real-time voice
  const wsRef = useRef<WebSocket | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isRecordingRef = useRef<boolean>(false); // Immediate tracking for audio processor
  const minRecordingDuration = 300; // Minimum 300ms recording

  // Detect WebView environment
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isWebViewEnv = /wv|android.*version\/\d+\.\d+/i.test(userAgent) || 
                         window.navigator.standalone === true ||
                         window.flutter_inappwebview !== undefined;
    setIsWebView(isWebViewEnv);
  }, []);

  // Flutter communication setup
  useEffect(() => {
    if (isWebView) {
      // Set up Flutter communication bridge
      window.flutterVoiceTutor = {
        onSessionReady: () => {
          console.log('📱 Flutter notified: Session ready');
          window.flutter_inappwebview?.callHandler('voiceStatus', { status: 'ready' });
        },
        onVoiceStatusChange: (status) => {
          console.log('📱 Flutter notified: Voice status changed to', status);
          window.flutter_inappwebview?.callHandler('voiceStatus', { status });
        },
        onConversationEnd: () => {
          console.log('📱 Flutter notified: Conversation ended');
          window.flutter_inappwebview?.callHandler('sessionEnded');
        }
      };

      console.log('📱 Flutter WebView communication bridge initialized');
    }
  }, [isWebView]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (params.user_id) {
      connectToVoiceService();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      // Clean up audio resources and refs
      isRecordingRef.current = false;
      stopAudioCapture();
    };
  }, [params.user_id]);

  const connectToVoiceService = useCallback(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/realtime/connect`;

    console.log('🔌 Connecting to voice service:', wsUrl);

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('✅ Connected to voice service');
      
      // Authenticate with voice service
      const authMessage = {
        type: 'authenticate',
        auth_type: 'web',
        api_key: `webview-voice-${Date.now()}`,
        session_id: `voice_tutor_${Date.now()}`,
        user_id: params.user_id,
        lesson_id: params.lesson_id || 'general',
        voice: params.voice || 'alloy'
      };

      wsRef.current?.send(JSON.stringify(authMessage));
      setSession(prev => ({ ...prev, status: 'ready' }));
      
      // Notify Flutter
      if (isWebView && window.flutterVoiceTutor) {
        window.flutterVoiceTutor.onSessionReady();
      }
    };

    wsRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleVoiceMessage(message);
      } catch (error) {
        console.error('❌ Error parsing voice message:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setSession(prev => ({ ...prev, status: 'ended', error: 'Connection failed' }));
    };

    wsRef.current.onclose = () => {
      console.log('🔌 Voice service disconnected');
      setSession(prev => ({ ...prev, status: 'ended' }));
    };
  }, [params, isWebView]);

  const handleVoiceMessage = useCallback((message: any) => {
    console.log('📥 Voice message received:', message.type);

    switch (message.type) {
      case 'session.created':
        setSession(prev => ({ ...prev, id: message.session_id, status: 'ready' }));
        break;
        
      case 'input_audio_buffer.speech_started':
        setSession(prev => prev.status !== 'listening' ? { ...prev, status: 'listening' } : prev);
        if (isWebView && window.flutterVoiceTutor) {
          window.flutterVoiceTutor.onVoiceStatusChange('listening');
        }
        break;
        
      case 'input_audio_buffer.speech_stopped':
        setSession(prev => prev.status !== 'ready' ? { ...prev, status: 'ready' } : prev);
        break;
        
      case 'response.audio_transcript.delta':
        setSession(prev => ({ 
          ...prev, 
          status: 'speaking',
          currentMessage: (prev.currentMessage || '') + message.delta 
        }));
        if (isWebView && window.flutterVoiceTutor && session.status !== 'speaking') {
          window.flutterVoiceTutor.onVoiceStatusChange('speaking');
        }
        break;
        
      case 'response.audio_transcript.done':
        setConversationHistory(prev => [...prev, {
          role: 'assistant',
          content: message.transcript,
          timestamp: new Date()
        }]);
        setSession(prev => ({ ...prev, status: 'ready', currentMessage: '' }));
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        setConversationHistory(prev => [...prev, {
          role: 'user', 
          content: message.transcript,
          timestamp: new Date()
        }]);
        break;
        
      case 'error':
        console.error('❌ Voice service error:', message.error);
        const errorText = typeof message.error === 'object' 
          ? (message.error.message || message.error.code || JSON.stringify(message.error))
          : message.error;
        setSession(prev => ({ ...prev, error: errorText }));
        break;
    }
  }, [isWebView, session.status]);

  // Audio capture functions with performance optimizations
  const startAudioCapture = async () => {
    try {
      console.log('🎤 Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000, // OpenAI requires 24kHz
          channelCount: 1    // OpenAI requires mono
        } 
      });
      
      audioStreamRef.current = stream;
      
      // Create AudioContext for proper PCM16 conversion
      const audioContext = new AudioContext({ sampleRate: 24000 });
      const source = audioContext.createMediaStreamSource(stream);
      
      // Use smaller buffer size for lower latency (2048 instead of 4096)
      const bufferSize = 2048;
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      // Pre-allocate buffers to avoid GC pressure
      const tempBuffer = new Int16Array(bufferSize);
      const tempUint8Array = new Uint8Array(bufferSize * 2);
      
      processor.onaudioprocess = (event) => {
        if (!isRecordingRef.current || !wsRef.current) return;
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0); // Get mono channel
        
        // Optimized PCM16 conversion - reuse pre-allocated buffer
        for (let i = 0; i < inputData.length; i++) {
          // Clamp to [-1, 1] and convert to 16-bit
          const sample = Math.max(-1, Math.min(1, inputData[i]));
          tempBuffer[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
        
        // Convert to base64 - reliable method for large buffers
        const uint8View = new Uint8Array(tempBuffer.buffer, 0, tempBuffer.length * 2);
        let binary = '';
        for (let i = 0; i < uint8View.length; i++) {
          binary += String.fromCharCode(uint8View[i]);
        }
        const base64Audio = btoa(binary);
        
        // Debug: Log audio data size periodically
        if (Math.random() < 0.05) { // Log ~5% of chunks to verify data flow
          console.log(`🎵 Sending audio chunk: ${base64Audio.length} chars, ${inputData.length} samples, isRecording: ${isRecordingRef.current}`);
        }
        
        // Send to OpenAI
        wsRef.current.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio
        }));
      };
      
      // Connect the audio processing chain
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // Store references for cleanup
      audioContextRef.current = audioContext;
      mediaRecorderRef.current = { audioContext, processor, source };
      
      console.log('✅ Audio recording started with PCM16 @ 24kHz (optimized)');
      
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      setSession(prev => ({ 
        ...prev, 
        error: 'Microphone access denied. Please allow microphone access and try again.' 
      }));
      setIsRecording(false);
    }
  };

  const stopAudioCapture = () => {
    // Disconnect audio processing nodes
    if (mediaRecorderRef.current) {
      const { processor, source } = mediaRecorderRef.current;
      if (processor) {
        processor.disconnect();
        processor.onaudioprocess = null;
      }
      if (source) {
        source.disconnect();
      }
      mediaRecorderRef.current = null;
      console.log('⏹️ Audio processing stopped');
    }
    
    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log('🔇 AudioContext closed');
    }
    
    // Stop media stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
      console.log('📻 Media stream released');
    }
  };

  const startListening = useCallback(async () => {
    if (wsRef.current && session.status === 'ready') {
      console.log('🎙️ Starting audio recording...');
      const startTime = Date.now();
      setRecordingStartTime(startTime);
      setRecordingDuration(0);
      
      // Clear any existing audio buffer first
      wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
      
      // Set recording state BEFORE starting audio capture
      setIsRecording(true);
      isRecordingRef.current = true;
      
      // Optimized recording timer with longer intervals to reduce CPU usage
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - startTime);
      }, 100); // Reduced frequency from 50ms to 100ms
      
      // Start capturing audio from microphone (browser WebRTC)
      try {
        await startAudioCapture();
      } catch (error) {
        console.error('❌ Failed to start audio capture:', error);
        setIsRecording(false);
        isRecordingRef.current = false;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      }
    }
  }, [session.status]);

  const stopListening = useCallback(() => {
    if (wsRef.current && isRecording) {
      const finalDuration = recordingStartTime ? Date.now() - recordingStartTime : 0;
      console.log(`🎙️ Stopping audio recording after ${finalDuration}ms`);
      
      // Stop audio capture
      stopAudioCapture();
      
      // Clear the timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      if (finalDuration < minRecordingDuration) {
        console.warn(`⚠️ Recording too short (${finalDuration}ms), minimum is ${minRecordingDuration}ms. Clearing buffer.`);
        // Clear the buffer instead of committing
        wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
        setSession(prev => ({ ...prev, status: 'ready' }));
        
        // Show brief error message
        setSession(prev => ({ ...prev, error: 'Recording too short - please hold for at least 0.3 seconds' }));
        setTimeout(() => {
          setSession(prev => ({ ...prev, error: undefined }));
        }, 2000);
      } else {
        console.log('✅ Recording duration sufficient, committing audio buffer');
        // Add a small delay to ensure all audio chunks are sent
        setTimeout(() => {
          if (wsRef.current) {
            wsRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          }
        }, 100); // Reduced delay from 200ms to 100ms
      }
      
      setIsRecording(false);
      isRecordingRef.current = false;
      setRecordingStartTime(null);
      setRecordingDuration(0);
    }
  }, [isRecording, recordingStartTime, minRecordingDuration]);

  const endSession = useCallback(() => {
    // Clean up audio resources
    stopAudioCapture();
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Clear any active timers
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (isWebView && window.flutterVoiceTutor) {
      window.flutterVoiceTutor.onConversationEnd();
    }
  }, [isWebView]);

  // Get conversation context based on lesson - memoized for performance
  const conversationPrompt = useMemo(() => {
    if (params.mode === 'lesson' && params.lesson_id) {
      return `Practice lesson ${params.lesson_id} content through conversation`;
    } else if (params.mode === 'practice') {
      return "General communication skills practice session";
    }
    return "Open conversation with AI communication tutor";
  }, [params.mode, params.lesson_id]);

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col">
      {/* Header with Mr. Smart branding */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mr. Smart Avatar */}
            <img 
              src={mrSmartImage} 
              alt="Mr. Smart"
              className="w-12 h-12 rounded-full object-cover"
            />
            <div>
              <h1 className="font-semibold text-gray-900">Mr. Smart</h1>
              <p className="text-sm text-gray-600">Voice Communication Coach</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge 
              variant={session.status === 'ready' ? 'default' : session.status === 'connecting' ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {session.status === 'ready' ? '🎙️ Ready' : 
               session.status === 'connecting' ? '🔄 Connecting...' :
               session.status === 'listening' ? '👂 Listening' :
               session.status === 'speaking' ? '🗣️ Speaking' : '❌ Disconnected'}
            </Badge>
            {isWebView && (
              <Button variant="ghost" size="sm" onClick={endSession}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Conversation Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {conversationHistory.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                  <img src={mrSmartImage} alt="Mr. Smart" className="w-12 h-12 rounded-full" />
                </div>
                <h3 className="font-medium text-gray-900 mb-2">Ready to Practice!</h3>
                <p className="text-sm text-gray-600 mb-4">
                  {conversationPrompt}
                </p>
                <p className="text-xs text-gray-500">
                  Tap the microphone to start your conversation
                </p>
              </CardContent>
            </Card>
          ) : (
            conversationHistory.map((entry, index) => (
              <div
                key={index}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    entry.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-white shadow-sm border'
                  }`}
                >
                  <p className="text-sm">{entry.content}</p>
                  <p className={`text-xs mt-1 ${entry.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {entry.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* Current AI Response */}
          {session.currentMessage && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-3 max-w-[80%]">
                <p className="text-sm">{session.currentMessage}</p>
                <div className="flex items-center mt-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-xs text-gray-500 ml-2">Speaking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Voice Controls */}
        <div className="bg-white border-t p-4">
          <div className="flex items-center justify-center space-x-4">
            {session.status === 'ready' ? (
              <Button
                onMouseDown={startListening}
                onMouseUp={stopListening}
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
              >
                <Mic className="w-6 h-6 text-white" />
              </Button>
            ) : session.status === 'listening' || isRecording ? (
              <Button
                onMouseUp={stopListening}
                onTouchEnd={stopListening}
                className="w-16 h-16 rounded-full bg-gradient-to-r from-red-500 to-pink-500 shadow-lg animate-pulse"
              >
                <MicOff className="w-6 h-6 text-white" />
              </Button>
            ) : (
              <Button
                disabled
                className="w-16 h-16 rounded-full bg-gray-300"
              >
                <Mic className="w-6 h-6 text-gray-500" />
              </Button>
            )}
          </div>

          <div className="text-center mt-3">
            <p className="text-sm text-gray-600">
              {session.status === 'ready' && !isRecording ? 'Hold to speak (min 0.3s)' :
               session.status === 'listening' || isRecording ? 'Release when done speaking' :
               session.status === 'speaking' ? 'AI is responding...' :
               session.status === 'connecting' ? 'Connecting to AI...' :
               'Connection issue'}
            </p>
            {isRecording && (
              <p className={`text-xs mt-1 ${recordingDuration >= minRecordingDuration ? 'text-green-600' : 'text-orange-600'}`}>
                Recording... {Math.max(0, Math.floor(recordingDuration / 100) / 10)}s
                {recordingDuration < minRecordingDuration && ' (min 0.3s)'}
              </p>
            )}
            {session.error && (
              <p className="text-xs text-red-600 mt-1">{session.error}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}