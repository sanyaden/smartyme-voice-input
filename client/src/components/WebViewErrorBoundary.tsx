import React, { Component, ErrorInfo, ReactNode } from 'react';
import { flutterBridge } from '../lib/flutter-bridge';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  isOffline: boolean;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export class WebViewErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      retryCount: 0,
      isOffline: !navigator.onLine
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[WebView] Error caught by boundary:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Send error to Flutter
    if (flutterBridge.isWebView) {
      flutterBridge.sendToFlutter('error', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        retryCount: this.state.retryCount,
        userAgent: navigator.userAgent,
        url: window.location.href
      }).catch(bridgeError => {
        console.warn('[WebView] Failed to send error to Flutter:', bridgeError);
      });
    }

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Track analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: false,
        custom_map: {
          component_stack: errorInfo.componentStack
        }
      });
    }
  }

  componentDidMount() {
    // Listen for online/offline events
    const handleOnline = () => this.setState({ isOffline: false });
    const handleOffline = () => this.setState({ isOffline: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for Flutter recovery messages
    if (flutterBridge.isWebView) {
      const unsubscribe = flutterBridge.onFlutterMessage('recovery', (data) => {
        if (data.action === 'retry') {
          this.handleRetry();
        } else if (data.action === 'reset') {
          this.handleReset();
        }
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        unsubscribe();
      };
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    if (retryCount >= 3) {
      // Too many retries, suggest app restart
      if (flutterBridge.isWebView) {
        flutterBridge.sendToFlutter('suggestion', {
          type: 'restart_app',
          message: 'Multiple errors occurred. Please restart the app.'
        });
      }
      return;
    }

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: retryCount + 1
    });

    // Send retry event to Flutter
    if (flutterBridge.isWebView) {
      flutterBridge.sendToFlutter('retry', {
        attempt: retryCount + 1,
        timestamp: new Date().toISOString()
      });
    }
  };

  handleReset = () => {
    // Clear all state and reload
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      isOffline: !navigator.onLine
    });

    // Clear session storage except essential params
    try {
      const webviewParams = sessionStorage.getItem('webview_params');
      sessionStorage.clear();
      if (webviewParams) {
        sessionStorage.setItem('webview_params', webviewParams);
      }
    } catch (e) {
      console.warn('Failed to clear session storage:', e);
    }

    // Reload page
    window.location.reload();
  };

  handleCloseWebView = () => {
    if (flutterBridge.isWebView) {
      flutterBridge.closeWebView();
    } else {
      window.close();
    }
  };

  renderNetworkError() {
    return (
      <div className="error-container network-error">
        <div className="error-icon">📡</div>
        <h2>No Internet Connection</h2>
        <p>Please check your connection and try again.</p>
        <div className="error-actions">
          <button 
            onClick={this.handleRetry}
            className="retry-button primary"
          >
            Retry
          </button>
          <button 
            onClick={this.handleCloseWebView}
            className="close-button secondary"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  renderGenericError() {
    const { error, retryCount } = this.state;
    const canRetry = retryCount < 3;

    return (
      <div className="error-container generic-error">
        <div className="error-icon">⚠️</div>
        <h2>Something went wrong</h2>
        <p>
          {error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        
        {process.env.NODE_ENV === 'development' && error && (
          <details className="error-details">
            <summary>Error Details</summary>
            <pre>{error.stack}</pre>
          </details>
        )}

        <div className="error-actions">
          {canRetry ? (
            <button 
              onClick={this.handleRetry}
              className="retry-button primary"
            >
              Try Again ({3 - retryCount} attempts left)
            </button>
          ) : (
            <button 
              onClick={this.handleReset}
              className="reset-button primary"
            >
              Reset App
            </button>
          )}
          
          <button 
            onClick={this.handleCloseWebView}
            className="close-button secondary"
          >
            Close
          </button>
        </div>

        {retryCount > 0 && (
          <div className="retry-info">
            <small>Retry attempts: {retryCount}/3</small>
          </div>
        )}
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Network error
      if (this.state.isOffline) {
        return this.renderNetworkError();
      }

      // Generic error
      return this.renderGenericError();
    }

    return this.props.children;
  }
}

// Styled components styles
const errorBoundaryStyles = `
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  text-align: center;
  background: #f8f9fa;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.error-container h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #dc3545;
}

.error-container p {
  font-size: 16px;
  color: #6c757d;
  margin-bottom: 30px;
  max-width: 400px;
  line-height: 1.5;
}

.error-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 300px;
}

.error-actions button {
  padding: 14px 20px;
  border-radius: 8px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  min-height: 48px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.retry-button.primary,
.reset-button.primary {
  background: #007AFF;
  color: white;
}

.close-button.secondary {
  background: #f1f3f4;
  color: #495057;
  border: 1px solid #e9ecef;
}

.error-actions button:active {
  transform: scale(0.98);
  opacity: 0.8;
}

.error-details {
  margin: 20px 0;
  text-align: left;
  max-width: 600px;
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
}

.error-details summary {
  cursor: pointer;
  font-weight: 600;
  margin-bottom: 12px;
  color: #495057;
}

.error-details pre {
  font-size: 12px;
  color: #dc3545;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  background: #f8f9fa;
  padding: 12px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.retry-info {
  margin-top: 16px;
  color: #6c757d;
  font-size: 14px;
}

.network-error {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.network-error h2,
.network-error p {
  color: white;
}

.network-error .close-button.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

@media (prefers-color-scheme: dark) {
  .error-container {
    background: #1a1a1a;
    color: #ffffff;
  }
  
  .error-container h2 {
    color: #ff6b6b;
  }
  
  .error-container p {
    color: #a0a0a0;
  }
  
  .close-button.secondary {
    background: #2c2c2e;
    color: #ffffff;
    border-color: #38383a;
  }
  
  .error-details {
    background: #2c2c2e;
    border-color: #38383a;
    color: #ffffff;
  }
  
  .error-details pre {
    background: #1a1a1a;
    border-color: #38383a;
    color: #ff6b6b;
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = errorBoundaryStyles;
  document.head.appendChild(styleElement);
}