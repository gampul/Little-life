'use client';

import { useState, useRef, useEffect } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ReportSummary {
  totalAsset: number;
  monthlyExpense: number;
  monthlyIncome: number;
  savingRate: number;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');
  const [report, setReport] = useState<string>('');
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
  const [reportType, setReportType] = useState<string>('daily');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 스크롤 맨 아래로
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 초기 환영 메시지
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: '안녕하세요! 👋 저는 Little Life AI 어시스턴트입니다.\n\n당신의 일상, 일기, 가계부, 자산 데이터를 분석하여 맞춤형 조언을 드릴 수 있어요.\n\n예시 질문:\n• "이번 달 지출 분석해줘"\n• "내 자산 현황이 어때?"\n• "저축률을 높이려면 어떻게 해야 할까?"\n• "오늘 하루 조언 해줘"\n\n무엇이든 물어보세요! 😊',
        timestamp: new Date(),
      }]);
    }
  }, []);

  // 채팅 메시지 전송
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input.trim(), includeData: true }),
      });

      const data = await response.json();

      // 디버그: Function Calling 정보 콘솔에 출력
      if (data.debug) {
        console.log('🔧 AI 모드:', data.debug.mode);
        if (data.functionsUsed?.length > 0) {
          console.log('📊 호출된 함수:', data.functionsUsed);
        }
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // 디버그 정보를 응답에 추가 (개발용)
      const debugText = data.functionsUsed?.length > 0
        ? `\n\n---\n🔧 [Function Calling] ${data.functionsUsed.join(', ')}`
        : '';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response + debugText,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `⚠️ 오류가 발생했습니다: ${error.message}\n\n다시 시도해주세요.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // 리포트 생성
  const generateReport = async (type: string) => {
    setIsGeneratingReport(true);
    setReportType(type);

    try {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: type }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setReport(data.report);
      setReportSummary(data.summary);
    } catch (error: any) {
      setReport(`⚠️ 리포트 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Enter 키 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 빠른 질문 버튼
  const quickQuestions = [
    '이번 달 지출 분석해줘',
    '자산 현황 알려줘',
    '저축 조언 해줘',
    '오늘 하루 조언',
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <GlobalNav />

      <div className="max-w-[412px] mx-auto">
        {/* 탭 네비게이션 */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'chat'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              💬 채팅
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
                activeTab === 'report'
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              📊 리포트
            </button>
          </div>
        </div>

        {/* 채팅 탭 */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-180px)]">
            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md'
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                    <div className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-indigo-200' : 'text-gray-400'
                    }`}>
                      {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* 빠른 질문 */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setInput(q);
                        inputRef.current?.focus();
                      }}
                      className="text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 입력 영역 */}
            <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요..."
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-xl transition-colors disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 리포트 탭 */}
        {activeTab === 'report' && (
          <div className="px-4 py-6">
            {/* 리포트 타입 선택 */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { id: 'daily', label: '오늘의 리포트', icon: '📅', desc: '종합 분석' },
                { id: 'financial', label: '재정 리포트', icon: '💰', desc: '수입/지출 분석' },
                { id: 'lifestyle', label: '라이프스타일', icon: '🌟', desc: '일상 분석' },
                { id: 'weekly', label: '주간 리포트', icon: '📈', desc: '주간 요약' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => generateReport(type.id)}
                  disabled={isGeneratingReport}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    reportType === type.id && report
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                  } disabled:opacity-50`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{type.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{type.desc}</div>
                </button>
              ))}
            </div>

            {/* 요약 카드 */}
            {reportSummary && (
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 mb-6 text-white">
                <div className="text-sm opacity-80 mb-2">📊 현재 현황</div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs opacity-70">총 자산</div>
                    <div className="text-lg font-bold">{reportSummary.totalAsset.toLocaleString()}원</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">저축률</div>
                    <div className="text-lg font-bold">{reportSummary.savingRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">월 수입</div>
                    <div className="text-sm font-medium text-green-300">+{reportSummary.monthlyIncome.toLocaleString()}원</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">월 지출</div>
                    <div className="text-sm font-medium text-red-300">-{reportSummary.monthlyExpense.toLocaleString()}원</div>
                  </div>
                </div>
              </div>
            )}

            {/* 리포트 생성 중 */}
            {isGeneratingReport && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <div className="text-sm text-gray-500 dark:text-gray-400">AI가 데이터를 분석하고 있어요...</div>
              </div>
            )}

            {/* 리포트 내용 */}
            {!isGeneratingReport && report && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-gray-900 dark:text-white text-sm leading-relaxed">
                    {report}
                  </div>
                </div>
              </div>
            )}

            {/* 초기 안내 */}
            {!report && !isGeneratingReport && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🤖</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm">
                  위 버튼을 눌러 AI 리포트를 생성해보세요!
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FooterNav />
    </div>
  );
}
