'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Daily 상단 "오늘의 한 줄" — /api/ai/insight
 * - 처음: GET (오늘 저장본 있으면 즉시, 없으면 생성)
 * - ↻ 버튼: POST force
 * - refreshSignal 이 바뀌면(루틴 체크·체중 기록) 잠시 모았다가 POST force
 */
const CACHE_KEY = 'little-life:today-insight';

/** KST 오늘 YYYY-MM-DD */
function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readCache(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { date?: string; text?: string };
    return v.date === kstToday() && v.text ? v.text : null;
  } catch {
    return null;
  }
}

function writeCache(text: string) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ date: kstToday(), text })); } catch {}
}

export default function TodayInsight({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const firstSignal = useRef(refreshSignal);

  /** quiet: 이미 문구가 보이는 상태에서 뒤에서만 확인 (흐려지거나 돌지 않음) */
  const load = useCallback(async (force: boolean, quiet = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/ai/insight', force
        ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) }
        : { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || 'fail');
      setText(data.text);
      writeCache(data.text);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  // 오늘 이미 받은 문구가 있으면 바로 보여 주고, 서버 확인은 뒤에서 조용히
  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setText(cached);
      setLoading(false);
      load(false, true);
    } else {
      load(false);
    }
  }, [load]);

  // 루틴 체크·체중 기록 직후: 연속 입력을 모아서 한 번만 (4초)
  useEffect(() => {
    if (refreshSignal === firstSignal.current) return;
    const t = window.setTimeout(() => load(true), 4000);
    return () => window.clearTimeout(t);
  }, [refreshSignal, load]);

  // 실패해도 자리는 유지 (갑자기 사라져 아래가 위로 튀지 않게)
  if (failed && !text) {
    return (
      <div className="mt-3 flex items-start gap-2 min-h-[42px]">
        <span aria-hidden className="shrink-0 mt-[3px] text-[13px] leading-none">✨</span>
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-400">오늘의 한 줄을 불러오지 못했어요.</p>
        <button type="button" onClick={() => load(true)} className="shrink-0 text-xs text-gray-400 hover:text-gray-600">다시</button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-start gap-2" aria-live="polite">
      <span aria-hidden className="shrink-0 mt-[3px] text-[13px] leading-none">✨</span>
      {/* 두 줄 높이를 미리 잡아 문구가 들어와도 아래 내용이 밀리지 않게 */}
      <div className="min-w-0 flex-1 min-h-[42px]">
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
