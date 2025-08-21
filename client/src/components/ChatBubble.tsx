import React from 'react';

interface ChatBubbleProps {
  children: React.ReactNode;
}

export default function ChatBubble({ children }: ChatBubbleProps) {
  return (
    <div className="relative" style={{ width: '310px', minHeight: 'auto' }}>
      {/* Bubble tail/arrow - positioned at top */}
      <div 
        className="absolute"
        style={{
          top: '-12px',
          left: '20px',
          width: '41px',
          height: '12px'
        }}
      >
        <svg width="42" height="13" viewBox="0 0 42 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18.1987 2.99313L8.30355 11.6815C7.57415 12.322 6.63678 12.6753 5.66616 12.6758L36.0068 12.6758C35.0372 12.6746 34.1009 12.3214 33.3722 11.6815L23.4771 2.99313C21.9673 1.66748 19.7085 1.66748 18.1987 2.99313Z" fill="#81d478" />
        </svg>
      </div>
      
      {/* Main bubble container */}
      <div 
        className="relative rounded-2xl px-4 py-3"
        style={{
          width: '310px',
          minHeight: 'auto',
          backgroundColor: '#81d4781a', // 81d478 with 10% opacity
          border: '1.5px solid #81d478',
          boxSizing: 'border-box',
          marginTop: '0px' // No space - arrow should touch the bubble
        }}
      >
        {/* Text content */}
        <div 
          className="text-black leading-6"
          style={{
            fontFamily: 'Satoshi',
            fontSize: '18px',
            lineHeight: '24px',
            color: '#000'
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}