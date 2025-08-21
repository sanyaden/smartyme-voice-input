import { useEffect, useRef, useState, useCallback } from 'react';
import { flutterBridge, FlutterMessage } from '../lib/flutter-bridge';

export interface FlutterBridgeHook {
  isWebView: boolean;
  sendMessage: (type: string, data: any) => Promise<void>;
  isConnected: boolean;
  queueSize: number;
}

export function useFlutterBridge(): FlutterBridgeHook {
  const [isConnected, setIsConnected] = useState(false);
  const [queueSize, setQueueSize] = useState(0);
  const messageQueue = useRef<FlutterMessage[]>([]);

  useEffect(() => {
    // Check connection status
    const checkConnection = async () => {
      try {
        await flutterBridge.sendToFlutter('ping', { timestamp: Date.now() });
        setIsConnected(true);
      } catch (error) {
        setIsConnected(false);
      }
    };

    // Initial connection check
    if (flutterBridge.isWebView) {
      checkConnection();
    }

    // Setup periodic connection check
    const connectionInterval = setInterval(() => {
      if (flutterBridge.isWebView) {
        checkConnection();
      }
    }, 30000); // Check every 30 seconds

    // Listen for Flutter responses
    const unsubscribePong = flutterBridge.onFlutterMessage('pong', () => {
      setIsConnected(true);
    });

    return () => {
      clearInterval(connectionInterval);
      unsubscribePong();
    };
  }, []);

  const sendMessage = useCallback(async (type: string, data: any): Promise<void> => {
    const message: FlutterMessage = {
      type,
      payload: data,
      timestamp: Date.now()
    };

    if (isConnected) {
      try {
        await flutterBridge.sendToFlutter(type, data);
      } catch (error) {
        // Add to queue if sending fails
        messageQueue.current.push(message);
        setQueueSize(messageQueue.current.length);
        throw error;
      }
    } else {
      // Queue message if not connected
      messageQueue.current.push(message);
      setQueueSize(messageQueue.current.length);
    }
  }, [isConnected]);

  // Process queued messages when connection is restored
  useEffect(() => {
    if (isConnected && messageQueue.current.length > 0) {
      const processQueue = async () => {
        const queue = [...messageQueue.current];
        messageQueue.current = [];
        setQueueSize(0);

        for (const message of queue) {
          try {
            await flutterBridge.sendToFlutter(message.type, message.payload);
          } catch (error) {
            console.warn('Failed to process queued message:', message, error);
            // Re-queue failed messages
            messageQueue.current.push(message);
          }
        }
        
        setQueueSize(messageQueue.current.length);
      };

      processQueue();
    }
  }, [isConnected]);

  return {
    isWebView: flutterBridge.isWebView,
    sendMessage,
    isConnected,
    queueSize
  };
}

// Hook for specific Flutter message types
export function useFlutterMessage<T = any>(
  messageType: string,
  handler: (data: T) => void,
  dependencies: any[] = []
) {
  useEffect(() => {
    const unsubscribe = flutterBridge.onFlutterMessage(messageType, handler);
    return unsubscribe;
  }, dependencies);
}

// Hook for Flutter lifecycle events
export function useFlutterLifecycle() {
  const [isVisible, setIsVisible] = useState(true);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Listen for visibility changes
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    // Listen for focus/blur events
    const handleFocus = () => setIsActive(true);
    const handleBlur = () => setIsActive(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Listen for Flutter lifecycle messages
    const unsubscribeResume = flutterBridge.onFlutterMessage('lifecycle_resume', () => {
      setIsVisible(true);
      setIsActive(true);
    });

    const unsubscribePause = flutterBridge.onFlutterMessage('lifecycle_pause', () => {
      setIsVisible(false);
      setIsActive(false);
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      unsubscribeResume();
      unsubscribePause();
    };
  }, []);

  return { isVisible, isActive };
}