import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { flutterBridge } from '../lib/flutter-bridge';

export interface WebViewContextType {
  isWebView: boolean;
  userId: string | null;
  lessonId: string | null;
  courseId: string | null;
  authToken: string | null;
  sendToFlutter: (type: string, data: any) => void;
  closeWebView: () => void;
  triggerHaptic: (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void;
  sendAnalytics: (event: string, properties: Record<string, any>) => void;
  requestMicrophone: () => Promise<boolean>;
}

const WebViewContext = createContext<WebViewContextType | undefined>(undefined);

interface WebViewProviderProps {
  children: ReactNode;
}

export function WebViewProvider({ children }: WebViewProviderProps) {
  const [isWebView, setIsWebView] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    // Detect WebView environment
    setIsWebView(flutterBridge.isWebView);

    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const userIdParam = urlParams.get('user_id');
    const lessonIdParam = urlParams.get('lesson_id');
    const courseIdParam = urlParams.get('course_id');
    const tokenParam = urlParams.get('token');

    setUserId(userIdParam);
    setLessonId(lessonIdParam);
    setCourseId(courseIdParam);

    // Handle auth token from URL
    if (tokenParam) {
      setAuthToken(tokenParam);
      // Store in sessionStorage for persistence
      sessionStorage.setItem('authToken', tokenParam);
    } else {
      // Try to get from sessionStorage
      const storedToken = sessionStorage.getItem('authToken');
      if (storedToken) {
        setAuthToken(storedToken);
      }
    }

    // Setup Flutter message listeners
    const unsubscribeAuth = flutterBridge.onFlutterMessage('auth', (data) => {
      if (data.token) {
        setAuthToken(data.token);
        sessionStorage.setItem('authToken', data.token);
      }
    });

    const unsubscribeNavigation = flutterBridge.onFlutterMessage('navigation', (data) => {
      if (data.action === 'back') {
        handleBackNavigation();
      }
    });

    // Listen for auth updates
    const handleAuthUpdate = (event: CustomEvent) => {
      setAuthToken(event.detail.token);
    };

    window.addEventListener('flutterAuthUpdate', handleAuthUpdate as EventListener);

    // Apply WebView-specific styles and behaviors
    let gestureHandler: ((e: Event) => void) | undefined;
    
    if (flutterBridge.isWebView) {
      document.body.classList.add('webview-mode');
      
      // Disable pinch zoom
      gestureHandler = (e: Event) => e.preventDefault();
      document.addEventListener('gesturestart', gestureHandler);
      document.addEventListener('gesturechange', gestureHandler);
      document.addEventListener('gestureend', gestureHandler);

      // Update viewport for WebView
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );
      }

      // Send analytics about WebView session
      flutterBridge.sendAnalytics('webview_session_start', {
        userId: userIdParam,
        lessonId: lessonIdParam,
        courseId: courseIdParam,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      });
    }

    // Cleanup
    return () => {
      unsubscribeAuth();
      unsubscribeNavigation();
      window.removeEventListener('flutterAuthUpdate', handleAuthUpdate as EventListener);
      
      if (flutterBridge.isWebView) {
        document.body.classList.remove('webview-mode');
        if (gestureHandler) {
          document.removeEventListener('gesturestart', gestureHandler);
          document.removeEventListener('gesturechange', gestureHandler);
          document.removeEventListener('gestureend', gestureHandler);
        }
      }
    };
  }, []);

  const handleBackNavigation = () => {
    // Handle back button navigation for WebView
    if (window.history.length > 1) {
      window.history.back();
    } else {
      flutterBridge.closeWebView();
    }
  };

  // Persist WebView parameters in sessionStorage
  useEffect(() => {
    if (userId || lessonId || courseId) {
      const webViewParams = { userId, lessonId, courseId };
      sessionStorage.setItem('webview_params', JSON.stringify(webViewParams));
    }
  }, [userId, lessonId, courseId]);

  const contextValue: WebViewContextType = {
    isWebView,
    userId,
    lessonId,
    courseId,
    authToken,
    sendToFlutter: (type: string, data: any) => {
      flutterBridge.sendToFlutter(type, data);
    },
    closeWebView: () => {
      flutterBridge.closeWebView();
    },
    triggerHaptic: (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
      flutterBridge.triggerHaptic(type);
    },
    sendAnalytics: (event: string, properties: Record<string, any>) => {
      flutterBridge.sendAnalytics(event, properties);
    },
    requestMicrophone: () => {
      return flutterBridge.requestMicrophone();
    }
  };

  return (
    <WebViewContext.Provider value={contextValue}>
      {children}
    </WebViewContext.Provider>
  );
}

export function useWebView(): WebViewContextType {
  const context = useContext(WebViewContext);
  if (context === undefined) {
    throw new Error('useWebView must be used within a WebViewProvider');
  }
  return context;
}

// Helper function to get WebView parameters from storage
export function getWebViewParams(): { userId?: string; lessonId?: string; courseId?: string } {
  try {
    const stored = sessionStorage.getItem('webview_params');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}