'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

type MonthPlan = { month: string; count: number; chars: number };
type MonthSummary = { month: string; count: number; summary: string };

export type ArchiveResult = {
  report: string;
  period: { from: string; to: string };
  category: string | null;
  total: number;
  months: number;
  saved: any;
  saveError: string | null;
};

type RangeKey = 'all' | 'year' | '12m' | 'custom';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 전체 글 분석 옵션 + 진행 상태.
 * plan → 월별 요약(순차) → final 을 클라이언트가 이어서 호출한다.
 */
export function ArchivePanel({
  onDone,
  onError,
  running,
  setRunning,
}: {
  onDone: (r: ArchiveResult) => void;
  onError: (msg: string) => void;
  running: boolean;
  setRunning: (v: boolean) => void;
}) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('');
  const [range, setRange] = useState<RangeKey>('year');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase
      .from('memo_categories')
      .select('name, sort_order')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const names = Array.from(new Set((data || []).map((c: any) => c.name).filter(Boolean))) as string[];
        setCategories(names);
      });
  }, []);

  const resolveRange = (): { from?: string; to?: string } => {
    const t = todayStr();
    if (range === 'all') return {};
    if (range === 'year') return { from: `${t.slice(0, 4)}-01-01`, to: t };
    if (range === '12m') {
      const d = new Date();
      d.setMonth(d.getMonth() - 11, 1);
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: t };
    }
    return { from: from || undefined, to: to || undefined };
  };

  const post = async (payload: any) => {
    const res = await fetch('/api/ai/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  const start = async () => {
    if (running) return;
    setRunning(true);
    setProgress({ done: 0, total: 0, label: '글 목록을 세는 중…' });
    try {
      const r = resolveRange();
      const cat = category || null;
      const plan = await post({ step: 'plan', category: cat, ...r });
      const months: MonthPlan[] = plan.months || [];
      if (months.length === 0) throw new Error('해당 조건에 글이 없어요.');

      const summaries: MonthSummary[] = [];
      for (let i = 0; i < months.length; i++) {
        const m = months[i];
        setProgress({ done: i, total: months.length + 1, label: `${m.month.slice(0, 4)}년 ${Number(m.month.slice(5))}월 (${m.count}편) 읽는 중…` });
        const res = await post({ step: 'month', month: m.month, category: cat });
        if (res.summary) summaries.push({ month: m.month, count: res.count, summary: res.summary });
      }
      setProgress({ done: months.length, total: months.length + 1, label: `${months.length}개월 요약을 하나로 엮는 중…` });
      const fin = await post({ step: 'final', category: cat, from: plan.from, to: plan.to, months: summaries });
      onDone({
        report: fin.report,
        period: fin.period,
        category: fin.category ?? cat,
        total: fin.total,
        months: fin.months,
        saved: fin.saved,
        saveError: fin.saveError ?? null,
      });
    } catch (e: any) {
      onError(e.message || '전체 글 분석 중 오류가 발생했어요.');
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const RANGE_OPTS: { key: RangeKey; label: string }[] = [
    { key: 'year', label: '올해' },
    { key: '12m', label: '최근 12개월' },
    { key: 'all', label: '전체' },
    { key: 'custom', label: '직접 선택' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-4">
      <div className="text-[13px] font-semibold text-gray-900 dark:text-white mb-3">📚 전체 글 분석 — 어떤 글을 볼까요?</div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">카테고리</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={running}
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
          >
            <option value="">전체 카테고리</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">기간</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {RANGE_OPTS.map((o) => (
              <button
                key={o.key}
                type="button"
                disabled={running}
                onClick={() => setRange(o.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  range === o.key
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {range === 'custom' && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">시작</span>
            <input type="date" value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} disabled={running}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">끝</span>
            <input type="date" value={to} min={from || undefined} max={todayStr()} onChange={(e) => setTo(e.target.value)} disabled={running}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm" />
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={running || (range === 'custom' && (!from || !to))}
          className="text-sm px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white transition-colors disabled:cursor-not-allowed"
        >
          {running ? '분석 중…' : '분석 시작'}
        </button>
        <div className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
          글이 많으면 달마다 읽어서 합치기 때문에 1~2분 걸릴 수 있어요. (36개월 이하)
        </div>
      </div>

      {progress && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mb-1">
            <span>{progress.label}</span>
            {progress.total > 0 && <span>{progress.done}/{progress.total}</span>}
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : '5%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
