'use client';

import Image from 'next/image';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fafafa]">
      <div className="flex flex-col items-center justify-center">
        {/* 로고 이미지 */}
        <div className="mb-8 animate-pulse">
          <Image
            src="/little-life-logo.png"
            alt="Little Life Logo"
            width={300}
            height={300}
            priority
            className="w-64 h-64 md:w-80 md:h-80 object-contain"
          />
        </div>
        
        {/* 로딩 인디케이터 */}
        <div className="mt-4 flex space-x-2">
          <div className="w-3 h-3 bg-[#1a4d5c] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 h-3 bg-[#1a4d5c] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-[#1a4d5c] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}

