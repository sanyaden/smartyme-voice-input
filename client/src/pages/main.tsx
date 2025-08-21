import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import mrSmartImage from "@assets/mr-smart.png";

interface Lesson {
  id: number;
  title: string;
  coverImage: string;
  description: string;
}

export default function MainPage() {
  const [, setLocation] = useLocation();
  
  // No automatic redirects - this page is now accessed via /lessons
  
  const { data: lessons, isLoading, error } = useQuery<Lesson[]>({
    queryKey: ['/api/lessons'],
  });

  if (error) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="px-4 py-6">
          <div className="text-center text-red-600">
            <p>Error loading lessons: {error.message}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }


  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#FDFFFB' }}>
        <div className="px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-gray-300 rounded-2xl"></div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-300 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: '#FDFFFB' }}>
      {/* Content */}
      <div className="px-4 py-6">
        {/* Topic */}
        <div className="mb-6">
          <div 
            className="w-full rounded-2xl p-6"
            style={{
              backgroundColor: '#2D2D2D',
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          >
            <p 
              style={{
                color: '#9CA3AF',
                fontFamily: 'Satoshi',
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: '20px',
                margin: 0,
                marginBottom: '8px'
              }}
            >
              Topic
            </p>
            <h2 
              style={{
                color: 'white',
                fontFamily: 'Satoshi',
                fontSize: '30px',
                fontWeight: 700,
                lineHeight: '36px',
                margin: 0
              }}
            >
              Communication Skills
            </h2>
          </div>
        </div>

        {/* Lesson Cards */}
        <div className="space-y-4 mb-6">
          {lessons?.map((lesson) => (
            <div 
              key={lesson.id}
              className="rounded-2xl overflow-hidden cursor-pointer relative bg-gradient-to-br from-blue-500 to-purple-600"
              onClick={() => setLocation(`/lesson-overview/${lesson.id}`)}
              style={{ aspectRatio: '16/9' }}
            >
              <img 
                src={`/${lesson.coverImage}`}
                alt={lesson.title}
                className="w-full h-full object-cover"
                style={{ filter: 'brightness(0.5)' }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div className="absolute bottom-6 left-6 right-6">
                <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                  {lesson.title}
                </h3>
                <p className="text-gray-200 text-sm line-clamp-2 leading-relaxed">
                  {lesson.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fixed AI Tutor Banner */}
      <div className="fixed-bottom-container">
        <div className="px-4 py-4" style={{ backgroundColor: '#FDFFFB' }}>
          <div 
            className="bg-primary rounded-2xl shadow-lg cursor-pointer flex items-center py-4 px-4"
            onClick={() => setLocation("/ai-tutor")}
            style={{
              backgroundColor: '#81D478',
              height: '88px'
            }}
          >
            {/* Avatar */}
            <img 
              src={mrSmartImage} 
              alt="Mr. Smart"
              className="w-16 h-16 rounded-full mr-4 object-cover"
            />
            
            {/* Text */}
            <div className="flex-1">
              <p 
                style={{
                  color: '#000',
                  fontFamily: 'Satoshi',
                  fontSize: '18px',
                  fontStyle: 'normal',
                  fontWeight: 600,
                  lineHeight: '26px',
                  fontVariantNumeric: 'lining-nums proportional-nums'
                }}
              >
                Practice communication<br />skills with your tutor!
              </p>
            </div>
            
            {/* Button */}
            <div 
              className="inline-flex justify-center items-center cursor-pointer"
              style={{
                background: '#1b1b1b',
                borderRadius: '14px',
                gap: '8px',
                height: '40px',
                padding: '8px 20px'
              }}
            >
              <span 
                style={{
                  color: '#fff',
                  fontFamily: 'Satoshi',
                  fontSize: '16px',
                  fontStyle: 'normal',
                  fontWeight: 700,
                  lineHeight: '24px',
                  fontVariantNumeric: 'lining-nums proportional-nums'
                }}
              >
                Try
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}