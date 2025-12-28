'use client';

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#fafafa]">
      <div className="flex flex-col items-center justify-center">
        {/* 로고 SVG */}
        <div className="mb-8">
          <svg
            width="400"
            height="300"
            viewBox="0 0 400 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full max-w-md"
          >
            {/* 배경 */}
            <rect width="400" height="300" fill="#fafafa" />
            
            {/* 태양/달 (초승달) - 뒤쪽에 위치 */}
            <circle cx="320" cy="130" r="60" fill="#ff8c42" opacity="0.9" />
            <circle cx="300" cy="130" r="60" fill="#fafafa" />
            
            {/* 야자수 - 왼쪽에 위치 */}
            <g>
              {/* 야자수 줄기 */}
              <rect x="100" y="120" width="14" height="100" fill="#1a4d5c" rx="2" />
              {/* 야자수 잎들 - 더 자연스럽게 */}
              <path
                d="M 107 120 Q 70 100 60 130 Q 75 150 107 120"
                fill="#1a4d5c"
              />
              <path
                d="M 107 120 Q 95 80 105 100 Q 115 120 107 120"
                fill="#1a4d5c"
              />
              <path
                d="M 107 120 Q 120 80 135 100 Q 125 120 107 120"
                fill="#1a4d5c"
              />
              <path
                d="M 107 120 Q 145 150 160 130 Q 150 110 107 120"
                fill="#1a4d5c"
              />
            </g>
            
            {/* 모래 (곡선) - 물결 모양 */}
            <path
              d="M 0 220 Q 50 200 100 210 T 200 210 T 300 210 T 400 210 L 400 300 L 0 300 Z"
              fill="#ff8c42"
              opacity="0.9"
            />
            
            {/* 해변 의자에 누운 사람 */}
            <g>
              {/* 해변 의자 - 더 자연스럽게 */}
              <path
                d="M 180 210 L 280 210 L 275 240 L 185 240 Z"
                fill="#1a4d5c"
              />
              <path
                d="M 180 210 Q 200 200 220 210"
                stroke="#1a4d5c"
                strokeWidth="3"
                fill="none"
              />
              
              {/* 사람 실루엣 */}
              <g>
                {/* 머리 */}
                <circle cx="240" cy="170" r="16" fill="#1a4d5c" />
                {/* 야구모자 */}
                <ellipse cx="240" cy="165" rx="20" ry="6" fill="#1a4d5c" />
                <rect x="220" y="165" width="40" height="4" fill="#1a4d5c" />
                
                {/* 몸통 (누운 자세) */}
                <ellipse cx="240" cy="200" rx="18" ry="25" fill="#1a4d5c" />
                
                {/* 팔 - 노트북을 잡고 있는 자세 */}
                <ellipse cx="260" cy="195" rx="6" ry="18" fill="#1a4d5c" transform="rotate(-20 260 195)" />
                <ellipse cx="220" cy="200" rx="6" ry="15" fill="#1a4d5c" transform="rotate(10 220 200)" />
                
                {/* 다리 */}
                <ellipse cx="230" cy="225" rx="5" ry="18" fill="#1a4d5c" transform="rotate(-15 230 225)" />
                <ellipse cx="250" cy="225" rx="5" ry="18" fill="#1a4d5c" transform="rotate(15 250 225)" />
                
                {/* 노트북 */}
                <rect x="260" y="185" width="30" height="18" rx="2" fill="#1a4d5c" />
                <line x1="265" y1="192" x2="285" y2="192" stroke="#fafafa" strokeWidth="1.5" />
                <line x1="265" y1="197" x2="280" y2="197" stroke="#fafafa" strokeWidth="1" />
              </g>
            </g>
          </svg>
        </div>
        
        {/* 텍스트 */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wider text-[#1a4d5c] mb-2">
            Economic
          </h1>
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-wider text-[#1a4d5c]">
            Freedom
          </h1>
        </div>
        
        {/* 로딩 인디케이터 */}
        <div className="mt-8 flex space-x-2">
          <div className="w-3 h-3 bg-[#1a4d5c] rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-3 h-3 bg-[#1a4d5c] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-[#1a4d5c] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
    </div>
  );
}

