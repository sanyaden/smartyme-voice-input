import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Keyboard, AlertCircle, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useFlutterWebViewVoice } from "@/hooks/useFlutterWebViewVoice";
import { cn } from "@/lib/utils";

interface FlutterWebViewVoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showInstructions?: boolean;
}

export function FlutterWebViewVoiceInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Tap the mic to speak or type your message...",
  disabled = false,
  className,
  showInstructions = true
}: FlutterWebViewVoiceInputProps) {
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice');
  const [showFallbackAlert, setShowFallbackAlert] = useState(false);
  const [voiceAttempts, setVoiceAttempts] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const voice = useFlutterWebViewVoice({
    onResult: (transcript, isFinal) => {
      if (isFinal) {
        // Append to existing text
        onChange(value + (value ? ' ' : '') + transcript);
        setVoiceAttempts(0); // Reset attempts on success
      }
    },
    onError: (error) => {
      console.error('[VoiceInput] Error:', error);
      setVoiceAttempts(prev => prev + 1);
      
      // After 2 failed attempts, suggest keyboard fallback
      if (voiceAttempts >= 1) {
        setShowFallbackAlert(true);
        setInputMode('keyboard');
        setTimeout(() => {
          textareaRef.current?.focus();
        }, 100);
      }
    },
    onStart: () => {
      console.log('[VoiceInput] Started');
      setShowFallbackAlert(false);
    },
    onEnd: () => {
      console.log('[VoiceInput] Ended');
    },
    autoRetry: true,
    maxRetries: 2
  });

  // Auto-detect best input mode on mount
  useEffect(() => {
    if (voice.isWebView) {
      // In WebView, check if voice is actually supported
      if (!voice.isSupported) {
        setInputMode('keyboard');
        setShowFallbackAlert(true);
      } else {
        // Test voice capability
        console.log('[VoiceInput] WebView detected, voice support:', voice.isSupported);
      }
    }
  }, [voice.isWebView, voice.isSupported]);

  const handleVoiceClick = async () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      try {
        await voice.startListening();
      } catch (error) {
        console.error('[VoiceInput] Failed to start:', error);
        setInputMode('keyboard');
        setShowFallbackAlert(true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  const switchToKeyboard = () => {
    setInputMode('keyboard');
    voice.stopListening();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const switchToVoice = () => {
    setInputMode('voice');
    setVoiceAttempts(0);
    setShowFallbackAlert(false);
  };

  return (
    <div className={cn("w-full space-y-3", className)}>
      {/* WebView detection banner */}
      {voice.isWebView && showInstructions && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            <div className="flex items-center justify-between">
              <span className="text-blue-800">
                {voice.webViewInfo?.platform === 'ios' 
                  ? 'iOS App' 
                  : voice.webViewInfo?.platform === 'android' 
                  ? 'Android App' 
                  : 'Mobile App'} detected
              </span>
              <Badge variant="outline" className="ml-2 text-xs">
                {voice.isSupported ? 'Voice Ready' : 'Type to Chat'}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Fallback suggestion alert */}
      {showFallbackAlert && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="text-sm text-yellow-800">
                Voice input is having issues. You can type your message instead.
              </p>
              {voice.isWebView && voice.webViewInfo?.platform === 'ios' && (
                <p className="text-xs text-yellow-700">
                  Tip: You can also use your iPhone's voice keyboard (microphone icon on keyboard).
                </p>
              )}
              {voice.isWebView && voice.webViewInfo?.platform === 'android' && (
                <p className="text-xs text-yellow-700">
                  Tip: You can use Google's voice typing (microphone on keyboard) as an alternative.
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Voice listening indicator */}
      {voice.isListening && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse delay-75"></span>
                  <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse delay-150"></span>
                </div>
                <span className="text-sm font-medium text-red-800">Listening...</span>
              </div>
              {voice.interimTranscript && (
                <span className="text-sm text-red-600 italic max-w-[150px] truncate">
                  {voice.interimTranscript}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main input area */}
      <div className="flex items-end space-x-2">
        {/* Voice/Keyboard toggle button */}
        <div className="flex flex-col space-y-1">
          {inputMode === 'voice' && voice.isSupported ? (
            <Button
              type="button"
              variant={voice.isListening ? "destructive" : "outline"}
              size="icon"
              onClick={handleVoiceClick}
              disabled={disabled}
              className={cn(
                "transition-all",
                voice.isListening && "animate-pulse"
              )}
              title={voice.isListening ? "Stop listening" : "Start voice input"}
            >
              {voice.isListening ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => inputMode === 'keyboard' && voice.isSupported ? switchToVoice() : undefined}
              disabled={disabled || !voice.isSupported}
              title={voice.isSupported ? "Switch to voice input" : "Voice not available"}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          )}
          
          {/* Mode switch button */}
          {voice.isSupported && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-10"
              onClick={inputMode === 'voice' ? switchToKeyboard : switchToVoice}
              title={inputMode === 'voice' ? "Switch to keyboard" : "Switch to voice"}
            >
              {inputMode === 'voice' ? (
                <Keyboard className="h-3 w-3" />
              ) : (
                <Mic className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voice.isListening 
              ? "Speak now..." 
              : inputMode === 'keyboard' || !voice.isSupported
              ? "Type your message here..."
              : placeholder
          }
          disabled={disabled || voice.isListening}
          className={cn(
            "min-h-[44px] max-h-[120px] resize-none flex-1",
            voice.isListening && "opacity-75"
          )}
          rows={1}
        />
      </div>

      {/* Status indicator */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2">
          {voice.isWebView && (
            <Badge variant="outline" className="text-xs">
              {voice.webViewInfo?.browser.replace('-', ' ')}
            </Badge>
          )}
          {inputMode === 'voice' && voice.isSupported ? (
            <span className="flex items-center space-x-1">
              <Check className="h-3 w-3 text-green-500" />
              <span>Voice active</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1">
              <Keyboard className="h-3 w-3" />
              <span>Keyboard mode</span>
            </span>
          )}
        </div>
        
        {voice.transcript && (
          <button
            onClick={voice.resetTranscript}
            className="text-blue-600 hover:text-blue-800"
          >
            Clear voice text
          </button>
        )}
      </div>
    </div>
  );
}