import { useState, useEffect } from 'react';

export interface WebViewParams {
  userId?: string;
  lessonId?: string;
  courseId?: string;
  token?: string;
  mode?: 'lesson' | 'chat' | 'feedback';
}

export function useWebViewParams(): WebViewParams {
  const [params, setParams] = useState<WebViewParams>({});

  useEffect(() => {
    const parseParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      
      const newParams: WebViewParams = {};
      
      // Parse and validate each parameter
      const userId = urlParams.get('user_id');
      if (userId && userId.trim()) {
        newParams.userId = userId.trim();
      }

      const lessonId = urlParams.get('lesson_id');
      if (lessonId && lessonId.trim()) {
        newParams.lessonId = lessonId.trim();
      }

      const courseId = urlParams.get('course_id');
      if (courseId && courseId.trim()) {
        newParams.courseId = courseId.trim();
      }

      const token = urlParams.get('token');
      if (token && token.trim()) {
        newParams.token = token.trim();
      }

      const mode = urlParams.get('mode') as WebViewParams['mode'];
      if (mode && ['lesson', 'chat', 'feedback'].includes(mode)) {
        newParams.mode = mode;
      }

      return newParams;
    };

    setParams(parseParams());

    // Listen for URL changes (for SPAs)
    const handleLocationChange = () => {
      setParams(parseParams());
    };

    window.addEventListener('popstate', handleLocationChange);
    
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  return params;
}

// Helper hook for handling missing parameters
export function useWebViewParamsValidation(requiredParams: (keyof WebViewParams)[] = []) {
  const params = useWebViewParams();
  const [isValid, setIsValid] = useState(true);
  const [missingParams, setMissingParams] = useState<string[]>([]);

  useEffect(() => {
    const missing = requiredParams.filter(param => !params[param]);
    setMissingParams(missing);
    setIsValid(missing.length === 0);
  }, [params, requiredParams]);

  return {
    params,
    isValid,
    missingParams,
    hasParams: Object.keys(params).length > 0
  };
}