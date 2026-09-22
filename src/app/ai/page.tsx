'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { SwipeNav } from '../components/SwipeNav';
import { APP_HORIZONTAL_CONTAINER } from '../components/container';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type ReportKind = 'coach' | 'weekly' | 'monthly';

interface SavedReport {
  id: string;
  kind: ReportKind;
  period_from: string;
  period_to: string;
  content: string;
  created_at: string;
}

const REPORT_TYPES: { id: ReportKind; label: string; icon: string; desc: string }[] = [
  { id: 'coach', label: '오늘의 코칭', icon: '☀️', desc: '오늘 할 것 + 한 줄 응원' },
  { id: 'weekly', label: '주간 리포트', icon: '📈', desc: '지난 7일 루틴·체중·일기' },
  { id: 'monthly', label: '월간 리포트', icon: '🗓️', desc: '지난 30일 흐름과 제안' },
];

const KIND_LABEL: Record<ReportKind, string> = { coach: '오늘의 코칭', weekly: '주간', monthly: '월간' };

const fmtPeriod = (r: SavedReport) =>
  r.kind === 'coach' ? r.period_to.replace(/-/g, '.') : `${r.period_from.slice(5).replace('-', '.')} ~ ${r.period_to.slice(5).replace('-', '.')}`;

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'report'>('chat');
  const [report, setReport] = useState<string>('');
  const [reportType, setReportType] = useState<ReportKind>('weekly');
  const [reportMeta, setReportMeta] = useState<{ period?: { from: string; to: string }; cached?: boolean; createdAt?: string; tableMissing?: boolean } | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showHistory, setShowHistory] = useState(false);
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
        content: '안녕하세요! 👋 저는 Little Life AI 코치예요.\n\nDaily 루틴 체크, 체중, Diary 일기를 읽고 요약·분석·제안을 드릴 수 있어요. 정리된 리포트가 필요하면 위의 📊 리포트 탭을 눌러 보세요.\n\n예시 질문:\n• "이번 주 루틴 어땠어?"\n• "요즘 일기에서 내가 자주 말한 고민이 뭐야?"\n• "오늘 뭐부터 하면 좋을까?"\n• "한 달 전보다 체중이 얼마나 변했어?"',
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

  // 저장된 리포트 목록
  const loadSavedReports = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/report', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.reports)) setSavedReports(data.reports);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'report') loadSavedReports();
  }, [activeTab, loadSavedReports]);

  // 리포트 생성 (같은 기간에 이미 있으면 저장본을 보여주고, force 면 새로 생성)
  const generateReport = async (type: ReportKind, force = false) => {
    setIsGeneratingReport(true);
    setReportType(type);
    setShowHistory(false);

    try {
      const response = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType: type, force }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setReport(data.report);
      setReportMeta({
        period: data.period ?? (data.saved ? { from: data.saved.period_from, to: data.saved.period_to } : undefined),
        cached: !!data.cached,
        createdAt: data.saved?.created_at,
        tableMissing: !!data.tableMissing,
      });
      loadSavedReports();
    } catch (error: any) {
      setReport(`⚠️ 리포트 생성 중 오류가 발생했습니다: ${error.message}`);
      setReportMeta(null);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const openSaved = (r: SavedReport) => {
    setReportType(r.kind);
    setReport(r.content);
    setReportMeta({ period: { from: r.period_from, to: r.period_to }, cached: true, createdAt: r.created_at });
    setShowHistory(false);
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
    '이번 주 루틴 어땠어?',
    '오늘 뭐부터 하면 좋을까?',
    '요즘 일기 주제 정리해줘',
    '체중 추세 알려줘',
  ];

  return (
    <SwipeNav>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      <GlobalNav />

      <div className={APP_HORIZONTAL_CONTAINER}>
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
          <div className="px-4 py-5">
            {/* 리포트 타입 선택 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {REPORT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => generateReport(type.id)}
                  disabled={isGeneratingReport}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    reportType === type.id && report
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                  } disabled:opacity-50`}
                >
                  <div className="text-xl mb-1">{type.icon}</div>
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">{type.label}</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">{type.desc}</div>
                </button>
              ))}
            </div>

            {/* 지난 리포트 토글 */}
            {savedReports.length > 0 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showHistory ? '지난 리포트 접기' : `지난 리포트 ${savedReports.length}개 보기`}
                </button>
                {showHistory && (
                  <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    {savedReports.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => openSaved(r)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                            {KIND_LABEL[r.kind]}
                          </span>
                          <span className="text-sm text-gray-800 dark:text-gray-100">{fmtPeriod(r)}</span>
                          <span className="ml-auto text-[11px] text-gray-400">
                            {new Date(r.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* 리포트 생성 중 */}
            {isGeneratingReport && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <div className="text-sm text-gray-500 dark:text-gray-400">루틴·체중·일기를 읽고 있어요...</div>
              </div>
            )}

            {/* 리포트 내용 */}
            {!isGeneratingReport && report && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-gray-400 dark:text-gray-500">
                  <span>
                    {KIND_LABEL[reportType]}
                    {reportMeta?.period && ` · ${reportMeta.period.from.replace(/-/g, '.')} ~ ${reportMeta.period.to.replace(/-/g, '.')}`}
                    {reportMeta?.createdAt && ` · ${new Date(reportMeta.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 생성`}
                  </span>
                  <button
                    type="button"
                    onClick={() => generateReport(reportType, true)}
                    className="shrink-0 text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    다시 생성
                  </button>
                </div>
                {reportMeta?.tableMissing && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-[12px] text-amber-700 dark:text-amber-300">
                    리포트 저장 테이블이 아직 없어 이번 리포트는 저장되지 않았어요. <code>add_ai_reports.sql</code> 을 Supabase에서 실행하면 지난 리포트를 다시 볼 수 있어요.
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-900 dark:text-white leading-relaxed [&_table]:text-[13px] [&_h2]:text-base [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_ul]:my-2 [&_li]:my-0.5">
                  <ReactMarkdown>{report}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* 초기 안내 */}
            {!report && !isGeneratingReport && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🤖</div>
                <div className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
                  위 버튼을 누르면 Daily 루틴·체중과 Diary 일기를 읽고
                  <br />
                  요약 · 분석 · 제안을 만들어 드려요.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FooterNav />
    </div>
    </SwipeNav>
  );
}
