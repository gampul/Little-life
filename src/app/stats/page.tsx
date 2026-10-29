'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStatsYear, financeKeys } from '../../lib/financeQueries';
import { Cell, Pie, PieChart, ResponsiveContainer, type PieLabelRenderProps } from 'recharts';
import { IconChevronDown, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { AuthGuard } from '../components/AuthGuard';
import { useAuth } from '../components/AuthProvider';
import { APP_HORIZONTAL_CONTAINER } from '../components/container';
import { categoryIcon, toKst, won } from '../ledger/ledgerUtils';

type Mode = 'month' | 'year';
type Kind = 'expense' | 'income';

interface Row {
  date: string;
  transaction_type: string;
  category: string | null;
  sub_category: string | null;
  amount: number;
  asset?: string | null;
  memo?: string | null;
}

interface Tx {
  month: number; // 1-12 (KST)
  kind: Kind;
  category: string;
  sub: string;
  amount: number;
  date: string;
  label: string;
}

interface CatStat {
  name: string;
  total: number;
  count: number;
  subs: { name: string; total: number; count: number; items: Tx[] }[];
}

/** 큰 항목부터 빨강 → 주황 → 노랑 → 연두 → 초록 → 청록 → 파랑 → 보라 */
const PALETTE = [
  '#f8695c', '#fb914b', '#fdcb47', '#f7e23e', '#c9e64a', '#6fd06b',
  '#4fdfd1', '#58b6f0', '#7a8cf2', '#a77af0', '#d77ae0', '#f07aa8',
];
const colorAt = (i: number) => PALETTE[i % PALETTE.length];

function toTx(r: Row): Tx | null {
  const kind: Kind | null = r.transaction_type === '지출' ? 'expense' : r.transaction_type === '수입' ? 'income' : null;
  if (!kind) return null; // 자산이체 제외
  return {
    month: toKst(r.date).getUTCMonth() + 1,
    kind,
    category: (r.category || '미분류').trim(),
    sub: (r.sub_category || '').trim(),
    amount: Number(r.amount) || 0,
    date: r.date,
    label: (r.memo || '').trim() || (r.asset || '').trim() || '-',
  };
}

function groupByCategory(list: Tx[]): CatStat[] {
  const map = new Map<string, { total: number; count: number; subs: Map<string, { total: number; count: number; items: Tx[] }> }>();
  for (const t of list) {
    let c = map.get(t.category);
    if (!c) { c = { total: 0, count: 0, subs: new Map() }; map.set(t.category, c); }
    c.total += t.amount;
    c.count += 1;
    const key = t.sub || '기타';
    const s = c.subs.get(key) ?? { total: 0, count: 0, items: [] };
    s.total += t.amount;
    s.count += 1;
    s.items.push(t);
    c.subs.set(key, s);
  }
  return [...map.entries()]
    .map(([name, c]) => ({
      name,
      total: c.total,
      count: c.count,
      subs: [...c.subs.entries()]
        .map(([n, s]) => ({ name: n, ...s, items: [...s.items].sort((a, b) => (a.date < b.date ? 1 : -1)) }))
        .sort((a, b) => b.total - a.total),
    }))
    .sort((a, b) => b.total - a.total);
}

const RAD = Math.PI / 180;
const OUTER_R = 88;
const LABEL_MIN_PCT = 0.025; // 2.5% 미만 조각은 라벨 생략
const LABEL_GAP = 32; // 라벨 사이 최소 세로 간격(px)

interface LabelPos {
  /** 조각 바깥 끝 (중심 기준) */
  ex: number; ey: number;
  /** 라벨 위치 (중심 기준) */
  lx: number; ly: number;
  right: boolean;
  name: string;
  pct: number;
}

/**
 * 조각 라벨 위치 계산 — 좌우로 나눠 세로로 겹치지 않게 밀어냄.
 * 그래프는 12시에서 시계 방향 (startAngle 90 → endAngle -270).
 */
function layoutLabels(items: { name: string; value: number }[], total: number, halfH: number): Map<number, LabelPos> {
  const out = new Map<number, LabelPos>();
  if (total <= 0) return out;
  const left: { i: number; pos: LabelPos }[] = [];
  const right: { i: number; pos: LabelPos }[] = [];
  let cum = 0;
  items.forEach((it, i) => {
    const frac = it.value / total;
    const mid = 90 - 360 * (cum + frac / 2);
    cum += frac;
    if (frac < LABEL_MIN_PCT) return;
    const cos = Math.cos(-mid * RAD);
    const sin = Math.sin(-mid * RAD);
    const isRight = cos >= 0;
    const pos: LabelPos = {
      ex: OUTER_R * cos, ey: OUTER_R * sin,
      lx: (OUTER_R + 22) * cos + (isRight ? 10 : -10), ly: (OUTER_R + 22) * sin,
      right: isRight, name: it.name, pct: frac,
    };
    (isRight ? right : left).push({ i, pos });
  });
  for (const side of [left, right]) {
    side.sort((a, b) => a.pos.ly - b.pos.ly);
    // 위에서 아래로 간격 확보
    for (let k = 1; k < side.length; k++) {
      const prev = side[k - 1].pos.ly;
      if (side[k].pos.ly < prev + LABEL_GAP) side[k].pos.ly = prev + LABEL_GAP;
    }
    // 아래로 넘치면 위로 되밀기
    const limit = halfH - 16;
    for (let k = side.length - 1; k >= 0; k--) {
      const maxY = k === side.length - 1 ? limit : side[k + 1].pos.ly - LABEL_GAP;
      if (side[k].pos.ly > maxY) side[k].pos.ly = maxY;
    }
    for (const { i, pos } of side) {
      // 세로로 밀린 만큼 가로도 바깥으로 살짝
      const r = Math.sqrt(pos.ex * pos.ex + pos.ey * pos.ey);
      if (Math.abs(pos.ly) > r) pos.lx = (pos.right ? 1 : -1) * Math.max(Math.abs(pos.lx), OUTER_R * 0.6);
      out.set(i, pos);
    }
  }
  return out;
}

export default function StatsPage() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const now = toKst(new Date().toISOString());
  const [mode, setMode] = useState<Mode>('month');
  const [kind, setKind] = useState<Kind>('expense');
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [modeMenu, setModeMenu] = useState(false);

  // 연 단위로 불러와 캐시 (월간·연간 모두 같은 데이터, 다시 열면 바로 표시)
  const yearQ = useQuery({
    queryKey: financeKeys.statsYear(userId ?? '', year),
    queryFn: () => fetchStatsYear(userId!, year),
    enabled: !!userId,
  });
  const error = yearQ.error ? (yearQ.error instanceof Error ? yearQ.error.message : '불러오지 못했습니다.') : null;
  useEffect(() => { setOpenCat(null); }, [mode, kind, year, month]);

  const yearTx = useMemo(
    () => (yearQ.data ? yearQ.data.map((r) => toTx(r as Row)).filter((t): t is Tx => !!t) : undefined),
    [yearQ.data]
  );
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
    return { income, expense };
  }, [periodTx]);

  const cats = useMemo(() => groupByCategory(periodTx.filter((t) => t.kind === kind)), [periodTx, kind]);
  const kindTotal = kind === 'income' ? totals.income : totals.expense;
  const pieData = useMemo(() => cats.map((c) => ({ name: c.name, value: c.total })), [cats]);
  const labelPos = useMemo(() => layoutLabels(pieData, kindTotal, 150), [pieData, kindTotal]);

  const step = (dir: -1 | 1) => {
    if (mode === 'year') { setYear((y) => y + dir); return; }
    let m = month + dir, y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const loading = !yearTx && !error;
  const periodLabel = mode === 'year' ? `${year}년` : `${year}년 ${month}월`;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-28">

        {/* 상단 고정: 기간 · 월간/연간 · 수입/지출 탭 */}
        <div className="sticky top-16 z-40 bg-[rgb(254,252,247)]/95 dark:bg-gray-900/95 backdrop-blur">
          <div className={APP_HORIZONTAL_CONTAINER}>
            <div className="flex items-center gap-1 pt-2 pb-1">
              <button type="button" onClick={() => step(-1)} className="flex h-9 w-8 items-center justify-center text-gray-600 dark:text-gray-300" aria-label="이전">
                <IconChevronLeft size={20} />
              </button>
              <span className="min-w-[104px] text-center text-[17px] font-semibold tabular-nums text-gray-900 dark:text-white">{periodLabel}</span>
              <button type="button" onClick={() => step(1)} className="flex h-9 w-8 items-center justify-center text-gray-600 dark:text-gray-300" aria-label="다음">
                <IconChevronRight size={20} />
              </button>
              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setModeMenu((v) => !v)}
                  className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-800 dark:text-gray-100"
                  aria-haspopup="listbox"
                  aria-expanded={modeMenu}
                >
                  {mode === 'month' ? '월간' : '연간'}
                  <IconChevronDown size={14} />
                </button>
                {modeMenu && (
                  <ul role="listbox" className="absolute right-0 mt-1 w-24 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-10">
                    {(['month', 'year'] as Mode[]).map((m) => (
                      <li key={m}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={mode === m}
                          onClick={() => { setMode(m); setModeMenu(false); }}
                          className={`w-full px-3 py-2 text-left text-sm ${mode === m ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'} hover:bg-gray-50 dark:hover:bg-gray-700`}
                        >
                          {m === 'month' ? '월간' : '연간'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700" role="tablist">
              {(['income', 'expense'] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={`relative py-3 text-[15px] ${kind === k ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-400'}`}
                >
                  {k === 'income' ? '수입' : '지출'}
                  <span className="ml-2 tabular-nums">{loading ? '—' : `${won(k === 'income' ? totals.income : totals.expense)}원`}</span>
                  {kind === k && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-red-500" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <main className={APP_HORIZONTAL_CONTAINER}>
          {error && <div className="mt-3 rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600">{error}</div>}

          {loading ? (
            <div className="py-6">
              <div className="mx-auto h-56 w-56 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="mt-6 space-y-2">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />)}
              </div>
            </div>
          ) : cats.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400">
              {periodLabel} {kind === 'expense' ? '지출' : '수입'} 기록이 없어요
            </div>
          ) : (
            <>
              {/* 원형 그래프 */}
              <div className="h-[300px] border-b border-gray-200 dark:border-gray-700">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={OUTER_R}
                      startAngle={90}
                      endAngle={-270}
                      stroke="rgb(254,252,247)"
                      strokeWidth={cats.length > 1 ? 1 : 0}
                      isAnimationActive={false}
                      labelLine={false}
                      label={(props: PieLabelRenderProps) => {
                        const pos = labelPos.get(Number(props.index));
                        if (!pos) return null;
                        const cx = Number(props.cx) || 0;
                        const cy = Number(props.cy) || 0;
                        // 라벨이 그래프 영역 밖으로 잘리지 않게 (글자 폭 대략 추정)
                        const estW = [...`${pos.name}`].length * 12.5 + 22;
                        const rawX = cx + pos.lx;
                        const x = pos.right ? Math.min(rawX, cx * 2 - estW - 2) : Math.max(rawX, estW + 2);
                        const y = cy + pos.ly;
                        const elbowX = x + (pos.right ? -8 : 8);
                        const color = colorAt(Number(props.index));
                        return (
                          <g>
                            <path
                              d={`M${cx + pos.ex},${cy + pos.ey}L${elbowX},${y}L${x - (pos.right ? 2 : -2)},${y}`}
                              stroke={color}
                              strokeWidth={1.2}
                              fill="none"
                            />
                            <text x={x} y={y} textAnchor={pos.right ? 'start' : 'end'} className="fill-gray-800 dark:fill-gray-100">
                              <tspan x={x} dy="-0.15em" fontSize={12} fontWeight={600}>{`${categoryIcon(pos.name)} ${pos.name}`}</tspan>
                              <tspan x={x} dy="1.25em" fontSize={11} className="fill-gray-500 dark:fill-gray-400">{`${(pos.pct * 100).toFixed(1)} %`}</tspan>
                            </text>
                          </g>
                        );
                      }}
                      onClick={(d: { name?: string }) => d?.name && setOpenCat((o) => (o === d.name ? null : d.name!))}
                    >
                      {cats.map((c, i) => <Cell key={c.name} fill={colorAt(i)} style={{ cursor: 'pointer' }} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* 항목 목록 */}
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {cats.map((c, i) => {
                  const pct = kindTotal > 0 ? (c.total / kindTotal) * 100 : 0;
                  const open = openCat === c.name;
                  return (
                    <li key={c.name}>
                      <button
                        type="button"
                        onClick={() => setOpenCat(open ? null : c.name)}
                        className="flex w-full items-center gap-3 px-1 py-3.5 text-left"
                        aria-expanded={open}
                      >
                        <span
                          className="w-12 shrink-0 rounded-md py-1 text-center text-[13px] font-medium tabular-nums text-gray-900"
                          style={{ backgroundColor: colorAt(i) }}
                        >
                          {pct >= 1 ? Math.round(pct) : pct.toFixed(1)}%
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[15px] text-gray-900 dark:text-gray-100">
                          <span className="mr-1">{categoryIcon(c.name)}</span>
                          {c.name}
                        </span>
                        <span className="shrink-0 text-[15px] tabular-nums text-gray-900 dark:text-gray-100">{won(c.total)}원</span>
                      </button>
                      {open && (
                        <ul className="mb-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-1.5">
                          {c.subs.map((s) => {
                            // 세부 분류가 하나뿐이면 바로 펼침
                            const subKey = `${c.name}|${s.name}`;
                            const subOpen = c.subs.length === 1 || openSub === subKey;
                            return (
                              <li key={s.name} className="py-0.5">
                                <button
                                  type="button"
                                  onClick={() => setOpenSub(openSub === subKey ? null : subKey)}
                                  aria-expanded={subOpen}
                                  className="flex w-full items-baseline justify-between gap-2 py-1 text-left text-[13px]"
                                >
                                  <span className="min-w-0 truncate text-gray-600 dark:text-gray-300">
                                    {s.name}
                                    <span className="ml-1.5 text-[11px] text-gray-400">{s.count}건</span>
                                  </span>
                                  <span className="shrink-0 tabular-nums text-gray-700 dark:text-gray-200">{won(s.total)}원</span>
                                </button>
                                {subOpen && (
                                  <ul className="mb-1 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                                    {s.items.map((t, idx) => {
                                      const k = toKst(t.date);
                                      return (
                                        <li key={`${t.date}-${idx}`} className="flex items-baseline gap-2 py-0.5 text-[12px]">
                                          <span className="shrink-0 tabular-nums text-gray-400">
                                            {String(k.getUTCMonth() + 1).padStart(2, '0')}.{String(k.getUTCDate()).padStart(2, '0')}
                                          </span>
                                          <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">{t.label}</span>
                                          <span className="shrink-0 tabular-nums text-gray-600 dark:text-gray-300">{won(t.amount)}원</span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-gray-400">자산 간 이체는 통계에서 빠져요. 항목을 누르면 세부 분류가, 세부 분류를 누르면 전체 내역이 보여요.</p>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
