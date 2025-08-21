// Flutter WebView Bridge for bidirectional communication
// Handles voice input and other Flutter-JavaScript interactions

import { debugLog } from './debug';

export interface FlutterMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

export interface VoiceInputMessage {
  action: 'start' | 'stop' | 'result' | 'error' | 'status';
  transcript?: string;
  isFinal?: boolean;
  error?: string;
  isListening?: boolean;
}

declare global {
  interface Window {
    // Flutter InAppWebView handlers
    flutter_inappwebview?: {
      callHandler: (handlerName: string, ...args: any[]) => Promise<any>;
    };
    // Standard WebView handlers
    FlutterChannel?: {
      postMessage: (message: string) => void;
    };
    // iOS WKWebView handlers
    webkit?: {
      messageHandlers?: {
        [key: string]: {
          postMessage: (message: any) => void;
        };
      };
    };
  }
}

class FlutterBridge {
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private isWebViewCache: boolean | null = null;
  private voiceInputAvailable: boolean = false;

  constructor() {
    this.setupMessageListener();
    this.detectWebViewEnvironment();
  }

  // Detect if running in a WebView environment
  private detectWebViewEnvironment(): void {
    // Check for various WebView indicators
    const hasFlutterInAppWebView = typeof window.flutter_inappwebview !== 'undefined';
    const hasFlutterChannel = typeof window.FlutterChannel !== 'undefined';
    const hasWebKit = typeof window.webkit?.messageHandlers !== 'undefined';
    
    // Check user agent for WebView indicators
    const userAgent = navigator.userAgent.toLowerCase();
    const isWebViewUA = userAgent.includes('webview') || 
                        userAgent.includes('flutter') ||
                        userAgent.includes('wv');
    
    this.isWebViewCache = hasFlutterInAppWebView || hasFlutterChannel || hasWebKit || isWebViewUA;
    
    debugLog('flutter', '[FlutterBridge] WebView detection:', {
      hasFlutterInAppWebView,
      hasFlutterChannel,
      hasWebKit,
      isWebViewUA,
      isWebView: this.isWebViewCache
    });

    // Check for voice input capability
    if (this.isWebViewCache) {
      this.checkVoiceInputCapability();
    }
  }

  // Check if Flutter supports voice input
  private async checkVoiceInputCapability(): Promise<void> {
    try {
      const response = await this.sendToFlutter('check_voice_capability', {});
      this.voiceInputAvailable = response?.available === true;
      debugLog('flutter', '[FlutterBridge] Voice input available:', this.voiceInputAvailable);
    } catch (error) {
      debugLog('flutter', '[FlutterBridge] Voice input check failed, assuming unavailable');
      this.voiceInputAvailable = false;
    }
  }

  // Setup listener for messages from Flutter
  private setupMessageListener(): void {
    // Listen for Flutter InAppWebView messages
    if (window.flutter_inappwebview) {
      // InAppWebView uses promises for communication
      debugLog('flutter', '[FlutterBridge] Flutter InAppWebView detected');
    }

    // Listen for standard postMessage events
    window.addEventListener('message', (event) => {
      try {
        let message: FlutterMessage;
        
        if (typeof event.data === 'string') {
          message = JSON.parse(event.data);
        } else {
          message = event.data;
        }

        if (message && message.type) {
          this.handleFlutterMessage(message);
        }
      } catch (error) {
        debugLog('flutter', '[FlutterBridge] Error parsing message:', error);
      }
    });

    // Setup Flutter JavaScript channel listener
    (window as any).handleFlutterMessage = (messageStr: string) => {
      try {
        const message = JSON.parse(messageStr);
        this.handleFlutterMessage(message);
      } catch (error) {
        debugLog('flutter', '[FlutterBridge] Error handling Flutter message:', error);
      }
    };
  }

