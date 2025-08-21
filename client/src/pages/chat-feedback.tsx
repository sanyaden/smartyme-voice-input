import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/use-page-title";
import mrSmartImage from "@assets/mr-smart.png";

export default function ChatFeedbackPage() {
  usePageTitle("Chat Feedback");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [futureConversations, setFutureConversations] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showTextArea, setShowTextArea] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const scrollPositionRef = useRef(0);

  const handleFutureConversationSelect = (value: string) => {
    setFutureConversations(value);
    setShowTextArea(true);
  };

  // Prevent unwanted scrolling when text area is focused
  const handleTextAreaFocus = () => {
    // Store current scroll position
    scrollPositionRef.current = window.scrollY;
    
    // Prevent document body scrolling on mobile
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPositionRef.current}px`;
    document.body.style.width = '100%';
  };

  const handleTextAreaBlur = () => {
    // Restore scrolling
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    
    // Restore scroll position
    window.scrollTo(0, scrollPositionRef.current);
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      // Reset body styles if component unmounts while text area is focused
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, []);

  const saveFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const response = await apiRequest("POST", "/api/feedback", feedbackData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback!",
      });
      sessionStorage.removeItem('currentScenario');
      
      // Check if we're in webview mode and redirect accordingly
      const webviewParams = sessionStorage.getItem('webviewParams');
      if (webviewParams) {
        // Redirect back to webview scenario selection
        const params = JSON.parse(webviewParams);
        setLocation(`/webview?user_id=${params.userId}&lesson_id=${params.lessonId}&course_id=${params.courseId}`);
      } else {
        // Redirect to main app welcome
        setLocation("/");
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (rating === 0) return; // Don't submit if no rating selected
    
    // Get scenario info from session storage
    const storedScenario = sessionStorage.getItem('currentScenario');
    const scenarioData = storedScenario ? JSON.parse(storedScenario) : null;
    
    // Get current session ID from session storage
    const currentSessionId = sessionStorage.getItem('chatSessionId');
    
    const feedbackData = {
      sessionId: currentSessionId || `session_${Date.now()}_fallback`,
      scenarioTitle: scenarioData?.title || "Unknown scenario",
      overallScore: rating,
      futureConversations: futureConversations || null,
      comments: feedback || null
    };

    saveFeedbackMutation.mutate(feedbackData);
  };

  const starLabels = ["Not Great", "Fair", "Okay", "Good", "Awesome"];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#FDFFFB' }}>
      {/* Header - No close button for feedback completion */}
      <div className="px-4 py-4" style={{ backgroundColor: '#FDFFFB' }}>
        {/* Empty header space for consistent layout */}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-4">
        {/* Question 1 - Rating */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
              style={{ backgroundColor: '#81D478', color: '#1B1B1B' }}
            >
              1
            </div>
          </div>
          
          <h2 
            className="text-center mb-8"
            style={{
              color: '#2a2d4b',
              fontFamily: 'Satoshi',
              fontSize: '24px',
              fontStyle: 'normal',
              fontWeight: 700,
              lineHeight: '32px',
              fontVariantNumeric: 'lining-nums proportional-nums'
            }}
          >
            How would you rate this<br />AI coaching experience overall?
          </h2>
          
          <div className="flex justify-center space-x-4 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <div key={star} className="flex flex-col items-center">
                <button
                  onClick={() => setRating(star)}
                  className="text-3xl mb-1 transition-all duration-200"
                >
                  {rating >= star ? '⭐' : (
                    <span style={{ color: '#99A1B0' }}>☆</span>
                  )}
                </button>
                <span 
                  className="text-xs text-center"
                  style={{ 
                    color: rating >= star ? '#1B1B1B' : '#9CA3AF',
                    fontWeight: rating >= star ? 500 : 400
                  }}
                >
                  {starLabels[star - 1]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="flex justify-center mb-8">
          <div 
            className="w-16 h-px"
            style={{ backgroundColor: '#E5E7EB' }}
          />
        </div>

        {/* Question 2 - Future Conversations */}
        <div className="mb-8">
          <div className="flex items-center justify-center mb-6">
            <div 
              className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
              style={{ backgroundColor: '#81D478', color: '#1B1B1B' }}
            >
              2
            </div>
          </div>
          
          <h2 
            className="text-center mb-6"
            style={{
              color: '#2a2d4b',
              fontFamily: 'Satoshi',
              fontSize: '24px',
              fontStyle: 'normal',
              fontWeight: 700,
              lineHeight: '32px',
              fontVariantNumeric: 'lining-nums proportional-nums'
            }}
          >
            Would you like to have more<br />conversations like this in the<br />future?
          </h2>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => handleFutureConversationSelect("no")}
              className="flex-1 flex items-center justify-center px-2 py-3 rounded-full text-xs transition-colors"
              style={{
                backgroundColor: futureConversations === "no" ? '#FFEBEE' : '#F5F5F5',
                border: futureConversations === "no" ? '2px solid #F44336' : '2px solid transparent',
                color: '#1B1B1B',
                fontWeight: 500
              }}
            >
              ❌ Not really
            </button>
            
            <button
              onClick={() => handleFutureConversationSelect("maybe")}
              className="flex-1 flex items-center justify-center px-2 py-3 rounded-full text-xs transition-colors"
              style={{
                backgroundColor: futureConversations === "maybe" ? '#FFF8E1' : '#F5F5F5',
                border: futureConversations === "maybe" ? '2px solid #FF9800' : '2px solid transparent',
                color: '#1B1B1B',
                fontWeight: 500
              }}
            >
              😐 Maybe
            </button>
            
            <button
              onClick={() => handleFutureConversationSelect("yes")}
              className="flex-1 flex items-center justify-center px-2 py-3 rounded-full text-xs transition-colors"
              style={{
                backgroundColor: futureConversations === "yes" ? '#E8F5E8' : '#F5F5F5',
                border: futureConversations === "yes" ? '2px solid #4CAF50' : '2px solid transparent',
                color: '#1B1B1B',
                fontWeight: 500
              }}
            >
              ✅ Yes!!!
            </button>
          </div>

          {/* Text Area for feedback */}
          {showTextArea && (
            <div className="mb-3">
              <Textarea
                ref={textAreaRef}
                placeholder="Your feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onFocus={handleTextAreaFocus}
                onBlur={handleTextAreaBlur}
                className="w-full min-h-[80px] p-3 rounded-2xl border-2 border-gray-200 resize-none"
                style={{
                  backgroundColor: '#F8F9FA',
                  fontSize: '14px',
                  fontFamily: 'Satoshi'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="px-6 pb-8">
        <div 
          onClick={handleSubmit}
          className={`flex justify-center items-center ${rating === 0 || saveFeedbackMutation.isPending ? 'opacity-50' : 'cursor-pointer'}`}
          style={{
            background: rating === 0 || saveFeedbackMutation.isPending ? '#C0C0C0' : '#81d478',
            borderRadius: '16px',
            gap: '8px',
            width: '100%',
            height: '50px',
            padding: '13px 16px',
            cursor: rating === 0 || saveFeedbackMutation.isPending ? 'not-allowed' : 'pointer'
          }}
        >
          <span 
            style={{
              color: '#111',
              fontFamily: 'Satoshi',
              fontSize: '16px',
              fontStyle: 'normal',
              fontWeight: 700,
              lineHeight: '24px',
              fontVariantNumeric: 'lining-nums proportional-nums'
            }}
          >
            {saveFeedbackMutation.isPending ? 'Submitting...' : 'Submit feedback'}
          </span>
        </div>
      </div>
    </div>
  );
}