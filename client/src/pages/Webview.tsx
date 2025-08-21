import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useWebView } from '../contexts/WebViewContext';
import { useWebViewParams, useWebViewParamsValidation } from '../hooks/useWebViewParams';
import { useWebViewNavigation } from '../hooks/useWebViewNavigation';
import { WebViewErrorBoundary } from '../components/WebViewErrorBoundary.tsx';
import Chat from './chat';
import ChatFeedback from './chat-feedback';
import '../styles/webview.css';

interface WebViewProps {
  children?: React.ReactNode;
}

export default function Webview({ children }: WebViewProps) {
  const [location] = useLocation();
  const { isWebView, sendAnalytics, triggerHaptic } = useWebView();
  const { params, isValid, missingParams } = useWebViewParamsValidation(['userId']);
  const { preventExit, setPreventExit } = useWebViewNavigation();
  const [isPullToRefresh, setIsPullToRefresh] = useState(false);
  const [refreshTriggered, setRefreshTriggered] = useState(false);
  const touchStartY = useRef(0);
  const pullDistance = useRef(0);

  // Detect Flutter WebView user agent
  const isFlutterWebView = /Flutter|InAppWebView|wv/i.test(navigator.userAgent);

  useEffect(() => {
    if (isWebView) {
      // Apply WebView-specific optimizations
      document.body.classList.add('webview-mode');
      
      // Prevent pinch-to-zoom
      const preventZoom = (e: TouchEvent) => {
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      };
      
      const preventDoubleTapZoom = (e: TouchEvent) => {
        const now = Date.now();
        const lastTouch = (window as any).lastTouchTime || 0;
        if (now - lastTouch < 300) {
          e.preventDefault();
        }
        (window as any).lastTouchTime = now;
      };

      document.addEventListener('touchstart', preventZoom, { passive: false });
      document.addEventListener('touchmove', preventZoom, { passive: false });
      document.addEventListener('touchstart', preventDoubleTapZoom, { passive: false });

      // Disable right-click context menu
      const preventContextMenu = (e: Event) => e.preventDefault();
      document.addEventListener('contextmenu', preventContextMenu);

      // Auto-focus management
      const handleFocusManagement = () => {
        // Remove focus from any active elements when scrolling
        if (document.activeElement && document.activeElement !== document.body) {
          (document.activeElement as HTMLElement).blur();
        }
      };

      document.addEventListener('scroll', handleFocusManagement);
      document.addEventListener('touchmove', handleFocusManagement);

      // Send WebView session analytics
      sendAnalytics('webview_page_view', {
        page: location,
        userAgent: navigator.userAgent,
        isFlutterWebView,
        params,
        timestamp: new Date().toISOString()
      });

      return () => {
        document.body.classList.remove('webview-mode');
        document.removeEventListener('touchstart', preventZoom);
        document.removeEventListener('touchmove', preventZoom);
        document.removeEventListener('touchstart', preventDoubleTapZoom);
        document.removeEventListener('contextmenu', preventContextMenu);
        document.removeEventListener('scroll', handleFocusManagement);
        document.removeEventListener('touchmove', handleFocusManagement);
      };
    }
  }, [isWebView, location, sendAnalytics, isFlutterWebView, params]);

  // Pull-to-refresh implementation
  useEffect(() => {
    if (!isWebView) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      pullDistance.current = 0;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;
        
        if (diff > 0) {
          pullDistance.current = Math.min(diff, 120);
          
          if (pullDistance.current > 60 && !isPullToRefresh) {
            setIsPullToRefresh(true);
            triggerHaptic('light');
          }
          
          // Prevent scrolling when pulling
          if (pullDistance.current > 10) {
            e.preventDefault();
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (isPullToRefresh && pullDistance.current > 60) {
        setRefreshTriggered(true);
        triggerHaptic('medium');
        
        // Simulate refresh
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
      
      setIsPullToRefresh(false);
      pullDistance.current = 0;
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isWebView, isPullToRefresh, triggerHaptic]);

  // Route-based content rendering
  const [isChat] = useRoute('/webview/chat');
  const [isFeedback] = useRoute('/webview/feedback');

  if (!isValid) {
    return (
      <WebViewErrorBoundary>
        <div className="webview-error-container">
          <div className="error-content">
            <h2>Missing Parameters</h2>
            <p>This WebView requires additional parameters to function properly.</p>
            <div className="missing-params">
              <h3>Missing:</h3>
              <ul>
                {missingParams.map(param => (
                  <li key={param}>{param}</li>
                ))}
              </ul>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="retry-button"
            >
              Retry
            </button>
          </div>
        </div>
      </WebViewErrorBoundary>
    );
  }

  const renderContent = () => {
    if (isChat) {
      return <Chat />;
    }
    
    if (isFeedback) {
      return <ChatFeedback />;
    }

    // Default WebView content
    return (
      <div className="webview-home">
        <div className="webview-navigation">
          {/* Hide web-specific navigation elements */}
          {!isWebView && (
            <nav className="web-navigation">
              {/* Web-only navigation */}
            </nav>
          )}
        </div>

        <main className="webview-content">
          {children || (
            <div className="welcome-content">
              <h1>Welcome to SmartyMe</h1>
              <p>AI-powered communication skills training</p>
              
              <div className="webview-actions">
                <button 
                  className="action-button primary"
                  onClick={() => {
                    triggerHaptic('light');
                    window.location.href = '/webview/chat';
                  }}
                >
                  Start Practice Session
                </button>
                
                <button 
                  className="action-button secondary"
                  onClick={() => {
                    triggerHaptic('light');
                    sendAnalytics('webview_help_requested', { params });
                  }}
                >
                  Help & Support
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Pull-to-refresh indicator */}
        {isPullToRefresh && (
          <div className="pull-to-refresh">
            {refreshTriggered ? 'Refreshing...' : 'Release to refresh'}
          </div>
        )}
      </div>
    );
  };

  return (
    <WebViewErrorBoundary>
      <div className={`webview-container ${isWebView ? 'native-webview' : ''}`}>
        {renderContent()}
      </div>
    </WebViewErrorBoundary>
  );
}

// WebView-specific styles
const webViewStyles = `
.webview-container {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  position: relative;
}

.webview-container.native-webview {
  /* Hide browser UI elements */
  background: #fff;
}

.webview-error-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
  text-align: center;
}

.error-content {
  max-width: 400px;
  padding: 30px;
  border-radius: 12px;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.missing-params ul {
  list-style: none;
  padding: 0;
}

.missing-params li {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 4px 0;
  color: #856404;
}

.retry-button {
  background: #007AFF;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  margin-top: 20px;
  min-height: 44px;
  cursor: pointer;
}

.webview-home {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.webview-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.welcome-content {
  text-align: center;
  max-width: 400px;
  margin: 0 auto;
  padding-top: 60px;
}

.welcome-content h1 {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #1a1a1a;
}

.welcome-content p {
  font-size: 16px;
  color: #6c757d;
  margin-bottom: 40px;
}

.webview-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.action-button {
  padding: 16px 24px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  min-height: 48px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-button.primary {
  background: #007AFF;
  color: white;
}

.action-button.secondary {
  background: #f1f3f4;
  color: #495057;
  border: 1px solid #e9ecef;
}

.action-button:active {
  transform: scale(0.98);
  opacity: 0.8;
}

.pull-to-refresh {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 20px;
  padding: 8px 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  font-size: 14px;
  color: #6c757d;
}

@media (prefers-color-scheme: dark) {
  .webview-container.native-webview {
    background: #000;
    color: #fff;
  }
  
  .welcome-content h1 {
    color: #fff;
  }
  
  .action-button.secondary {
    background: #2c2c2e;
    color: #fff;
    border-color: #38383a;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = webViewStyles;
  document.head.appendChild(styleElement);
}