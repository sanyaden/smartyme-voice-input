import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { X, ArrowLeft, ArrowRight } from "lucide-react";

import MarkdownRenderer from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { usePageTitle } from "@/hooks/use-page-title";

interface LessonSection {
  id: number;
  title: string;
  content: string;
}

interface LessonData {
  id: number;
  title: string;
  description: string;
  sections: LessonSection[];
  order: number;
}

export default function LessonPage() {
  usePageTitle("Lesson");
  const params = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const lessonId = parseInt(params.id!);
  const urlPart = parseInt(params.part || "0");
  const [currentPart, setCurrentPart] = useState(urlPart);

  const { data: lesson, isLoading } = useQuery<LessonData>({
    queryKey: [`/api/lessons/${lessonId}`]
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { currentPart: number; completed?: boolean }) => {
      return apiRequest("POST", `/api/progress/${lessonId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/progress"] });
    }
  });

  const lessonSections = lesson?.sections || [];
  const currentSectionData = lessonSections[currentPart];
  const isLastPart = currentPart === lessonSections.length - 1;

  // Update URL when part changes
  useEffect(() => {
    if (currentPart > 0) {
      setLocation(`/lesson/${lessonId}/part/${currentPart}`, { replace: true });
    } else {
      setLocation(`/lesson/${lessonId}`, { replace: true });
    }
  }, [currentPart, lessonId, setLocation]);

  // Update progress when part changes
  useEffect(() => {
    if (lesson) {
      updateProgressMutation.mutate({ currentPart });
    }
  }, [currentPart, lesson]);

  const handleNext = () => {
    if (isLastPart) {
      // Mark lesson as completed and go to congratulations
      updateProgressMutation.mutate({ currentPart, completed: true });
      setLocation(`/congratulations/${lessonId}`);
    } else {
      setCurrentPart(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentPart === 0) {
      setLocation("/");
    } else {
      setCurrentPart(prev => prev - 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="px-4 py-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-300 rounded w-3/4 mx-auto"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded"></div>
              <div className="h-4 bg-gray-300 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson || !currentSectionData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="px-4 py-6">
          <p className="text-center text-gray-600">Lesson not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      
      {/* Header */}
      <div className="px-4 py-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="text-gray-600 hover:text-gray-800 p-0"
          >
            <X className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-800 flex-1 text-center mx-4">
            {lesson.title}
          </h1>
          <div className="w-5"></div>
        </div>
      </div>

      {/* Lesson Content */}
      <div className="px-4 py-6 pb-32 min-h-96">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {currentSectionData.title}
          </h2>
        </div>
        <MarkdownRenderer content={currentSectionData.content} />
      </div>

      {/* Navigation */}
      <div className="fixed-bottom-container">
        <div className="px-4 py-4" style={{ backgroundColor: '#FDFFFB' }}>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 h-12 text-base font-medium border-2 border-gray-300 bg-white hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              className="flex-1 h-12 text-base font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: '#81D478' }}
              disabled={updateProgressMutation.isPending}
            >
              {isLastPart ? "Complete" : "Continue"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
