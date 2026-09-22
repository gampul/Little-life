'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Status = { total: number; indexed: number; pending: number; setupMissing: boolean };

/**
 * Diary 의미검색 색인 현황 + 수동 색인 버튼.
 * /api/ai/embed 를 pending=0 이 될 때까지 배치(10개)로 반복 호출한다.
 */
export function DiaryIndexCard({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processedThisRun, setProcessedThisRun] = useState(0);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/embed', { cache: 'no-store' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStatus({ total: data.total ?? 0, indexed: data.indexed ?? 0, pending: data.pending ?? 0, setupMissing: !!data.setupMissing });
      setError(null);
    } catch (e: any) {
      setError(e.message || '색인 현황을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setProcessedThisRun(0);
    stopRef.current = false;
    try {
      for (let i = 0; i < 200 && !stopRef.current; i++) {
        const res = await fetch('/api/ai/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'pending', batch: 10 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setProcessedThisRun((n) => n + (data.processed || 0));
        setStatus({ total: data.total, indexed: data.indexed, pending: data.pending, setupMissing: false });
        if (data.done || data.pending === 0) break;
        if (data.processed === 0) throw new Error(`일부 글을 색인하지 못했어요 (${(data.failed || []).length}개). 잠시 후 다시 시도해 주세요.`);
      }
    } catch (e: any) {
      setError(e.message || '색인 중 오류가 발생했어요.');
    } finally {
      setRunning(false);
      load();
    }
  };

  if (!status && !error) return null;

  const pct = status && status.total > 0 ? Math.round((status.indexed / status.total) * 100) : 0;

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${compact ? 'px-3 py-2' : 'p-4'}`}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-gray-900 dark:text-white">🔎 일기 의미검색 색인</span>
            {status?.setupMissing && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">설정 필요</span>
            )}
          </div>
          {status?.setupMissing ? (
            <div className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-snug">
              Supabase SQL Editor 에서 <code>add_memo_embeddings.sql</code> 을 실행하면 "회사 옮길까" 처럼 표현이 달라도 찾는 의미 검색이 켜져요.
            </div>
          ) : status ? (
            <>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {status.indexed}/{status.total}개 색인됨
                {status.pending > 0 ? ` · ${status.pending}개 대기` : ' · 최신 상태'}
                {running && processedThisRun > 0 && ` · 이번에 ${processedThisRun}개 처리`}
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : null}
          {error && <div className="text-[11px] text-red-600 dark:text-red-400 mt-1">{error}</div>}
        </div>
        {!status?.setupMissing && (
          <button
            type="button"
            onClick={running ? () => (stopRef.current = true) : run}
            disabled={!running && (!status || status.pending === 0)}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 dark:disabled:bg-gray-700 disabled:text-gray-400 text-white transition-colors"
          >
            {running ? '중지' : status && status.pending > 0 ? '색인하기' : '완료'}
          </button>
        )}
      </div>
    </div>
  );
}
