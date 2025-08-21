import { AlertTriangle, Info, Smartphone, Monitor, Mic, MicOff, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeviceCompatibilityInfo } from "@/hooks/useSpeechRecognition";

interface WebViewVoiceCompatibilityProps {
  deviceInfo: DeviceCompatibilityInfo | null;
  inputMethod: 'flutter' | 'browser' | 'none';
  isWebView: boolean;
  onDismiss?: () => void;
  showCompact?: boolean;
}

export function WebViewVoiceCompatibility({ 
  deviceInfo, 
  inputMethod,
  isWebView,
  onDismiss,
  showCompact = false 
}: WebViewVoiceCompatibilityProps) {
  
  const getMethodIcon = () => {
    switch (inputMethod) {
      case 'flutter':
        return <Mic className="h-5 w-5 text-green-500" />;
      case 'browser':
        return deviceInfo?.browserSupport === 'full' 
          ? <Mic className="h-5 w-5 text-green-500" />
          : <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'none':
        return <MicOff className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getMethodColor = () => {
    switch (inputMethod) {
      case 'flutter':
        return 'border-green-200 bg-green-50';
      case 'browser':
        return deviceInfo?.browserSupport === 'full'
          ? 'border-green-200 bg-green-50'
          : 'border-yellow-200 bg-yellow-50';
      case 'none':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getMethodTitle = () => {
    if (isWebView && inputMethod === 'flutter') {
      return 'Native Voice Input Active';
    }
    
    switch (inputMethod) {
      case 'flutter':
        return 'App Voice Input Available';
      case 'browser':
        return deviceInfo?.browserSupport === 'full'
          ? 'Browser Voice Input Available'
          : 'Limited Voice Input Support';
      case 'none':
        return 'Voice Input Not Available';
      default:
        return 'Voice Input Status Unknown';
    }
  };

  const getMethodMessage = () => {
    if (isWebView) {
      if (inputMethod === 'flutter') {
        return 'Using your app\'s native voice recognition for the best experience. Tap the microphone to start speaking.';
      } else if (inputMethod === 'browser') {
        return `Using browser-based voice input as a fallback. ${deviceInfo?.browserSupport === 'partial' ? 'Some limitations may apply.' : 'Tap the microphone to start.'}`;
      } else {
        return 'Voice input is not available. Please type your message using the keyboard.';
      }
    } else {
      if (inputMethod === 'browser' && deviceInfo) {
        if (deviceInfo.browserSupport === 'full') {
          return `Voice input works great on ${deviceInfo.browser}. Click the microphone to start speaking.`;
        } else if (deviceInfo.browserSupport === 'partial') {
          return `Voice input has limited support on ${deviceInfo.browser}. You can try it, but typing may be more reliable.`;
        }
      }
      return 'Voice input is not supported in this environment. Please type your message instead.';
    }
  };

  const getFeatures = () => {
    const features = [];
    
    if (inputMethod === 'flutter') {
      features.push({ icon: <Check className="h-3 w-3" />, text: 'Native speech recognition', type: 'success' });
      features.push({ icon: <Check className="h-3 w-3" />, text: 'Works offline', type: 'success' });
      features.push({ icon: <Check className="h-3 w-3" />, text: 'Multiple language support', type: 'success' });
    } else if (inputMethod === 'browser') {
      if (deviceInfo?.browserSupport === 'full') {
        features.push({ icon: <Check className="h-3 w-3" />, text: 'Browser speech recognition', type: 'success' });
        features.push({ icon: <Check className="h-3 w-3" />, text: 'Real-time transcription', type: 'success' });
      } else if (deviceInfo?.browserSupport === 'partial') {
        features.push({ icon: <AlertTriangle className="h-3 w-3" />, text: 'May stop unexpectedly', type: 'warning' });
        features.push({ icon: <AlertTriangle className="h-3 w-3" />, text: 'Refresh if issues occur', type: 'warning' });
      }
    }
    
    return features;
  };

  if (showCompact) {
    return (
      <div className="flex items-center space-x-2">
        {getMethodIcon()}
        <span className="text-sm text-gray-600">{getMethodTitle()}</span>
        {isWebView && (
          <Badge variant="outline" className="text-xs">
            {inputMethod === 'flutter' ? 'Native' : 'Fallback'}
          </Badge>
        )}
      </div>
    );
  }

  // Don't show card for optimal setups
  if (inputMethod === 'flutter' || (inputMethod === 'browser' && deviceInfo?.browserSupport === 'full')) {
    return null;
  }

  return (
    <Card className={`mb-4 ${getMethodColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getMethodIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-medium text-sm">{getMethodTitle()}</h3>
              {isWebView && (
                <Badge variant={inputMethod === 'flutter' ? 'default' : 'secondary'} className="text-xs">
                  {inputMethod === 'flutter' ? 'Native' : inputMethod === 'browser' ? 'Fallback' : 'Unavailable'}
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-gray-700 mb-3">
              {getMethodMessage()}
            </p>

            {getFeatures().length > 0 && (
              <div className="mb-3">
                <ul className="text-xs space-y-1">
                  {getFeatures().map((feature, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <span className={feature.type === 'success' ? 'text-green-500' : 'text-yellow-500'}>
                        {feature.icon}
                      </span>
                      <span className="text-gray-600">{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inputMethod === 'none' && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-600 mb-1">Alternative Input Methods:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li className="flex items-start space-x-1">
                    <span className="text-green-400 mt-0.5">✓</span>
                    <span>Type your message using the keyboard</span>
                  </li>
                  {deviceInfo?.deviceType === 'mobile' && (
                    <li className="flex items-start space-x-1">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Use your device's voice keyboard if available</span>
                    </li>
                  )}
                  {isWebView && (
                    <li className="flex items-start space-x-1">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>Update your app for better voice support</span>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {deviceInfo && inputMethod === 'browser' && deviceInfo.limitations.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-600 mb-1">Known Limitations:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {deviceInfo.limitations.slice(0, 2).map((limitation, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {onDismiss && (
              <div className="flex justify-end">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={onDismiss}
                  className="text-xs h-7 px-2"
                >
                  Got it
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}