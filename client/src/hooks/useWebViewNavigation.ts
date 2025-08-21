import { useEffect, useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { useWebView } from '../contexts/WebViewContext';

export interface WebViewNavigationHook {
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => void;
  goForward: () => void;
  preventExit: boolean;
  setPreventExit: (prevent: boolean) => void;
  confirmExit: () => Promise<boolean>;
}

export function useWebViewNavigation(): WebViewNavigationHook {
  const [location] = useLocation();
  // Note: wouter doesn't export useNavigate, we'll use setLocation from useLocation
  const { isWebView, closeWebView, sendAnalytics } = useWebView();
  const [preventExit, setPreventExit] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState<string[]>([]);

  // Track navigation history
  useEffect(() => {
    setNavigationHistory(prev => {
      const newHistory = [...prev];
      if (newHistory[newHistory.length - 1] !== location) {
        newHistory.push(location);
        // Keep only last 10 entries
        if (newHistory.length > 10) {
          newHistory.shift();
        }
      }
      return newHistory;
    });
  }, [location]);

  const canGoBack = navigationHistory.length > 1;
  const canGoForward = false; // Not implemented for SPA

  const goBack = useCallback(() => {
    if (canGoBack) {
      const newHistory = [...navigationHistory];
      newHistory.pop(); // Remove current location
      const previousLocation = newHistory[newHistory.length - 1];
      
      if (previousLocation) {
        setNavigationHistory(newHistory);
        window.history.pushState(null, '', previousLocation);
        
        if (isWebView) {
          sendAnalytics('webview_navigation', {
            action: 'back',
            from: location,
            to: previousLocation
          });
        }
      }
    } else if (isWebView) {
      // No more history, close WebView
      confirmExit().then(shouldClose => {
        if (shouldClose) {
          closeWebView();
        }
      });
    }
  }, [canGoBack, navigationHistory, location, isWebView, closeWebView, sendAnalytics]);

  const goForward = useCallback(() => {
    // Not implemented for SPA
    console.warn('Forward navigation not supported in SPA');
  }, []);

  const confirmExit = useCallback(async (): Promise<boolean> => {
    if (!preventExit) {
      return true;
    }

    return new Promise((resolve) => {
      const confirmed = window.confirm(
        'Are you sure you want to leave? Your progress might not be saved.'
      );
      resolve(confirmed);
    });
  }, [preventExit]);

  // Handle browser back button
  useEffect(() => {
    if (!isWebView) return;

    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      
      if (preventExit) {
        confirmExit().then(shouldExit => {
          if (shouldExit) {
            setPreventExit(false);
            closeWebView();
          } else {
            // Push a new state to prevent actual navigation
            window.history.pushState(null, '', window.location.href);
          }
        });
      } else {
        closeWebView();
      }
    };

    // Prevent back navigation
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isWebView, preventExit, confirmExit, closeWebView]);

  // Handle beforeunload for WebView
  useEffect(() => {
    if (!isWebView) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (preventExit) {
        const message = 'Are you sure you want to leave?';
        event.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isWebView, preventExit]);

  // Handle Android back button through Flutter bridge
  useEffect(() => {
    if (!isWebView) return;

    const handleFlutterBack = () => {
      goBack();
    };

    // This would be set up through Flutter bridge
    const unsubscribe = () => {}; // Placeholder for actual Flutter listener

    return unsubscribe;
  }, [isWebView, goBack]);

  return {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    preventExit,
    setPreventExit,
    confirmExit
  };
}

// Hook for handling WebView-specific route changes
export function useWebViewRouting() {
  const [location] = useLocation();
  const { isWebView, sendAnalytics } = useWebView();

  useEffect(() => {
    if (isWebView) {
      // Track route changes in WebView
      sendAnalytics('webview_route_change', {
        route: location,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    }
  }, [location, isWebView, sendAnalytics]);

  return { location };
}