import { AlertTriangle, Info, Smartphone, Monitor, Mic, MicOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeviceCompatibilityInfo } from "@/hooks/useSpeechRecognition";

interface VoiceCompatibilityFallbackProps {
  deviceInfo: DeviceCompatibilityInfo;
  onDismiss?: () => void;
  showCompact?: boolean;
}

export function VoiceCompatibilityFallback({ 
  deviceInfo, 
  onDismiss,
  showCompact = false 
}: VoiceCompatibilityFallbackProps) {
  const getCompatibilityIcon = () => {
    switch (deviceInfo.browserSupport) {
      case 'full':
        return <Mic className="h-5 w-5 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'none':
        return <MicOff className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };

  const getCompatibilityColor = () => {
    switch (deviceInfo.browserSupport) {
      case 'full':
        return 'border-green-200 bg-green-50';
      case 'partial':
        return 'border-yellow-200 bg-yellow-50';
      case 'none':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getDeviceIcon = () => {
    switch (deviceInfo.deviceType) {
      case 'mobile':
      case 'tablet':
        return <Smartphone className="h-4 w-4" />;
      case 'desktop':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getCompatibilityTitle = () => {
    switch (deviceInfo.browserSupport) {
      case 'full':
        return 'Voice Input Available';
      case 'partial':
        return 'Limited Voice Input Support';
      case 'none':
        return 'Voice Input Not Available';
      default:
        return 'Voice Input Status Unknown';
    }
  };

  const getCompatibilityMessage = () => {
    if (deviceInfo.browserSupport === 'full') {
      return `Voice input works great on ${deviceInfo.browser} for ${deviceInfo.operatingSystem}. Click the microphone to start speaking.`;
    }
    
    if (deviceInfo.browserSupport === 'partial') {
      return `Voice input has limited support on ${deviceInfo.browser} for ${deviceInfo.operatingSystem}. You can try it, but consider alternatives below.`;
    }
    
    return `Voice input is not supported on ${deviceInfo.browser} for ${deviceInfo.operatingSystem}. Please use the alternatives below.`;
  };

  if (showCompact) {
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600">
        {getCompatibilityIcon()}
        <span>{getCompatibilityTitle()}</span>
        {getDeviceIcon()}
      </div>
    );
  }

  // Don't show fallback card for full support
  if (deviceInfo.browserSupport === 'full') {
    return null;
  }

  return (
    <Card className={`mb-4 ${getCompatibilityColor()}`}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 mt-0.5">
            {getCompatibilityIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-medium text-sm">{getCompatibilityTitle()}</h3>
              {getDeviceIcon()}
              <span className="text-xs text-gray-500 capitalize">
                {deviceInfo.deviceType} • {deviceInfo.browser} • {deviceInfo.operatingSystem}
              </span>
            </div>
            
            <p className="text-sm text-gray-700 mb-3">
              {getCompatibilityMessage()}
            </p>

            {deviceInfo.limitations.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-600 mb-1">Limitations:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {deviceInfo.limitations.map((limitation, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span className="text-gray-400 mt-0.5">•</span>
                      <span>{limitation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {deviceInfo.alternatives.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-600 mb-1">Alternatives:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                  {deviceInfo.alternatives.map((alternative, index) => (
                    <li key={index} className="flex items-start space-x-1">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span>{alternative}</span>
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