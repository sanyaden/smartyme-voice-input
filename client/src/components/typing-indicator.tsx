import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1 py-2">
      <div className="flex space-x-1">
        <div 
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ 
            backgroundColor: '#81D478',
            animationDelay: '0ms',
            animationDuration: '1.4s'
          }}
        />
        <div 
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ 
            backgroundColor: '#81D478',
            animationDelay: '150ms',
            animationDuration: '1.4s'
          }}
        />
        <div 
          className="w-2 h-2 rounded-full animate-bounce"
          style={{ 
            backgroundColor: '#81D478',
            animationDelay: '300ms',
            animationDuration: '1.4s'
          }}
        />
      </div>
    </div>
  );
}