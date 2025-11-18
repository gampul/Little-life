'use client';

export function AIAgentModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-[480px] w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-500 bg-clip-text text-transparent">
            🤖 AI Agent
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* AI Agent 설명 */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/30 rounded-xl p-6 mb-6 border border-blue-200 dark:border-blue-500/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">✨ 나만의 AI 라이프 코치</h3>
          <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-4">
            AI Agent가 당신의 일상을 종합적으로 분석하여 맞춤형 조언을 제공합니다.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">⚖️</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">체중 변화</div>
            </div>
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">데일리 루틴</div>
            </div>
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">🍽️</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">식사 기록</div>
            </div>
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">재무 상태</div>
              <div className="text-xs text-yellow-400 dark:text-yellow-400 mt-1">준비중</div>
            </div>
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">가계부</div>
              <div className="text-xs text-yellow-400 dark:text-yellow-400 mt-1">준비중</div>
            </div>
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📝</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">일기 분석</div>
            </div>
          </div>
        </div>

        {/* 개발 예정 기능 안내 */}
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
          <div className="text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">곧 만나요!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-base">
              AI Agent 기능은 현재 개발 중입니다.<br/>
              조만간 당신의 라이프 코치가 되어드릴게요!
            </p>
            
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-900 rounded-lg p-4 text-left border border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">🎯 예정된 기능</h4>
              <ul className="space-y-2 text-base text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>일주일 단위 루틴 달성률 분석 및 개선 제안</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>체중 변화 패턴 분석 및 건강 조언</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>식사 기록 기반 영양 밸런스 체크</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>재무 상태와 소비 패턴 분석 (개발 예정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>가계부 데이터 기반 절약 팁 제공 (개발 예정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>일기 내용 감정 분석 및 멘탈 케어 조언</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 dark:text-blue-400">▸</span>
                  <span>개인화된 주간/월간 리포트 자동 생성</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors min-h-[44px] text-base"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

