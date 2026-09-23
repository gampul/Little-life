'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Daily 상단 "오늘의 한 줄" — /api/ai/insight
 * - 처음: GET (오늘 저장본 있으면 즉시, 없으면 생성)
 * - ↻ 버튼: POST force
 * - refreshSignal 이 바뀌면(루틴 체크·체중 기록) 잠시 모았다가 POST force
 */
export default function TodayInsight({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const firstSignal = useRef(refreshSignal);

  const load = useCallback(async (force: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const res = await fetch('/api/ai/insight', force
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) }
        : { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'fail');
      setText(data.text);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // 루틴 체크·체중 기록 직후: 연속 입력을 모아서 한 번만 (4초)
  useEffect(() => {
    if (refreshSignal === firstSignal.current) return;
    const t = window.setTimeout(() => load(true), 4000);
    return () => window.clearTimeout(t);
  }, [refreshSignal, load]);

  if (failed && !text) return null;

  return (
    <div className="mt-3 flex items-start gap-2" aria-live="polite">
      <span aria-hidden className="shrink-0 mt-[3px] text-[13px] leading-none">✨</span>
      <div className="min-w-0 flex-1">
        {text ? (
          <p className={`text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 transition-opacity ${loading ? 'opacity-50' : ''}`}>
            {text}
          </p>
        ) : (
          <div className="space-y-1.5 py-0.5" aria-label="AI 문구를 만드는 중">
            <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700 animate-pulse w-11/12" />
            <div className="h-3 rounded bg-gray-200/80 dark:bg-gray-700 animate-pulse w-2/3" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => load(true)}
        disabled={loading}
        aria-label="문구 다시 만들기"
        title="다시 만들기"
        className="shrink-0 -mr-1 w-7 h-7 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={loading ? 'animate-spin' : ''}
        >
          <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
          <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
        </svg>
      </button>
    </div>
  );
}
