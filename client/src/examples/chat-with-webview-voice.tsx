import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Send, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useWebViewVoiceInput } from "@/hooks/useWebViewVoiceInput";
import { WebViewVoiceCompatibility } from "@/components/webview-voice-compatibility";
import { flutterBridge } from "@/lib/flutter-bridge";
import { cn } from "@/lib/utils";

interface ChatWithWebViewVoiceProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatWithWebViewVoice({
  onSendMessage,
  isLoading = false,
  placeholder = "Type or speak your message..."
}: ChatWithWebViewVoiceProps) {
  const [message, setMessage] = useState("");
  const [showCompatibility, setShowCompatibility] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Use WebView-aware voice input hook
  const voice = useWebViewVoiceInput({
    onResult: (transcript, isFinal) => {
      if (isFinal) {
        // Append final transcript to message
        setMessage(prev => {
          const newMessage = prev + (prev ? ' ' : '') + transcript;
          return newMessage;
        });
      } else {
        // Show interim results (optional - for visual feedback)
        // You could show this in a separate UI element
        console.log('[Voice] Interim:', transcript);
      }
    },
    onError: (error) => {
      console.error('[Voice] Error:', error);
      setVoiceError(error);
      // Auto-dismiss error after 5 seconds
      setTimeout(() => setVoiceError(null), 5000);
    },
    onStart: () => {
      console.log('[Voice] Started listening');
      setVoiceError(null);
    },
    onEnd: () => {
      console.log('[Voice] Stopped listening');
    },
    preferFlutterVoice: true // Prefer native Flutter voice when available
  });

  // Handle sending message
  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !isLoading) {
      onSendMessage(trimmedMessage);
      setMessage("");
      voice.resetTranscript();
    }
  };

  // Handle Enter key (send on Enter, new line on Shift+Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Toggle voice input
  const handleVoiceToggle = () => {
    if (voice.isListening) {
      voice.stopListening();
    } else {
      voice.startListening();
    }
  };

  // Show compatibility info on first mount if in WebView
  useEffect(() => {
    if (flutterBridge.isWebView && voice.inputMethod === 'none') {
      setShowCompatibility(true);
    }
  }, [voice.inputMethod]);

  // Auto-focus textarea when voice stops
  useEffect(() => {
    if (!voice.isListening && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [voice.isListening]);

  return (
    <div className="w-full space-y-3">
      {/* Compatibility notification */}
      {showCompatibility && voice.deviceInfo && (
        <WebViewVoiceCompatibility
          deviceInfo={voice.deviceInfo}
          inputMethod={voice.inputMethod}
          isWebView={flutterBridge.isWebView}
          onDismiss={() => setShowCompatibility(false)}
        />
      )}

      {/* Voice error notification */}
      {voiceError && (
        <Card className="p-3 bg-red-50 border-red-200">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{voiceError}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Voice status indicator */}
      {voice.isListening && (
        <div className="flex items-center justify-center space-x-2 py-2">
          <div className="flex space-x-1">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse delay-75"></span>
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse delay-150"></span>
          </div>
          <span className="text-sm text-gray-600">Listening...</span>
          {voice.interimTranscript && (
            <span className="text-sm text-gray-500 italic truncate max-w-[200px]">
              "{voice.interimTranscript}"
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex space-x-2">
        {/* Voice input button */}
        <Button
          type="button"
          variant={voice.isListening ? "destructive" : "outline"}
          size="icon"
          onClick={handleVoiceToggle}
          disabled={!voice.isSupported || isLoading}
          className={cn(
            "shrink-0 transition-all",
            voice.isListening && "animate-pulse"
          )}
          title={
            !voice.isSupported 
              ? "Voice input not available" 
              : voice.isListening 
              ? "Stop listening" 
              : "Start voice input"
          }
        >
          {voice.isListening ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>

        {/* Text input */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={voice.isListening ? "Listening..." : placeholder}
            disabled={isLoading || voice.isListening}
            className="min-h-[44px] max-h-[120px] resize-none"
            rows={1}
          />
        </div>

        {/* Send button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={!message.trim() || isLoading}
          size="icon"
          className="shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Input method indicator */}
      {voice.inputMethod !== 'none' && (
        <div className="flex justify-end">
          <span className="text-xs text-gray-500">
            {voice.inputMethod === 'flutter' 
              ? '🎙️ Using native voice' 
              : voice.inputMethod === 'browser'
              ? '🌐 Using browser voice'
              : '⌨️ Type to chat'}
          </span>
        </div>
      )}
    </div>
  );
}

// Example usage in your chat page:
/*
import { ChatWithWebViewVoice } from '@/examples/chat-with-webview-voice';

function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (message: string) => {
    setIsLoading(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    try {
      // Send to your API
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      
      // Add AI response
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-4 ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block p-3 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-100'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>
      
      <div className="border-t p-4">
        <ChatWithWebViewVoice
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
*/