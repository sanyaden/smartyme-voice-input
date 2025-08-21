import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import ChatBubble from "@/components/ChatBubble";
import { getBaseScenarios, getAllPostLessonScenarios } from "@/lib/ai-scenarios";
import { usePageTitle } from "@/hooks/use-page-title";
import type { Lesson } from "../lib/lessons";
import { mrSmartImage, getScenarioImage } from "@/lib/assets";

export default function AiTutorPage() {
  usePageTitle("AI Tutor");
  const [, setLocation] = useLocation();
  const params = useParams();
  
  const lessonId = params.lessonId ? parseInt(params.lessonId) : null;
  const isPostLesson = !!lessonId;

  const { data: lesson } = useQuery<Lesson>({
    queryKey: [`/api/lessons/${lessonId}`],
    enabled: !!lessonId
  });

  const baseScenarios = getBaseScenarios();
  const allPostLessonScenarios = lesson ? getAllPostLessonScenarios(lesson) : [];
  
  const scenarios = isPostLesson 
    ? allPostLessonScenarios  // Show all 3 scenarios: roleplay, diagnostic, lesson quiz
    : baseScenarios;

  const handleScenarioClick = (scenario: any) => {
    // Store scenario data for the chat, including lesson title if post-lesson
    const scenarioWithContext = {
      ...scenario,
      lessonTitle: lesson?.title || null,
      isPostLesson: isPostLesson,
      entryPoint: isPostLesson ? "lesson_end" : "main_screen"
    };
    
    // Safe sessionStorage operation with error handling
    try {
      sessionStorage.setItem('currentScenario', JSON.stringify(scenarioWithContext));
    } catch (error) {
      console.warn('SessionStorage unavailable, passing scenario via URL params:', error);
      // Fallback: encode scenario in URL params for environments where sessionStorage fails
    }
    
    setLocation('/chat');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
      {/* Header with Avatar and Name */}
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

      {/* Chat bubble with question */}
      <div className="px-4 mb-4 flex justify-start">
        <ChatBubble>
          <div style={{ fontWeight: 700 }}>What would you like to start with?</div>
        </ChatBubble>
      </div>

      {/* Scenario Cards as Messages */}
      <div className="px-4 space-y-3">
        {scenarios.map((scenario, index) => (
          <div 
            key={index}
            className="cursor-pointer"
            onClick={() => handleScenarioClick(scenario)}
            style={{
              width: '100%',
              height: '100px',
              position: 'relative'
            }}
          >
            {/* Main card container */}
            <div 
              style={{
                width: '100%',
                height: '100px',
                backgroundColor: '#FFFFFF',
                border: '1.5px solid #E6EDE6',
                borderTopLeftRadius: '0px',
                borderTopRightRadius: '16px',
                borderBottomLeftRadius: '16px',
                borderBottomRightRadius: '16px',
                padding: '12px',
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)'
              }}
            >
              {/* Icon */}
              <div 
                style={{
                  width: '48px',
                  height: '48px',
                  marginRight: '12px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  marginTop: '2px'
                }}
              >
                <img 
                  src={getScenarioImage(scenario.title)}
                  alt={scenario.title}
                  style={{
                    width: '48px',
                    height: '48px',
                    objectFit: 'contain'
                  }}
                />
              </div>
              
              {/* Text content */}
              <div style={{ flex: 1 }}>
                <div 
                  style={{
                    color: '#000',
                    fontFamily: 'Satoshi',
                    fontSize: '18px',
                    fontWeight: 700,
                    lineHeight: '24px',
                    marginBottom: '4px'
                  }}
                >
                  {scenario.title}
                </div>
                <div 
                  style={{
                    color: '#000',
                    fontFamily: 'Satoshi',
                    fontSize: '16px',
                    fontWeight: 400,
                    lineHeight: '22px',
                    opacity: 0.7
                  }}
                >
                  {scenario.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>



    </div>
  );
}
