import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { VoiceClient } from '@/lib/voiceClient';

interface Voice {
  id: string;
  name: string;
  description: string;
}

interface VoiceTutorProps {
  userId?: string;
  lessonId?: string;
  onClose?: () => void;
  className?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type VoiceStatus = 'idle' | 'listening' | 'processing' | 'speaking';

export default function VoiceTutor({ userId, lessonId, onClose, className = '' }: VoiceTutorProps) {
  // State management
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Refs
  const voiceClientRef = useRef<VoiceClient | null>(null);

  // Load available voices on component mount
  useEffect(() => {
    loadAvailableVoices();
    loadUserVoicePreference();
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (voiceClientRef.current) {
        voiceClientRef.current.disconnect();
      }
    };
  }, []);

  const loadAvailableVoices = async () => {
    try {
      const response = await fetch('/api/voice/available');
      const data = await response.json();
      setAvailableVoices(data.voices || []);
    } catch (error) {
      console.error('Failed to load available voices:', error);
      // Fallback to default voices
      setAvailableVoices([
        { id: 'alloy', name: 'Alloy', description: 'Professional and clear' },
        { id: 'ash', name: 'Ash', description: 'Casual and conversational' },
        { id: 'ballad', name: 'Ballad', description: 'Smooth and expressive' },
        { id: 'coral', name: 'Coral', description: 'Warm and friendly' }
      ]);
    }
  };

  const loadUserVoicePreference = async () => {
    if (!userId) return;
    
    try {
      const response = await fetch(`/api/voice/preference/${userId}`);
      const data = await response.json();
      if (data.success && data.voice) {
        setSelectedVoice(data.voice);
      }
    } catch (error) {
      console.error('Failed to load voice preference:', error);
    }
  };

  const saveVoicePreference = async (voice: string) => {
    if (!userId) return;
    
    try {
      await fetch('/api/voice/preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          voice: voice
        })
      });
    } catch (error) {
      console.error('Failed to save voice preference:', error);
    }
  };

  const initializeVoiceClient = useCallback(() => {
    if (voiceClientRef.current) return;

    voiceClientRef.current = new VoiceClient({
      userId,
      lessonId,
      voice: selectedVoice,
      onConnectionChange: setConnectionStatus,
      onVoiceStatusChange: setVoiceStatus,
      onTranscript: (delta) => setTranscript(prev => prev + delta),
      onError: setError
    });
  }, [userId, lessonId, selectedVoice]);

  const connectToVoiceService = useCallback(async () => {
    try {
      if (!voiceClientRef.current) {
        initializeVoiceClient();
      }

      if (!voiceClientRef.current) return;

      setError(null);
      await voiceClientRef.current.initialize();
      await voiceClientRef.current.connect();
      setIsInitialized(true);
    } catch (error: any) {
      console.error('Failed to connect to voice service:', error);
      setError(error.message || 'Connection failed');
      setConnectionStatus('error');
    }
  }, [initializeVoiceClient]);

  const disconnect = useCallback(() => {
    if (voiceClientRef.current) {
      voiceClientRef.current.disconnect();
    }
    setIsInitialized(false);
    setTranscript('');
  }, []);

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    saveVoicePreference(voice);
    
    // If connected, update voice on the fly
    if (connectionStatus === 'connected' && voiceClientRef.current) {
      voiceClientRef.current.updateVoice(voice);
    }
    
    // If not connected, recreate the client with new voice settings
    if (connectionStatus === 'disconnected') {
      voiceClientRef.current = null;
    }
  };

  const getStatusDisplay = () => {
    if (connectionStatus === 'connecting') return 'Connecting...';
    if (connectionStatus === 'error') return error || 'Connection Error';
    if (voiceStatus === 'listening') return '🎙️ Listening...';
    if (voiceStatus === 'processing') return '⏳ Processing...';
    if (voiceStatus === 'speaking') return '🗣️ AI is speaking...';
    if (connectionStatus === 'connected') return '✅ Ready to talk';
    return 'Tap to start voice conversation';
  };

  const getStatusColor = () => {
    if (connectionStatus === 'error') return 'bg-red-500';
    if (voiceStatus === 'listening') return 'bg-green-500 animate-pulse';
    if (voiceStatus === 'processing') return 'bg-yellow-500';
    if (voiceStatus === 'speaking') return 'bg-blue-500 animate-pulse';
    if (connectionStatus === 'connected') return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardContent className="p-6">
        {/* Header with close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Voice Tutor</h3>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Voice Settings */}
        {showSettings && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <label className="block text-sm font-medium mb-2">AI Voice</label>
            <Select value={selectedVoice} onValueChange={handleVoiceChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div>
                      <div className="font-medium">{voice.name}</div>
                      <div className="text-sm text-gray-500">{voice.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Status Display */}
        <div className="text-center mb-6">
          <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${getStatusColor()}`}></div>
          <p className="text-sm text-gray-600">{getStatusDisplay()}</p>
        </div>

        {/* Main Voice Button */}
        <div className="text-center mb-6">
          <Button
            size="lg"
            className="w-24 h-24 rounded-full"
            onClick={connectionStatus === 'disconnected' ? connectToVoiceService : disconnect}
            disabled={connectionStatus === 'connecting'}
            variant={connectionStatus === 'connected' ? 'destructive' : 'default'}
          >
            {voiceStatus === 'listening' ? (
              <Mic className="w-8 h-8 animate-pulse" />
            ) : voiceStatus === 'speaking' ? (
              <Volume2 className="w-8 h-8 animate-pulse" />
            ) : connectionStatus === 'connected' ? (
              <MicOff className="w-8 h-8" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </Button>
        </div>

        {/* Transcript Display */}
        {transcript && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>You said:</strong> {transcript}
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Connection Status Badge */}
        <div className="flex justify-center">
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'secondary'}>
            {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}