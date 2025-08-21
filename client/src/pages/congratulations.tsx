import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/use-page-title";
import { getPostLessonScenarios } from "@/lib/ai-scenarios";
import type { Lesson } from "../lib/lessons";

export default function CongratulationsPage() {
  usePageTitle("Congratulations");
  const [, setLocation] = useLocation();
  const params = useParams();
  const lessonId = parseInt(params.lessonId!);

  const { data: lessons } = useQuery<Lesson[]>({
    queryKey: ['/api/lessons']
  });

  const { data: currentLesson } = useQuery<Lesson>({
    queryKey: [`/api/lessons/${lessonId}`]
  });

  const handleNextLesson = () => {
    if (lessons) {
      const currentIndex = lessons.findIndex(l => l.id === lessonId);
      if (currentIndex < lessons.length - 1) {
        const nextLesson = lessons[currentIndex + 1];
        setLocation(`/lesson/${nextLesson.id}`);
      } else {
        setLocation("/");
      }
    }
  };



  const handleAITutor = () => {
    // Go to scenario selection page
    setLocation(`/ai-tutor/post-lesson/${lessonId}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-200" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-gray-600 hover:text-gray-800 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-12 text-center">
        <div className="mb-8">
          {/* Celebration rocket image */}
          <div className="w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <img 
              src="/capa-1.png" 
              alt="Celebration rocket"
              className="w-20 h-20 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Great job! You've finished 100% of the lesson!
          </h1>
          <p className="text-gray-600">
            Keep up the good work and go practice!
          </p>
        </div>

        {/* AI Tutor Practice Section */}
        <Card className="bg-gray-100 rounded-2xl mb-6 border-0">
          <CardContent className="p-6">
            <div className="flex items-center mb-4">
              {/* Learning tutor avatar */}
              <div className="w-12 h-12 mr-3 flex items-center justify-center">
                <img 
                  src="/learning-icon-2.png" 
                  alt="Learning tutor"
                  className="w-12 h-12 rounded-full object-cover"
                />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Now let's practice!</p>
                <p className="text-sm text-gray-600">
                  Roleplay, quick quiz and additional questions
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={handleAITutor}
                className="bg-primary text-white w-full hover:bg-primary/90"
              >
                Start now
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button 
          onClick={handleNextLesson}
          variant="outline"
          className="w-full py-4 border-2 border-primary text-primary hover:bg-primary hover:text-white"
        >
          Next lesson
        </Button>
      </div>
    </div>
  );
}
