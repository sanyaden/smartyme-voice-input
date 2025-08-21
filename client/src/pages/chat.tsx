import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, X, Mic, MicOff, RotateCcw, AlertTriangle, Info } from "lucide-react";
import MarkdownRenderer from "@/components/markdown-renderer";
import TypingIndicator from "@/components/typing-indicator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import { mrSmartImage } from "@/lib/assets";
import { useWebView } from "@/contexts/WebViewContext";
import { useWebViewNavigation } from "@/hooks/useWebViewNavigation";
import { getWebViewParams } from "@/contexts/WebViewContext";
import { useFlutterWebViewVoice } from "@/hooks/useFlutterWebViewVoice";
import { FlutterWebViewVoiceInput } from "@/components/flutter-webview-voice-input";
import { debugLog } from "@/lib/debug";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  id?: string;
}



export default function ChatPage() {
  usePageTitle("Chat with Mr. Smart");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // WebView integration
  const { 
    isWebView, 
    userId, 
    lessonId, 
    courseId, 
    authToken,
    sendToFlutter, 
    triggerHaptic, 
    sendAnalytics,
    requestMicrophone 
  } = useWebView();
  const { setPreventExit } = useWebViewNavigation();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [scenario, setScenario] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showInputPanel, setShowInputPanel] = useState(false);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messageStatus, setMessageStatus] = useState<'sending' | 'sent' | 'delivered' | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceInputActive, setVoiceInputActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceErrorType, setVoiceErrorType] = useState<string | null>(null);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Flutter WebView-compatible voice recognition
  // Memoize voice callbacks to prevent infinite loops
  const handleVoiceResult = useCallback((text: string, isFinal: boolean) => {
    debugLog('voice', '[Chat] Voice result:', { text, isFinal });
    if (isFinal) {
      // Add final transcript to input value
      setInputValue(prev => {
        const newValue = prev + (prev ? ' ' : '') + text;
        debugLog('voice', '[Chat] Updating input value:', newValue);
        return newValue;
      });
      // Trigger haptic feedback in WebView
      if (isWebView) {
        triggerHaptic('light');
      }
    } else {
      // Show interim results for visual feedback
      debugLog('voice', '[Chat] Interim transcript:', text);
    }
  }, [isWebView, triggerHaptic]);

  const handleVoiceError = useCallback((error: string) => {
    debugLog('voice', '[Chat] Voice input error:', error);
    setVoiceError(error);
    setVoiceInputActive(false);
    
    // Handle permission errors more gracefully in WebView
    if (error === 'permission' && voice.isWebView) {
      // For WebView, just log it - the app should handle permission request
      debugLog('voice', '[Chat] Microphone permission needed in WebView, app should handle');
      // Don't show toast - the Flutter app will handle permissions
    } else if (error.includes('permission') || error.includes('microphone')) {
      // Only show toast for non-WebView or after permission was explicitly denied
      if (!voice.isWebView) {
        toast({
          title: "Microphone Access Required",
          description: "Please allow microphone access in your browser settings.",
          variant: "destructive"
        });
      }
    }
  }, [toast, voice.isWebView]);

  const handleVoiceStart = useCallback(() => {
    debugLog('voice', '[Chat] Voice input started');
    setVoiceInputActive(true);
    setVoiceError(null);
    setVoiceErrorType(null);
    if (isWebView) {
      triggerHaptic('medium');
    }
  }, [isWebView, triggerHaptic]);

  const handleVoiceEnd = useCallback(() => {
    debugLog('voice', '[Chat] Voice input ended');
    setVoiceInputActive(false);
  }, []);

  const voice = useFlutterWebViewVoice({
    onResult: handleVoiceResult,
    onError: handleVoiceError,
    onStart: handleVoiceStart,
    onEnd: handleVoiceEnd,
    autoRetry: true,
    maxRetries: 2
  });
  
  // Log voice support and WebView detection on mount
  useEffect(() => {
    debugLog('voice', '[Chat] Voice environment:', {
      isWebView: voice.isWebView,
      webViewInfo: voice.webViewInfo,
      isSupported: voice.isSupported,
      hasSpeechRecognition: 'SpeechRecognition' in window,
      hasWebkitSpeechRecognition: 'webkitSpeechRecognition' in window,
      userAgent: navigator.userAgent
    });
  }, [voice.isWebView, voice.webViewInfo, voice.isSupported]);




  // Function to extract suggestions from AI messages
  const extractSuggestions = (content: string): string[] => {
    // Input validation
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      debugLog('chat', '❌ Invalid content provided for extraction');
      return [];
    }
    
    const suggestions: string[] = [];
    const contentLower = content.toLowerCase();
    
    // Extract suggestions from AI response content
    
    try {
      // Phase 1: Try structured content extraction first (highest priority)
      
      // Look for lettered options (A), B), C), D), etc.)
      const lines = content.split('\n');
      lines.forEach((line) => {
        const letteredMatch = line.match(/([A-Z])\)\s*(.+)/);
        if (letteredMatch) {
          const option = letteredMatch[1]; // A, B, C, D
          let text = letteredMatch[2].trim();
          
          // Extract the main topic (before colon if present)
          if (text.includes(':')) {
            text = text.split(':')[0].trim();
          }
          
          // Remove quotes and clean up
          text = text.replace(/['"]/g, '').trim();
          
          // Limit to maximum 2 words
          const words = text.split(' ');
          text = words.slice(0, 2).join(' ');
          
          if (text.length > 0 && text.length <= 30) {
            suggestions.push(`${option}) ${text}`);
          }
        }
      });
      
      // Enhanced numbered options extraction
      if (suggestions.length === 0) {
        // First try: Match full numbered lines (more comprehensive)
        lines.forEach((line) => {
          const numberedMatch = line.match(/^\s*(\d+)\.\s*(.+)/);
          if (numberedMatch) {
            let text = numberedMatch[2].trim();
            
            // Extract the main topic (before colon if present)
            if (text.includes(':')) {
              text = text.split(':')[0].trim();
            }
            
            // Remove quotes and clean up
            text = text.replace(/['"]/g, '').trim();
            
            // Limit to maximum 2 words
            const words = text.split(' ');
            text = words.slice(0, 2).join(' ');
            
            if (text.length > 0 && text.length <= 30) {
              suggestions.push(text);
            }
          }
        });
      }
      
      // Look for bullet points (-, •, *)
      if (suggestions.length === 0) {
        const bulletMatches = content.match(/[•\-\*]\s*([^\n]+)/g);
        if (bulletMatches) {
          bulletMatches.forEach(match => {
            let suggestion = match.replace(/[•\-\*]\s*/, '').trim();
            
            // Clean up similar to numbered options
            if (suggestion.includes(':')) {
              suggestion = suggestion.split(':')[0].trim();
            }
            suggestion = suggestion.replace(/['"]/g, '').trim();
            
            // Limit to maximum 2 words
            const words = suggestion.split(' ');
            suggestion = words.slice(0, 2).join(' ');
            
            if (suggestion.length > 0 && suggestion.length <= 30) {
              suggestions.push(suggestion);
            }
          });
        }
      }
      
      // Phase 2: Content-aware contextual suggestions (only if no structured content found)
      if (suggestions.length === 0) {
        
        // Simple yes/no questions
        if (contentLower.includes('yes or no') || 
            (contentLower.includes('?') && (contentLower.includes(' or ') || contentLower.includes('either')))) {
          suggestions.push('Yes', 'No');
        }
        
        // Ready/preparation questions
        else if (contentLower.includes('ready') && contentLower.includes('?')) {
          suggestions.push('Yes ready', 'Tell more');
        }
        
        // Continue/proceed prompts
        else if ((contentLower.includes('continue') || contentLower.includes('proceed')) && contentLower.includes('?')) {
          suggestions.push('Continue', 'Let think');
        }
        
        // Practice/training invitations
        else if (contentLower.includes('practice') && contentLower.includes('?') && 
                 !contentLower.includes('which') && !contentLower.includes('what')) {
          suggestions.push('Yes practice', 'Tell more', 'Maybe later');
        }
        
        // Question/quiz readiness
        else if (contentLower.includes('question') && contentLower.includes('?') && 
                 (contentLower.includes('ready') || contentLower.includes('start'))) {
          suggestions.push('Im ready', 'Go ahead', 'Let think');
        }
        
        // Choice/selection requests (only if no structured options found)
        else if ((contentLower.includes('which') || contentLower.includes('what would you like') || 
                  contentLower.includes('choose')) && contentLower.includes('?')) {
          // Only add generic choices if we truly found no structured content
          suggestions.push('Surprise me', 'Let choose', 'Something easy');
        }
      }
      
      // Phase 3: Last resort - quoted text extraction (only for very specific cases)
      if (suggestions.length === 0) {
        const quotedMatches = content.match(/"([^"]{3,25})"/g);
        if (quotedMatches && quotedMatches.length <= 4) {
          quotedMatches.forEach(match => {
            let suggestion = match.replace(/"/g, '').trim();
            
            // Limit to maximum 2 words
            const words = suggestion.split(' ');
            suggestion = words.slice(0, 2).join(' ');
            
            if (suggestion.length >= 3 && suggestion.length <= 25 && 
                !suggestion.includes('.') && !suggestion.includes(':')) {
              suggestions.push(suggestion);
            }
          });
        }
      }
      
    } catch (error) {
      return [];
    }
    
    // Remove duplicates and limit to 4 suggestions
    const uniqueSuggestions = suggestions.filter((item, index) => suggestions.indexOf(item) === index);
    return uniqueSuggestions.slice(0, 4);
  };

  // Function to start suggestion timer - memoized to prevent infinite loops
  const startSuggestionTimer = useCallback(() => {
    // Clear any existing timeout
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }
    
    // Hide suggestions initially
    setShowSuggestions(false);
    setDynamicSuggestions([]);
    
    // Set new timeout for 1-2 seconds (random for natural feel)
    const delay = Math.random() * 1000 + 1000; // 1-2 seconds
    const timeout = setTimeout(() => {
      setMessages(currentMessages => {
        const lastMessage = currentMessages[currentMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          const suggestions = extractSuggestions(lastMessage.content);
          // Only show suggestions if we have meaningful ones
          if (suggestions.length > 0) {
            setDynamicSuggestions(suggestions);
            setShowSuggestions(true);
          } else {
            setShowSuggestions(false);
            setDynamicSuggestions([]);
          }
        }
        return currentMessages; // Return unchanged messages
      });
    }, delay);
    
    suggestionTimeoutRef.current = timeout;
  }, []);

  // Function to handle user interaction (hide suggestions)
  const hideOnUserInteraction = () => {
    setShowSuggestions(false);
    setDynamicSuggestions([]);
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }
  };

  // Function to add messages with delay
  const addMessagesWithDelay = (messagesToAdd: ChatMessage[]) => {
    messagesToAdd.forEach((message, index) => {
      setTimeout(() => {
        // Show typing indicator before each message (including the first)
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          setMessages(prev => [...prev, { ...message, id: `msg_${Date.now()}_${index}` }]);
          
          // Show input panel after the last message (third message "Are you ready?")
          if (index === messagesToAdd.length - 1) {
            setTimeout(() => {
              setShowInputPanel(true);
              // Start suggestion timer after input panel is shown
              startSuggestionTimer();
            }, 250); // Small delay after the last message appears
          }
        }, 500);
      }, index * 1000); // 1 second between messages (0.5s typing + 0.5s gap)
    });
  };

  // Load scenario and clear any old session ID
  useEffect(() => {
    let storedScenario = null;
    
    // Safe sessionStorage read with error handling
    try {
      storedScenario = sessionStorage.getItem('currentScenario');
      // Always start with a fresh session for each chat
      setSessionId(null);
      sessionStorage.removeItem('chatSessionId');
    } catch (error) {
      debugLog('chat', 'SessionStorage unavailable:', error);
      // Continue without session storage - scenario will be null and chat will use fallback
    }
    
    if (storedScenario) {
      const parsedScenario = JSON.parse(storedScenario);
      setScenario(parsedScenario);
      
      // Initialize with natural welcome messages
      const getConversationalTitle = (title: string, isPostLesson = false) => {
        if (title.toLowerCase().includes("quiz on this lesson")) {
          return `a quick quiz on "${parsedScenario.lessonTitle || 'the lesson'}"`;
        }
        if (title.toLowerCase().includes("follow-up questions")) {
          return `follow-up questions about "${parsedScenario.lessonTitle || 'the lesson'}"`;
        }
        if (title.toLowerCase().includes("quiz")) return "a quick quiz";
        if (title.toLowerCase().includes("role play")) return "some role playing";
        if (title.toLowerCase().includes("phrase")) return "phrase improvement";
        return title.toLowerCase();
      };

      const welcomeMessages = [
        {
          role: "assistant" as const,
          content: "Hi! Great to have you here.",
          timestamp: new Date()
        },
        {
          role: "assistant" as const, 
          content: `Let's try ${getConversationalTitle(parsedScenario.title)}.`,
          timestamp: new Date()
        },
        {
          role: "assistant" as const,
          content: "Ready?",
          timestamp: new Date()
        }
      ];
      
      addMessagesWithDelay(welcomeMessages);
    }
  }, []);

  // Keyboard detection for input positioning (moved to state declarations above)
  
  // Calculate dynamic input panel height for proper scrolling - memoized
  const inputPanelHeight = useMemo(() => {
    const baseInputHeight = 88; // Input + padding + border
    const suggestionsHeight = (showSuggestions && dynamicSuggestions.length > 0) ? 60 : 0;
    const safeMargin = 20; // Buffer for comfortable scrolling
    const safeAreaBottom = 16; // Approximate safe area
    
    return baseInputHeight + suggestionsHeight + safeMargin + safeAreaBottom;
  }, [showSuggestions, dynamicSuggestions.length]);
  
  useEffect(() => {
    // Primary: Visual Viewport API for accurate keyboard detection
    if (window.visualViewport) {

    const handleViewportChange = () => {
      const viewport = window.visualViewport!;
      const windowHeight = window.innerHeight;
      const viewportHeight = viewport.height;
      const heightDifference = windowHeight - viewportHeight;
      
      // Set keyboard height for input positioning
      setKeyboardHeight(Math.max(0, heightDifference));
      
      debugLog('webview', 'Viewport change for input:', { 
        windowHeight, 
        viewportHeight, 
        keyboardHeight: heightDifference,
        isKeyboard: heightDifference > 50
      });
    };

    // Listen for viewport changes
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
    
    // Initial check
    handleViewportChange();

      return () => {
        window.visualViewport?.removeEventListener('resize', handleViewportChange);
        window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      };
    } else {
      // Fallback: window resize for older WebView versions
      let initialHeight = window.innerHeight;
      
      const handleResize = () => {
        const currentHeight = window.innerHeight;
        const heightDifference = initialHeight - currentHeight;
        const estimatedKeyboardHeight = Math.max(0, heightDifference);
        
        setKeyboardHeight(estimatedKeyboardHeight);
        
        debugLog('webview', 'Fallback keyboard detection:', { 
          initialHeight, 
          currentHeight, 
          keyboardHeight: estimatedKeyboardHeight
        });
      };

      window.addEventListener('resize', handleResize);
      handleResize(); // Initial check
      
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Keyboard fallback detection also removed - fixed positioning handles this

  // Enhanced scroll management with dynamic spacing awareness
  useEffect(() => {
    if (messages.length > 0 && chatContainerRef.current) {
      const container = chatContainerRef.current;
      
      // Improved scroll to bottom function that accounts for spacer
      const scrollToBottom = () => {
        // Force scroll to absolute bottom to reveal all content
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        });
        
        debugLog('chat', 'Scroll to bottom triggered:', {
          scrollHeight: container.scrollHeight,
          clientHeight: container.clientHeight,
          scrollTop: container.scrollTop,
          inputPanelHeight: inputPanelHeight
        });
      };
      
      // Immediate scroll for fast response
      scrollToBottom();
      
      // Additional scroll after content and spacer render
      setTimeout(scrollToBottom, 200);
    }
  }, [messages, inputPanelHeight]);

  // Simplified scroll management - remove keyboard-dependent logic
  // (No longer needed with sticky layout)

  // Declare mutation states first to avoid TDZ errors
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      // Get userId from webview parameters or scenario context
      const urlParams = new URLSearchParams(window.location.search);
      const userId = urlParams.get('user_id') || scenario?.webviewParams?.userId || 'test-web-user';
      
      // apiRequest already returns parsed JSON and handles errors
      const data = await apiRequest("POST", "/api/chat/message", {
        message,
        prompt: scenario?.prompt || "",
        sessionId: sessionId, // Will be null for first message, backend handles auto-creation
        scenario: scenario?.title || "Unknown",
        userId: userId,
        entryPoint: scenario?.entryPoint || null,
        webviewParams: scenario?.webviewParams || null
      });
      
      return data;
    },
    onSuccess: (data) => {
      setLastFailedMessage(null); // Clear failed message on success
      setErrorDetails(null); // Clear error details
      
      // Update session ID from response and persist it
      if (data.sessionId) {
        setSessionId(data.sessionId);
        try {
          sessionStorage.setItem('chatSessionId', data.sessionId);
        } catch (error) {
          debugLog('chat', 'Could not save session ID to sessionStorage:', error);
          // Continue without session storage - session ID will be maintained in memory
        }
      }
      
      // Clear any existing suggestions and hide them
      setDynamicSuggestions([]);
      setShowSuggestions(false);
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
        suggestionTimeoutRef.current = null;
      }
      
      // Show typing indicator before assistant response
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: data.response,
            timestamp: new Date(),
            id: `msg_${Date.now()}_response`
          }
        ]);
        
        // Start suggestion timer after new message
        startSuggestionTimer();
      }, 500);
    },
    onError: (error: any) => {
      setLastFailedMessage(inputValue); // Store the failed message for retry
      setErrorDetails(error);
      
      debugLog('chat', "Chat message error:", error);
      const isRetryable = error.retryable !== false;
      
      if (error.status === 503 || error.status === 502) {
        toast({
          variant: "destructive", 
          title: "AI service temporarily unavailable",
          description: "Redirecting to lessons page in 3 seconds..."
        });
        setTimeout(() => {
          setLocation('/');
        }, 3000);
      } else if (isRetryable) {
        toast({
          variant: "destructive",
          title: "Message failed to send",
          description: error.message || "Please try again."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Unable to send message",
          description: "Please check your connection and try again."
        });
      }
    }
  });

  // Auto-scroll when typing indicator appears/disappears
  useEffect(() => {
    if (chatContainerRef.current && (isTyping || sendMessageMutation.isPending)) {
      const container = chatContainerRef.current;
      
      setTimeout(() => {
        const lastMessage = container.lastElementChild;
        if (lastMessage) {
          lastMessage.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'end',
            inline: 'nearest'
          });
        }
      }, 100);
    }
  }, [isTyping, sendMessageMutation.isPending]);



  // Monitor messages and start suggestion timer for new assistant messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !isTyping && showInputPanel) {
        // For the initial greeting sequence, use contextual suggestions
        if (messages.length <= 3) {
          setTimeout(() => {
            // Check the actual content of the last message for better suggestions
            const content = lastMessage.content.toLowerCase();
            let initialSuggestions: string[] = [];
            
            if (content.includes('ready')) {
              initialSuggestions = ['Yes ready', 'Tell more', 'Lets go'];
            } else if (content.includes('great to have you') || content.includes('hi')) {
              initialSuggestions = ['Hello', 'Nice meeting'];
            } else {
              // Smart extraction even for initial messages
              const extracted = extractSuggestions(lastMessage.content);
              initialSuggestions = extracted.length > 0 ? extracted : ['Yes', 'Lets start', 'Im ready'];
            }
            
            if (initialSuggestions.length > 0) {
              setDynamicSuggestions(initialSuggestions);
              setShowSuggestions(true);

            }
          }, 1500);
        } else {
          // For all other messages, use smart extraction
          startSuggestionTimer();
        }
      }
    }
  }, [messages, isTyping, showInputPanel, startSuggestionTimer]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !scenario) return;

    // Hide suggestions on user interaction
    hideOnUserInteraction();

    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue,
      timestamp: new Date(),
      id: `msg_${Date.now()}_user`
    };

    setMessages(prev => [...prev, userMessage]);
    setLastFailedMessage(inputValue); // Store for potential retry
    
    const messageContent = inputValue;
    setInputValue("");

    sendMessageMutation.mutate(messageContent);
  };

  const handleRetryMessage = () => {
    if (lastFailedMessage) {
      sendMessageMutation.mutate(lastFailedMessage);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFeedback = (type: "positive" | "negative") => {
    toast({
      title: "Thank you!",
      description: `Your ${type} feedback has been recorded.`,
    });
  };

  const handleChangeScenario = () => {
    setLocation("/ai-tutor");
  };

  const handleCloseChat = () => {
    setLocation("/chat/feedback");
  };

  if (!scenario) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="px-4 py-6">
          <p className="text-center text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="mobile-container" 
      style={{ 
        backgroundColor: '#FDFFFB',
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh'
      }}
    >
      {/* Header - Sticky at top */}
      <div 
        className="px-4 py-4 flex-shrink-0"
        style={{ 
          backgroundColor: '#FDFFFB',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Avatar */}
            <img 
              src={mrSmartImage} 
              alt="Mr. Smart"
              className="w-12 h-12 rounded-full mr-3 object-cover"
            />
            <div>
              <h2 className="font-semibold text-base" style={{ color: '#1B1B1B' }}>Mr. Smart</h2>
              <p className="text-sm text-gray-600">Communication tutor</p>
            </div>
          </div>
          
          <Button
            onClick={handleCloseChat}
            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            Change topic
          </Button>
        </div>
      </div>


      {/* Chat Messages - Scrollable area with dynamic bottom padding */}
      <div 
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          paddingBottom: showInputPanel ? `${inputPanelHeight}px` : '16px', 
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none'
        }}
      >
        <div className="space-y-3">
          {messages.map((message, index) => (
            <div key={index} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}>
                {message.role === "assistant" ? (
                  <MarkdownRenderer content={message.content} />
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
            </div>
          ))}
          
          {(sendMessageMutation.isPending || isTyping) && (
            <div className="flex justify-start">
              <div className="chat-bubble-ai">
                <TypingIndicator />
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom spacer element - guarantees scroll space */}
        {showInputPanel && (
          <div 
            style={{ 
              height: `${inputPanelHeight}px`,
              flexShrink: 0,
              pointerEvents: 'none'
            }} 
            aria-hidden="true"
          />
        )}
      </div>

      {/* Chat Input - Fixed to bottom with keyboard awareness */}
      {showInputPanel && (
        <div 
          style={{
            position: 'fixed',
            bottom: keyboardHeight > 0 ? `${keyboardHeight}px` : '0px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '432px',
            padding: '16px',
            backgroundColor: 'white',
            borderTop: '1px solid #e5e7eb',
            zIndex: 999,
            boxSizing: 'border-box',
            paddingBottom: keyboardHeight > 0 ? '16px' : 'calc(16px + env(safe-area-inset-bottom, 0px))',
            willChange: 'transform',
            WebkitTransform: 'translateX(-50%) translateZ(0)',
            transition: 'bottom 0.2s ease-out'
          }}
        >
        {/* Dynamic Suggestion Bubbles */}
        {showSuggestions && dynamicSuggestions.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide mb-1.5 pb-1">
            <div className="flex gap-2 min-w-max px-1">
              {dynamicSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    hideOnUserInteraction();
                    const userMessage = {
                      role: "user" as const,
                      content: suggestion,
                      timestamp: new Date(),
                      id: `msg_${Date.now()}_user`
                    };
                    setMessages(prev => [...prev, userMessage]);
                    sendMessageMutation.mutate(suggestion);
                  }}
                  className="suggestion-button"
                  disabled={sendMessageMutation.isPending}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Retry Button - Show when message failed and retryable */}
        {errorDetails && errorDetails.retryable && lastFailedMessage && (
          <div className="mb-4">
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-orange-800 mb-2">
                      {errorDetails.message || "Message failed to send"}
                    </p>
                    <p className="text-xs text-orange-600">
                      Last message: "{lastFailedMessage}"
                    </p>
                  </div>
                  <Button
                    onClick={handleRetryMessage}
                    disabled={sendMessageMutation.isPending}
                    variant="outline"
                    size="sm"
                    className="ml-3 border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    {sendMessageMutation.isPending ? "Retrying..." : "Retry"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex items-center space-x-2">
          {/* Voice Input Button */}
              <Button
                onClick={async () => {
                  debugLog('voice', '[Chat] Microphone button clicked:', { isListening: voice.isListening, isSupported: voice.isSupported });
                  
                  if (!voice.isSupported) {
                    const message = voice.deviceInfo 
                      ? `Voice input is not available on ${voice.deviceInfo.browser} for ${voice.deviceInfo.operatingSystem}. ${voice.deviceInfo.alternatives[0] || 'Please try a different browser.'}`
                      : "Speech recognition is not supported in this browser environment. Try using Chrome, Edge, or Safari on the deployed version of the app.";
                    
                    toast({
                      title: "Voice Input Not Available",
                      description: message,
                      variant: "destructive"
                    });
                    return;
                  }
                    
                  if (voice.isListening) {
                    debugLog('voice', '[Chat] Stopping voice input...');
                    voice.stopListening();
                  } else {
                    debugLog('voice', '[Chat] Starting voice input...');
                    
                    // Don't request microphone permission separately in WebView to avoid crashes
                    // The speech recognition API will handle it
                    
                    // Start listening with error handling
                    try {
                      await voice.startListening();
                      debugLog('voice', '[Chat] Voice input started successfully');
                    } catch (err) {
                      debugLog('voice', '[Chat] Failed to start voice input:', err);
                      // More graceful handling for WebView permission errors
                      const errorStr = String(err);
                      if (!voice.isWebView || (!errorStr.includes('permission') && !errorStr.includes('not-allowed'))) {
                        toast({
                          title: "Voice Input Error",
                          description: voice.isWebView 
                            ? "Please ensure microphone permissions are enabled in your app settings."
                            : "Could not start voice input. Please check microphone permissions.",
                          variant: "destructive"
                        });
                      }
                    }
                  }
                }}
                className={`rounded-xl transition-all ${
                !voice.isSupported
                  ? 'bg-gray-300 hover:bg-gray-400 cursor-not-allowed'
                  : voice.deviceInfo?.browserSupport === 'partial'
                    ? voice.isListening 
                      ? 'bg-yellow-500 hover:bg-yellow-600 mic-recording' 
                      : 'bg-yellow-100 hover:bg-yellow-200 border border-yellow-300'
                    : voice.isListening 
                      ? 'bg-red-500 hover:bg-red-600 mic-recording' 
                      : 'bg-gray-100 hover:bg-gray-200'
              }`}
              style={{ 
                width: '56px', 
                height: '56px', 
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !voice.isSupported ? 0.6 : 1
              }}
              disabled={sendMessageMutation.isPending}
              type="button"
              title={!voice.isSupported ? 'Voice input not available in this environment' : 'Voice input'}
            >
              {voice.isListening ? (
                <MicOff 
                  className="h-5 w-5" 
                  style={{ color: '#FFFFFF' }}
                />
              ) : (
                <Mic 
                  className="h-5 w-5" 
                  style={{ color: !voice.isSupported ? '#6B7280' : '#1B1B1B' }}
                />
              )}
            </Button>
          
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              id="chat-message-input"
              name="message"
              type="text"
              placeholder={voice.isListening ? "Listening..." : "Type something"}
              value={inputValue + (voice.isListening && voice.interimTranscript ? ' ' + voice.interimTranscript : '')}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Hide suggestions when user starts typing
                if (e.target.value.length > 0) {
                  hideOnUserInteraction();
                }
              }}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                // Scroll to bottom when input is focused to show latest content
                setTimeout(() => {
                  if (chatContainerRef.current) {
                    const container = chatContainerRef.current;
                    container.scrollTo({
                      top: container.scrollHeight,
                      behavior: 'smooth'
                    });
                    debugLog('chat', 'Input focus scroll:', { 
                      scrollHeight: container.scrollHeight,
                      inputPanelHeight: inputPanelHeight 
                    });
                  }
                }, 300); // Longer delay for keyboard animation
              }}
              className={`w-full px-4 bg-gray-100 rounded-2xl border-2 transition-all ${
                voice.isListening 
                  ? 'border-red-400 bg-red-50' 
                  : 'border-transparent focus:border-primary'
              }`}
              style={{ height: '56px' }}
              disabled={sendMessageMutation.isPending || voice.isListening}
              autoComplete="off"
              inputMode="text"
              enterKeyHint="send"
              aria-label="Chat message input"
            />
            {/* Voice recording indicator */}
            {voice.isListening && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="flex space-x-1">
                  <span className="block w-1 h-4 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="block w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></span>
                  <span className="block w-1 h-4 bg-red-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            )}
          </div>
          
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || sendMessageMutation.isPending}
            className="bg-primary rounded-xl hover:bg-primary/90"
            style={{ 
              width: '56px', 
              height: '56px', 
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowRight 
              className="h-5 w-5" 
              style={{ 
                color: !inputValue.trim() || sendMessageMutation.isPending ? 'rgba(27, 27, 27, 0.3)' : '#1B1B1B'
              }}
            />
          </Button>
        </div>
        </div>
      )}
    </div>
  );
}
