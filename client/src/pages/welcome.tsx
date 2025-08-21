import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/use-page-title";
import mrSmartImage from "@assets/mr-smart.png";

export default function WelcomePage() {
  usePageTitle("Welcome");
  const [, setLocation] = useLocation();

  // Auto-redirect to webview since all users come from mobile integration
  useEffect(() => {
    // Check if we have webview parameters in URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    
    if (userId) {
      // User came from mobile app, redirect to webview
      setLocation('/webview' + window.location.search);
    } else {
      // For development/testing, redirect to webview with test parameters
      setLocation('/webview?user_id=test-web-user&lesson_id=392&course_id=1');
    }
  }, [setLocation]);

  // Show loading message while redirecting
  const handleRedirectMessage = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('user_id');
    
    if (userId) {
      return "Redirecting to practice session...";
    } else {
      return "Redirecting to demo session...";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FDFFFB' }}>
      <div className="text-center">
        <img 
          src={mrSmartImage} 
          alt="Mr. Smart"
          className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
        />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {handleRedirectMessage()}
        </h2>
        <p className="text-gray-600 text-sm">
          Connecting to your AI communication tutor...
        </p>
      </div>
    </div>
  );
}