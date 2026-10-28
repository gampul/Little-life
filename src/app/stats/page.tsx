'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { useAuth } from '../components/AuthProvider';
import { APP_HORIZONTAL_CONTAINER } from '../components/container';
import { getSupabase } from '../../lib/supabase';

type Mode = 'month' | 'year';
type Kind = 'expense' | 'income';

interface Row {
  date: string;
  transaction_type: string;
  category: string | null;
  sub_category: string | null;
  amount: number;
}

interface Tx {
  year: number;
  month: number; // 1-12 (KST)
  kind: Kind;
  category: string;
  sub: string;
  amount: number;
}

const KST_OFFSET = 9 * 60 * 60 * 1000;
const won = (n: number) => new Intl.NumberFormat('ko-KR').format(Math.round(n));

/** 1억 이상은 억, 1만 이상은 만 단위로 짧게 */
function shortWon(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(a >= 1e9 ? 0 : 1).replace(/\.0$/, '')}억`;
  if (a >= 1e4) return `${Math.round(n / 1e4).toLocaleString('ko-KR')}만`;
  return won(n);
}

function toTx(r: Row): Tx | null {
  const kind: Kind | null = r.transaction_type === '지출' ? 'expense' : r.transaction_type === '수입' ? 'income' : null;
  if (!kind) return null; // 자산이체 제외
  const d = new Date(new Date(r.date).getTime() + KST_OFFSET);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    kind,
    category: (r.category || '미분류').trim(),
    sub: (r.sub_category || '').trim(),
    amount: Number(r.amount) || 0,
  };
}

interface CatStat {
  name: string;
  total: number;
  count: number;
  subs: { name: string; total: number; count: number }[];
}

function groupByCategory(list: Tx[]): CatStat[] {
  const map = new Map<string, { total: number; count: number; subs: Map<string, { total: number; count: number }> }>();
  for (const t of list) {
    let c = map.get(t.category);
    if (!c) { c = { total: 0, count: 0, subs: new Map() }; map.set(t.category, c); }
    c.total += t.amount;
    c.count += 1;
    const key = t.sub || '기타';
    const s = c.subs.get(key) ?? { total: 0, count: 0 };
    s.total += t.amount;
    s.count += 1;
    c.subs.set(key, s);
  }
  return [...map.entries()]
    .map(([name, c]) => ({
      name,
      total: c.total,
      count: c.count,
      subs: [...c.subs.entries()].map(([n, s]) => ({ name: n, ...s })).sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

export default function StatsPage() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [mode, setMode] = useState<Mode>('month');
  const [kind, setKind] = useState<Kind>('expense');
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number>(1);
  const [cache, setCache] = useState<Record<number, Tx[]>>({});
  const inflight = useRef<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);

  // 처음 열 때: 기록이 있는 가장 최근 달 (없으면 이번 달)
  useEffect(() => {
    if (!supabase || !userId || year !== null) return;
    (async () => {
      const now = new Date(Date.now() + KST_OFFSET);
      let y = now.getUTCFullYear();
      let m = now.getUTCMonth() + 1;
      const { data } = await supabase
        .from('transactions')
        .select('date')
        .eq('user_id', userId)
        .in('transaction_type', ['수입', '지출'])
        .lte('date', new Date().toISOString())
        .order('date', { ascending: false })
        .limit(1);
      if (data && data[0]) {
        const d = new Date(new Date(data[0].date).getTime() + KST_OFFSET);
        y = d.getUTCFullYear();
        m = d.getUTCMonth() + 1;
      }
      setMonth(m);
      setYear(y);
    })();
  }, [supabase, userId, year]);

  // 연 단위로 불러와 캐시 (월간·연간 모두 같은 데이터 사용)
  const loadYear = useCallback(async (y: number) => {
    if (!supabase || !userId || cache[y] || inflight.current.has(y)) return;
    inflight.current.add(y);
    setError(null);
    try {
      const from = `${y}-01-01T00:00:00+09:00`;
      const to = `${y + 1}-01-01T00:00:00+09:00`;
      const all: Tx[] = [];
      const PAGE = 1000;
      for (let off = 0; ; off += PAGE) {
        const { data, error: err } = await supabase
          .from('transactions')
          .select('date, transaction_type, category, sub_category, amount')
          .eq('user_id', userId)
          .in('transaction_type', ['수입', '지출'])
          .gte('date', from)
          .lt('date', to)
          .order('date', { ascending: true })
          .range(off, off + PAGE - 1);
        if (err) throw err;
        for (const r of (data ?? []) as Row[]) {
          const t = toTx(r);
          if (t) all.push(t);
        }
        if (!data || data.length < PAGE) break;
      }
      setCache((c) => ({ ...c, [y]: all }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      inflight.current.delete(y);
    }
  }, [supabase, userId, cache]);

  useEffect(() => {
    if (year === null) return;
    loadYear(year);
    // 전년·전월(1월) 비교용
    if (mode === 'year' || month === 1) loadYear(year - 1);
  }, [year, month, mode, loadYear]);

  useEffect(() => { setOpenCat(null); }, [mode, kind, year, month]);

  const yearTx = useMemo(() => (year !== null ? cache[year] : undefined), [cache, year]);
  const periodTx = useMemo(
    () => (yearTx ? (mode === 'year' ? yearTx : yearTx.filter((t) => t.month === month)) : []),
    [yearTx, mode, month]
  );

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of periodTx) {
      if (t.kind === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }, [periodTx]);

  // 지난 기간 대비 (월간: 전월, 연간: 전년 — 전년은 캐시에 있을 때만)
  const prevTotal = useMemo(() => {
    if (year === null) return null;
    let list: Tx[] | undefined;
    if (mode === 'month') {
      list = month === 1 ? cache[year - 1]?.filter((t) => t.month === 12) : yearTx?.filter((t) => t.month === month - 1);
    } else {
      list = cache[year - 1];
    }
    if (!list) return null;
    return list.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0);
  }, [cache, yearTx, year, month, mode, kind]);

  const cats = useMemo(() => groupByCategory(periodTx.filter((t) => t.kind === kind)), [periodTx, kind]);
  const kindTotal = kind === 'income' ? totals.income : totals.expense;

  const monthly = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => ({ m: i + 1, label: `${i + 1}`, income: 0, expense: 0 }));
    for (const t of yearTx ?? []) arr[t.month - 1][t.kind] += t.amount;
    return arr;
  }, [yearTx]);

  const step = (dir: -1 | 1) => {
    if (year === null) return;
    if (mode === 'year') { setYear(year + dir); return; }
    let m = month + dir, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const loading = year === null || (!yearTx && !error);
  const periodLabel = year === null ? '' : mode === 'year' ? `${year}년` : `${year}년 ${month}월`;
  const accent = kind === 'expense' ? 'bg-rose-500' : 'bg-emerald-500';
  const accentText = kind === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-24">
        <GlobalNav />
        <main className={`${APP_HORIZONTAL_CONTAINER} pt-4 sm:pt-6 max-[539px]:!pr-[3.75rem]`}>
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">통계</h1>
            <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 text-xs font-semibold">
              {(['month', 'year'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-md px-3 py-1.5 transition ${
                    mode === m ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {m === 'month' ? '월간' : '연간'}
                </button>
              ))}
            </div>
          </div>

          {/* 기간 이동 */}
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => step(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="이전">
              <IconChevronLeft size={20} />
            </button>
            <div className="text-base font-bold text-gray-900 dark:text-white tabular-nums">{periodLabel}</div>
            <button type="button" onClick={() => step(1)} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="다음">
              <IconChevronRight size={20} />
            </button>
          </div>

          {error && <div className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600">{error}</div>}

          {/* 합계 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '수입', value: totals.income, cls: 'text-emerald-600 dark:text-emerald-400', k: 'income' as Kind },
              { label: '지출', value: totals.expense, cls: 'text-rose-600 dark:text-rose-400', k: 'expense' as Kind },
              { label: '수입 − 지출', value: totals.net, cls: totals.net >= 0 ? 'text-gray-900 dark:text-white' : 'text-rose-600 dark:text-rose-400', k: null },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                disabled={!c.k}
                onClick={() => c.k && setKind(c.k)}
                className={`rounded-xl border bg-white dark:bg-gray-800 p-3 text-left transition ${
                  c.k && kind === c.k ? 'border-gray-900 dark:border-gray-300' : 'border-gray-100 dark:border-gray-700'
                }`}
              >
                <div className="text-[11px] text-gray-500 dark:text-gray-400">{c.label}</div>
                <div className={`mt-0.5 text-[15px] font-bold tabular-nums ${c.cls}`}>
                  {loading ? '—' : shortWon(c.value)}
                </div>
              </button>
            ))}
          </div>

          {/* 연간: 월별 막대 */}
          {mode === 'year' && (
            <div className="mt-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>월별 {kind === 'expense' ? '지출' : '수입'} · 막대를 누르면 그 달로</span>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} interval={0} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => shortWon(Number(v))} width={44} />
                    <Tooltip
                      cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                      formatter={(v) => [`${won(Number(v))}원`, kind === 'expense' ? '지출' : '수입']}
                      labelFormatter={(l) => `${l}월`}
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    />
                    <Bar
                      dataKey={kind}
                      fill={kind === 'expense' ? '#f43f5e' : '#10b981'}
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                      onClick={(d: { payload?: { m?: number } }) => {
                        const m = d?.payload?.m;
                        if (m) { setMonth(m); setMode('month'); }
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 항목별 */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="grid grid-cols-2 gap-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5 text-xs font-semibold">
                {(['expense', 'income'] as Kind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`rounded-md px-3 py-1.5 transition ${
                      kind === k ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {k === 'expense' ? '지출' : '수입'} 항목
                  </button>
                ))}
              </div>
              {prevTotal !== null && !loading && (prevTotal > 0 || kindTotal > 0) && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                  {mode === 'month' ? '전월' : '전년'} 대비{' '}
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {kindTotal >= prevTotal ? '+' : '−'}{shortWon(Math.abs(kindTotal - prevTotal))}
                  </span>
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />)}
              </div>
            ) : cats.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 py-10 text-center text-sm text-gray-400">
                {periodLabel} {kind === 'expense' ? '지출' : '수입'} 기록이 없어요
              </div>
            ) : (
              <ul className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {cats.map((c) => {
                  const pct = kindTotal > 0 ? (c.total / kindTotal) * 100 : 0;
                  const open = openCat === c.name;
                  return (
                    <li key={c.name}>
                      <button
                        type="button"
                        onClick={() => setOpenCat(open ? null : c.name)}
                        className="w-full px-3.5 py-3 text-left"
                        aria-expanded={open}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate text-sm font-medium text-gray-900 dark:text-white">
                            {c.name}
                            <span className="ml-1.5 text-[11px] font-normal text-gray-400">{c.count}건</span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                            {won(c.total)}원
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                            <div className={`h-full rounded-full ${accent}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                          </div>
                          <span className={`w-10 text-right text-[11px] font-semibold tabular-nums ${accentText}`}>
                            {pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%
                          </span>
                          <IconChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>
                      {open && (
                        <ul className="bg-gray-50 dark:bg-gray-900/40 px-3.5 py-2">
                          {c.subs.map((s) => (
                            <li key={s.name} className="flex items-baseline justify-between py-1 text-[13px]">
                              <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">
                                {s.name}
                                <span className="ml-1.5 text-[11px] text-gray-400">{s.count}건</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-gray-700 dark:text-gray-200">{won(s.total)}원</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-gray-400">자산 간 이체는 통계에서 빠져요.</p>
          </div>
        </main>
        <FooterNav />
      </div>
    </AuthGuard>
  );
}
