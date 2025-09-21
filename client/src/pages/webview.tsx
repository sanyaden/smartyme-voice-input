import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { AlertCircle, Mic } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ChatBubble from "@/components/ChatBubble";
import { getBaseScenarios, getAllPostLessonScenarios } from "@/lib/ai-scenarios";
import { usePageTitle } from "@/hooks/use-page-title";
import { resolveLessonId, detectLessonIdFormat, mapLongIdToShortId } from "@/lib/lesson-mapping";
import type { Lesson } from "../lib/lessons";
import { mrSmartImage, getScenarioImage } from "@/lib/assets";
import VoiceTutor from "@/components/VoiceTutor";

// Helper function to infer lesson title from lesson ID
function inferLessonTitleFromId(lessonId: string): string {
  // Convert lesson ID to readable title
  // Example: "Public_Speaking__Vocabulary__Personal_Stories_and_Anecdotes" 
  // becomes "Public Speaking: Vocabulary & Personal Stories and Anecdotes"
  
  const parts = lessonId.split('__');
  const readableParts = parts.map(part => 
    part.replace(/_/g, ' ')
        .replace(/&/g, '&')
        .replace(/%26/g, '&')
        .replace(/%3A/g, ':')
  );
  
  // Join with appropriate separators
  if (readableParts.length > 1) {
    const mainTopic = readableParts[0];
    const subtopics = readableParts.slice(1).join(' - ');
    return `${mainTopic}: ${subtopics}`;
  }
  
  return readableParts[0];
}

// Helper function to create smart fallback scenarios when lesson data is not available
function createSmartFallbackScenarios(inferredTitle: string, lessonId: string) {
  const topicKeywords = inferredTitle.toLowerCase();
  
  // Create a lesson-specific quiz scenario based on inferred topic
  const lessonQuizScenario = {
    title: "Quick quiz on this lesson",
    description: "Test your understanding with instant feedback.",
    prompt: `You are Mr. Smart, an AI communication tutor. The user just completed a lesson on "${inferredTitle}".

TASK: Create a personalized quiz based on this lesson topic.

Since you don't have the exact lesson content, use your expertise to create relevant quiz questions about ${inferredTitle.toLowerCase()}. 

Start with: "Great! Let's test what you learned from '${inferredTitle}'. Based on this topic, here's your first question:"

Create 3-5 multiple choice questions that would typically be covered in a lesson about ${inferredTitle.toLowerCase()}. Focus on practical applications and key concepts.

Present ONE question at a time with 4 options (A, B, C, D). After they answer, give feedback and move to the next question.

At the end, summarize their performance and encourage them to apply what they learned.

Begin the quiz now.`
  };

  // Get base scenarios and insert the lesson quiz at the beginning
  const baseScenarios = getBaseScenarios();
  return [lessonQuizScenario, ...baseScenarios];
}



interface WebViewParams {
  user_id?: string | null;
  lesson_id?: string | null;
  course_id?: string | null;
}

