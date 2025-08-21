import { useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";

export default function LessonOverviewPage() {
  usePageTitle("Lesson Overview");
  const params = useParams();
  const [, setLocation] = useLocation();
  
  const lessonId = parseInt(params.id!);

  const { data: lessons } = useQuery<any[]>({
    queryKey: ['/api/lessons']
  });

  const { data: lessonDetail, isLoading } = useQuery<any>({
    queryKey: [`/api/lessons/${lessonId}`]
  });

  const lesson = lessons?.find(l => l.id === lessonId) || lessonDetail;

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="pt-4 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-300 rounded w-3/4"></div>
            <div className="h-48 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-full"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="pt-4 px-4">
          <div className="text-center">
            <p className="text-gray-600">Lesson not found</p>
            <Button 
              onClick={() => setLocation("/")}
              className="mt-4"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
      
      <div className="pt-4">
        {/* Header with back button */}
        <div className="px-4 py-4 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/")}
            className="p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 text-lg font-semibold text-gray-900">
            Lesson Overview
          </h1>
        </div>

        {/* Cover Image */}
        <div className="px-4 mb-6">
          <div className="relative h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600">
            <img
              src={`/${lesson.coverImage}`}
              alt={lesson.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6">
              <h2 className="text-2xl font-bold text-white leading-tight">
                {lesson.title}
              </h2>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="px-4 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            About This Lesson
          </h3>
          <div className="prose prose-gray max-w-none">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {lesson.description}
            </p>
          </div>
        </div>

        {/* Spacer for fixed button */}
        <div className="h-32"></div>
      </div>

      {/* Fixed Start Lesson Button */}
      <div className="fixed-bottom-container">
        <div className="px-4 py-4" style={{ backgroundColor: '#FDFFFB' }}>
          <Button
            onClick={() => setLocation(`/lesson/${lessonId}`)}
            className="w-full h-12 text-lg font-semibold"
            style={{ backgroundColor: '#81D478' }}
          >
            <Play className="h-5 w-5 mr-2" />
            Start Lesson
          </Button>
        </div>
      </div>
    </div>
  );
}