  // Handle incoming messages from Flutter
  private handleFlutterMessage(message: FlutterMessage): void {
    debugLog('flutter', '[FlutterBridge] Received message:', message);
    
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.payload);
        } catch (error) {
          debugLog('flutter', '[FlutterBridge] Error in message handler:', error);
        }
      });
    }
  }

  // Send message to Flutter
  public async sendToFlutter(type: string, payload: any): Promise<any> {
    const message: FlutterMessage = {
      type,
      payload,
      timestamp: Date.now()
    };

    debugLog('flutter', '[FlutterBridge] Sending to Flutter:', message);

    // Try Flutter InAppWebView handler first (most common)
    if (window.flutter_inappwebview?.callHandler) {
      try {
        const response = await window.flutter_inappwebview.callHandler(type, payload);
        debugLog('flutter', '[FlutterBridge] InAppWebView response:', response);
        return response;
      } catch (error) {
        debugLog('flutter', '[FlutterBridge] InAppWebView handler error:', error);
      }
    }

    // Try standard Flutter channel
    if (window.FlutterChannel?.postMessage) {
      try {
        window.FlutterChannel.postMessage(JSON.stringify(message));
        return Promise.resolve();
      } catch (error) {
        debugLog('flutter', '[FlutterBridge] FlutterChannel error:', error);
      }
    }

    // Try iOS WKWebView message handlers
    if (window.webkit?.messageHandlers?.flutterChannel) {
      try {
        window.webkit.messageHandlers.flutterChannel.postMessage(message);
        return Promise.resolve();
      } catch (error) {
        debugLog('flutter', '[FlutterBridge] WKWebView handler error:', error);
      }
    }

    // Fallback to postMessage
    try {
      window.parent.postMessage(message, '*');
      return Promise.resolve();
    } catch (error) {
      debugLog('flutter', '[FlutterBridge] PostMessage error:', error);
      throw new Error('No Flutter communication channel available');
    }
  }

  // Register a message handler
  public onFlutterMessage(type: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(type);
        }
      }
    };
  }

  // Voice input specific methods
  public async startVoiceInput(): Promise<void> {
    if (!this.voiceInputAvailable) {
      throw new Error('Voice input not available in Flutter WebView');
    }
    
    return this.sendToFlutter('voice_input', {
      action: 'start'
    } as VoiceInputMessage);
  }

  public async stopVoiceInput(): Promise<void> {
    return this.sendToFlutter('voice_input', {
      action: 'stop'
    } as VoiceInputMessage);
  }

  public onVoiceInputResult(handler: (transcript: string, isFinal: boolean) => void): () => void {
    return this.onFlutterMessage('voice_input_result', (data: VoiceInputMessage) => {
      if (data.transcript) {
        handler(data.transcript, data.isFinal || false);
      }
    });
  }

  public onVoiceInputError(handler: (error: string) => void): () => void {
    return this.onFlutterMessage('voice_input_error', (data: VoiceInputMessage) => {
      if (data.error) {
        handler(data.error);
      }
    });
  }

  public onVoiceInputStatus(handler: (isListening: boolean) => void): () => void {
    return this.onFlutterMessage('voice_input_status', (data: VoiceInputMessage) => {
      handler(data.isListening || false);
    });
  }

  // Additional methods for WebView functionality
  public async closeWebView(): Promise<void> {
    return this.sendToFlutter('close_webview', {});
  }

  public async triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light'): Promise<void> {
    return this.sendToFlutter('haptic_feedback', { type });
  }

  public async sendAnalytics(event: string, properties?: any): Promise<void> {
    return this.sendToFlutter('analytics', { event, properties });
  }

  public async requestMicrophone(): Promise<boolean> {
    try {
      const response = await this.sendToFlutter('request_microphone', {});
      return response?.granted === true;
    } catch {
      return false;
    }
  }

  // Getters
  get isWebView(): boolean {
    if (this.isWebViewCache === null) {
      this.detectWebViewEnvironment();
    }
    return this.isWebViewCache || false;
  }

  get canUseVoiceInput(): boolean {
    return this.isWebView && this.voiceInputAvailable;
  }
}

// Export singleton instance
export const flutterBridge = new FlutterBridge();