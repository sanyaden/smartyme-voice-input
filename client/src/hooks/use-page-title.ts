import { useEffect } from 'react';

export function usePageTitle(title: string) {
  useEffect(() => {
    const originalTitle = document.title;
    document.title = `${title} | SmartyMe AI Communication Tutor`;
    
    return () => {
      document.title = originalTitle;
    };
  }, [title]);
}