export default function WebViewPage() {
  usePageTitle("AI Tutor - Practice Session");
  const [, setLocation] = useLocation();
  
  // Parse URL parameters
  const [params, setParams] = useState<WebViewParams>({});
  const [paramErrors, setParamErrors] = useState<string[]>([]);
  const [showVoiceTutor, setShowVoiceTutor] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const user_id = urlParams.get('user_id');
    const lesson_id = urlParams.get('lesson_id');
    const course_id = urlParams.get('course_id');

    // Store parameters without validation errors - allow graceful fallback
    setParams({ 
      user_id: user_id || undefined, 
      lesson_id: lesson_id || undefined, 
      course_id: course_id || undefined 
    });
    
    // Clear any previous errors since we're allowing fallback behavior
    setParamErrors([]);
  }, []);

  // Use lesson_id directly for API call (new direct longId approach)
  const lessonIdForAPI = params.lesson_id;
  
  const { data: lesson, isLoading, error } = useQuery<Lesson>({
    queryKey: [`/api/lessons/${encodeURIComponent(lessonIdForAPI || '')}`],
    enabled: !!lessonIdForAPI
  });

  // Generate scenarios based on lesson data
  const baseScenarios = getBaseScenarios();
  
  // Create scenarios - prioritize lesson-specific quiz if we have lesson data
  let scenarios;
  if (lesson) {
    // We have full lesson data - use comprehensive post-lesson scenarios
    const allPostLessonScenarios = getAllPostLessonScenarios(lesson);
    scenarios = allPostLessonScenarios;
  } else if (params.lesson_id) {
    // We have a lesson ID but no lesson data - create smart fallback with inferred quiz
    const inferredLessonTitle = inferLessonTitleFromId(params.lesson_id);
    scenarios = createSmartFallbackScenarios(inferredLessonTitle, params.lesson_id);
  } else {
    // No lesson context - show base scenarios
    scenarios = baseScenarios;
  }

  const handleScenarioClick = (scenario: any) => {
    // Store webview parameters separately for feedback page access
    const webviewParams = {
      userId: params.user_id,
      lessonId: params.lesson_id,
      courseId: params.course_id
    };
    
    // Store scenario data for the chat, including webview context
    const scenarioWithContext = {
      ...scenario,
      lessonTitle: lesson?.title || null,
      isPostLesson: true,
      entryPoint: "webview",
      // Store webview parameters for database tracking
      webviewParams: webviewParams
    };
    
    // Safe sessionStorage operations with error handling
    try {
      sessionStorage.setItem('webviewParams', JSON.stringify(webviewParams));
      sessionStorage.setItem('currentScenario', JSON.stringify(scenarioWithContext));
    } catch (error) {
      console.warn('SessionStorage unavailable, continuing with in-memory data:', error);
      // Continue navigation - the app will work without sessionStorage persistence
    }
    
    setLocation('/chat');
  };

  // Error state for missing/invalid parameters
  if (paramErrors.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#FDFFFB' }}>
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <h2 className="text-lg font-semibold">Invalid Parameters</h2>
            </div>
            <div className="space-y-2 mb-4">
              {paramErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600">• {error}</p>
              ))}
            </div>
            <div className="text-sm text-gray-600 mb-4">
              <p className="font-medium mb-2">Expected URL format:</p>
              <code className="block p-2 bg-gray-100 rounded text-xs break-all">
                /webview?user_id=123&lesson_id=1&course_id=1
              </code>
            </div>
            <Button 
              onClick={() => window.location.reload()} 
              className="w-full"
            >
              Reload Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-[72px] h-[72px] bg-gray-300 rounded-full"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-300 rounded w-20"></div>
                <div className="h-3 bg-gray-300 rounded w-16"></div>
              </div>
            </div>
            <div className="h-16 bg-gray-300 rounded-2xl"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-gray-300 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No error state - allow graceful fallback to default scenarios when lesson not found

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
      {/* Header with Avatar and Name - No close button for webview */}
      <div className="px-4 py-6" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="flex items-center">
          {/* Avatar */}
          <img 
            src={mrSmartImage} 
            alt="Mr. Smart"
            className="w-[72px] h-[72px] rounded-full mr-3 object-cover"
          />
          <div>
            <h2 className="font-semibold" style={{ color: '#1B1B1B' }}>Mr. Smart</h2>
            <p className="text-sm text-gray-600">Your tutor</p>
          </div>
        </div>
      </div>



      {/* Lesson context info - only show when lesson exists */}
      {lesson && (
        <div className="px-4 mb-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <p className="text-sm font-medium text-blue-800 mb-1">
                Lesson Completed: {lesson.title}
              </p>
              <p className="text-xs text-blue-600">
                Practice what you learned with interactive scenarios
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chat bubble with question */}
      <div className="px-4 mb-4 flex justify-start">
        <ChatBubble>
          <div style={{ fontWeight: 700 }}>
            Great job completing the lesson! Let's practice what you learned. What would you like to start with?
          </div>
        </ChatBubble>
      </div>

      {/* Scenario options */}
      <div className="px-4 space-y-4">
        {scenarios.map((scenario, index) => (
          <Card 
            key={index}
            className="cursor-pointer transition-all duration-200 hover:shadow-md active:scale-98"
            onClick={() => handleScenarioClick(scenario)}
          >
            <CardContent className="p-4">
              <div className="flex items-center space-x-4">
                <img 
                  src={getScenarioImage(scenario.title)}
                  alt={scenario.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1 text-base">
                    {scenario.title}
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {scenario.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Floating Voice Tutor Button */}
      {!showVoiceTutor && (
        <Button
          onClick={() => setShowVoiceTutor(true)}
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-10"
          size="lg"
        >
          <Mic className="w-6 h-6" />
        </Button>
      )}

      {/* Voice Tutor Modal/Overlay */}
      {showVoiceTutor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20 p-4">
          <div className="w-full max-w-md">
            <VoiceTutor
              userId={params.user_id || undefined}
              lessonId={params.lesson_id || undefined}
              onClose={() => setShowVoiceTutor(false)}
            />
          </div>
        </div>
      )}

    </div>
  );
}