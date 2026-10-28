'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconPlus,
  IconSearch,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { useAuth } from '../components/AuthProvider';
import { getSupabase } from '../../lib/supabase';
import { TransactionForm, TransactionData, EditableTransaction, kstDateString } from './components/TransactionForm';
import { ExcelUpload } from './components/ExcelUpload';
import { APP_HORIZONTAL_CONTAINER } from '../components/container';
import {
  LedgerTx,
  WEEKDAYS,
  amountClass,
  categoryIcon,
  kstMonthStartIso,
  kstTimeLabel,
  kstYmd,
  toKst,
  won,
} from './ledgerUtils';

type Tab = 'daily' | 'calendar' | 'monthly';

interface Totals {
  income: number;
  expense: number;
}

function sumTotals(list: Pick<LedgerTx, 'transaction_type' | 'amount'>[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of list) {
    if (t.transaction_type === '수입') income += Number(t.amount) || 0;
    else if (t.transaction_type === '지출') expense += Number(t.amount) || 0;
  }
  return { income, expense };
}

function nowKst() {
  const k = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1 };
}

/** 수입 · 지출 · 합계 한 줄 */
function SummaryBar({ totals }: { totals: Totals }) {
  const net = totals.income - totals.expense;
  return (
    <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-700 py-2 text-center">
      <div>
        <div className="text-[12px] text-gray-500 dark:text-gray-400">수입</div>
        <div className="text-[15px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">{won(totals.income)}</div>
      </div>
      <div>
        <div className="text-[12px] text-gray-500 dark:text-gray-400">지출</div>
        <div className="text-[15px] font-semibold tabular-nums text-red-500 dark:text-red-400">{won(totals.expense)}</div>
      </div>
      <div>
        <div className="text-[12px] text-gray-500 dark:text-gray-400">합계</div>
        <div className="text-[15px] font-semibold tabular-nums text-gray-900 dark:text-white">{won(net)}</div>
      </div>
    </div>
  );
}

/** 하루 묶음: 날짜 머리 + 거래 줄들 */
function DayGroup({ ymd, items, onEdit }: { ymd: string; items: LedgerTx[]; onEdit: (t: LedgerTx) => void }) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const totals = sumTotals(items);
  const badge =
    dow === 0 ? 'bg-red-500 text-white' : dow === 6 ? 'bg-blue-500 text-white' : 'bg-gray-500 text-white dark:bg-gray-600';
  return (
    <section id={`ledger-day-${ymd}`} className="border-b-8 border-gray-100 dark:border-gray-800/70">
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-1 py-2.5">
        <span className="text-[22px] font-bold leading-none tabular-nums text-gray-900 dark:text-white">{d}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${badge}`}>{WEEKDAYS[dow]}요일</span>
        <span className="text-[12px] text-gray-400 tabular-nums">
          {y}.{String(m).padStart(2, '0')}
        </span>
        <span className="ml-auto flex gap-3 text-[13px] font-medium tabular-nums">
          <span className="text-blue-600 dark:text-blue-400">{won(totals.income)}원</span>
          <span className="text-red-500 dark:text-red-400">{won(totals.expense)}원</span>
        </span>
      </div>
      <ul>
        {items.map((t) => {
          const time = kstTimeLabel(t.date);
          const isTransfer = t.transaction_type === '자산이체';
          const title = (t.memo && t.memo.trim()) || (isTransfer ? '이체' : t.sub_category || t.category);
          const assetLine = isTransfer && t.transfer_asset ? `${t.asset} → ${t.transfer_asset}` : t.asset;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="flex w-full items-center gap-2 px-1 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <div className="w-[76px] shrink-0 min-w-0">
                  <div className="truncate text-[13px] text-gray-600 dark:text-gray-300">
                    {isTransfer ? '이체' : (
                      <>
                        <span className="mr-0.5">{categoryIcon(t.category)}</span>
                        {t.category}
                      </>
                    )}
                  </div>
                  {!isTransfer && t.sub_category && (
                    <div className="truncate text-[11px] text-gray-400">{t.sub_category}</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-gray-900 dark:text-gray-100">{title}</div>
                  <div className="truncate text-[12px] text-gray-400">
                    {time && <span className="mr-2">{time}</span>}
                    {assetLine}
                  </div>
                </div>
                <div className={`shrink-0 text-[14px] font-medium tabular-nums ${amountClass(t.transaction_type)}`}>
                  {won(t.amount)}원
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function LedgerPage() {
  const supabase = getSupabase();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const init = nowKst();
  const [year, setYear] = useState(init.year);
  const [month, setMonth] = useState(init.month);
  const [tab, setTab] = useState<Tab>('daily');

  const [monthTx, setMonthTx] = useState<LedgerTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const [yearTotals, setYearTotals] = useState<Record<number, Totals[]>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LedgerTx | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? null));
  }, [supabase]);

  // 한 달 거래 (KST 기준)
  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const from = kstMonthStartIso(year, month);
      const to = kstMonthStartIso(year, month + 1);
      const all: LedgerTx[] = [];
      const PAGE = 1000;
      for (let off = 0; ; off += PAGE) {
        const { data, error } = await supabase
          .from('transactions')
          .select('id, date, asset, category, sub_category, transaction_type, is_transfer, transfer_asset, amount, memo, created_at')
          .eq('user_id', userId)
          .gte('date', from)
          .lt('date', to)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .range(off, off + PAGE - 1);
        if (error) {
          console.error('거래 로드 오류:', error.message);
          break;
        }
        all.push(...((data ?? []) as LedgerTx[]));
        if (!data || data.length < PAGE) break;
      }
      if (!cancelled) {
        setMonthTx(all);
        setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase, userId, year, month, reloadKey]);

  // 월별 탭: 그 해 월별 합계
  useEffect(() => {
    if (tab !== 'monthly' || !supabase || !userId || yearTotals[year]) return;
    (async () => {
      const arr: Totals[] = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
      const PAGE = 1000;
      for (let off = 0; ; off += PAGE) {
        const { data, error } = await supabase
          .from('transactions')
          .select('date, transaction_type, amount')
          .eq('user_id', userId)
          .in('transaction_type', ['수입', '지출'])
          .gte('date', kstMonthStartIso(year, 1))
          .lt('date', kstMonthStartIso(year + 1, 1))
          .order('date', { ascending: true })
          .range(off, off + PAGE - 1);
        if (error) break;
        for (const r of data ?? []) {
          const mi = toKst(r.date).getUTCMonth();
          if (r.transaction_type === '수입') arr[mi].income += Number(r.amount) || 0;
          else arr[mi].expense += Number(r.amount) || 0;
        }
        if (!data || data.length < PAGE) break;
      }
      setYearTotals((p) => ({ ...p, [year]: arr }));
    })();
  }, [tab, supabase, userId, year, yearTotals]);

  const visibleTx = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return monthTx;
    return monthTx.filter((t) =>
      [t.memo, t.category, t.sub_category, t.asset, t.transfer_asset]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [monthTx, query]);

  const monthTotals = useMemo(() => sumTotals(visibleTx), [visibleTx]);

  const byDay = useMemo(() => {
    const map = new Map<string, LedgerTx[]>();
    for (const t of visibleTx) {
      const k = kstYmd(t.date);
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    return map;
  }, [visibleTx]);
  const dayKeys = useMemo(() => [...byDay.keys()].sort((a, b) => (a < b ? 1 : -1)), [byDay]);

  const step = (dir: -1 | 1) => {
    setSelectedDay(null);
    if (tab === 'monthly') { setYear((y) => y + dir); return; }
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const invalidate = () => {
    setReloadKey((k) => k + 1);
    setYearTotals({});
  };

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleSubmit = async (data: TransactionData) => {
    if (!supabase || !userId) throw new Error('로그인이 필요합니다');
    const today = kstDateString();
    let dateIso: string;
    if (editing) {
      if (kstYmd(editing.date) === data.date) {
        dateIso = editing.date; // 날짜 그대로면 시각 유지
      } else {
        const hms = toKst(editing.date).toISOString().slice(11, 19);
        dateIso = new Date(`${data.date}T${hms}+09:00`).toISOString();
      }
    } else {
      dateIso = data.date === today ? new Date().toISOString() : new Date(`${data.date}T00:00:00+09:00`).toISOString();
    }
    const row = {
      date: dateIso,
      amount: data.amount,
      transaction_type: data.transaction_type,
      is_transfer: data.is_transfer,
      asset: data.asset,
      transfer_asset: data.transfer_asset || null,
      category: data.category,
      sub_category: data.sub_category || null,
      memo: data.memo || null,
    };
    if (editing) {
      const { error } = await supabase.from('transactions').update(row).eq('id', editing.id).eq('user_id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('transactions')
        .insert({ ...row, user_id: userId, currency: 'KRW', source: 'app' });
      if (error) throw error;
    }
    invalidate();
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !userId) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', userId);
    if (error) throw error;
    invalidate();
  };

  // 전체 거래내역 CSV 다운로드
  const handleDownload = async () => {
    if (!supabase || !userId) return;
    const all: LedgerTx[] = [];
    for (let off = 0; ; off += 1000) {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .range(off, off + 999);
      if (error) { alert('다운로드 중 오류가 발생했습니다.'); return; }
      all.push(...((data ?? []) as LedgerTx[]));
      if (!data || data.length < 1000) break;
    }
    if (all.length === 0) { alert('다운로드할 거래 데이터가 없습니다.'); return; }
    const headers = ['날짜', '거래유형', '카테고리', '소분류', '금액', '자산', '이체자산', '메모'];
    const rows = all.map((tx) =>
      [kstYmd(tx.date), tx.transaction_type, tx.category, tx.sub_category ?? '', tx.amount, tx.asset, tx.transfer_asset ?? '',
        (tx.memo ?? '').replace(/,/g, ' ').replace(/"/g, "'")]
        .map((v) => `"${v}"`).join(',')
    );
    const blob = new Blob(['﻿' + [headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `거래내역_${kstDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // 달력 칸
  const calendarCells = useMemo(() => {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells: (string | null)[] = Array.from({ length: first }, () => null);
    for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    while (cells.length % 7) cells.push(null);
    return cells;
  }, [year, month]);
  const todayYmd = kstDateString();

  const headerLabel = tab === 'monthly' ? `${year}년` : `${year}년 ${month}월`;
  const yt = yearTotals[year];
  const yearSum = yt ? yt.reduce((s, t) => ({ income: s.income + t.income, expense: s.expense + t.expense }), { income: 0, expense: 0 }) : null;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-28">
        <GlobalNav />

        {/* 상단 고정: 월 이동 · 탭 · 합계 */}
        <div className="sticky top-16 z-40 bg-[rgb(254,252,247)]/95 dark:bg-gray-900/95 backdrop-blur">
          <div className={APP_HORIZONTAL_CONTAINER}>
            <div className="flex items-center gap-1 pt-2">
              <button type="button" onClick={() => step(-1)} className="flex h-9 w-8 items-center justify-center text-gray-600 dark:text-gray-300" aria-label="이전">
                <IconChevronLeft size={20} />
              </button>
              <span className="min-w-[104px] text-center text-[17px] font-semibold tabular-nums text-gray-900 dark:text-white">{headerLabel}</span>
              <button type="button" onClick={() => step(1)} className="flex h-9 w-8 items-center justify-center text-gray-600 dark:text-gray-300" aria-label="다음">
                <IconChevronRight size={20} />
              </button>
              <div className="ml-auto flex items-center">
                <button type="button" onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setQuery(''); }} className={`flex h-9 w-9 items-center justify-center rounded-lg ${searchOpen ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`} aria-label="검색">
                  <IconSearch size={20} stroke={1.8} />
                </button>
                <button type="button" onClick={() => setShowUpload((v) => !v)} className={`flex h-9 w-9 items-center justify-center rounded-lg ${showUpload ? 'text-blue-600' : 'text-gray-600 dark:text-gray-300'}`} aria-label="CSV 올리기" title="CSV 올리기">
                  <IconUpload size={20} stroke={1.8} />
                </button>
                <button type="button" onClick={handleDownload} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 dark:text-gray-300" aria-label="전체 내역 내려받기" title="전체 내역 CSV 내려받기">
                  <IconDownload size={20} stroke={1.8} />
                </button>
              </div>
            </div>

            {searchOpen && (
              <div className="relative pb-1">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이번 달에서 메모·분류·자산 검색"
                  className="w-full rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 pr-8 text-sm outline-none"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-2 text-gray-400" aria-label="지우기">
                    <IconX size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 border-b border-gray-200 dark:border-gray-700 text-[15px]" role="tablist">
              {([['daily', '일일'], ['calendar', '달력'], ['monthly', '월별']] as [Tab, string][]).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => { setTab(k); setSelectedDay(null); }}
                  className={`relative py-2.5 font-semibold ${tab === k ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}
                >
                  {label}
                  {tab === k && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-red-500" />}
                </button>
              ))}
            </div>

            <SummaryBar totals={tab === 'monthly' ? (yearSum ?? { income: 0, expense: 0 }) : monthTotals} />
          </div>
        </div>

        <main className={APP_HORIZONTAL_CONTAINER}>
          {showUpload && (
            <div className="my-3">
              <ExcelUpload onUploadComplete={() => { invalidate(); setShowUpload(false); }} accessToken={accessToken} />
            </div>
          )}

          {/* 일일 */}
          {tab === 'daily' && (
            isLoading ? (
              <div className="space-y-2 py-3">
                {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />)}
              </div>
            ) : dayKeys.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                {query ? '검색 결과가 없어요' : `${month}월 기록이 없어요`}
              </div>
            ) : (
              dayKeys.map((k) => <DayGroup key={k} ymd={k} items={byDay.get(k)!} onEdit={(t) => { setEditing(t); setFormOpen(true); }} />)
            )
          )}

          {/* 달력 */}
          {tab === 'calendar' && (
            <div className="pt-2">
              <div className="grid grid-cols-7 text-center text-[11px] font-medium">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={`py-1 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 border-l border-t border-gray-200 dark:border-gray-700">
                {calendarCells.map((ymd, i) => {
                  if (!ymd) return <div key={`e${i}`} className="h-[68px] border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/30" />;
                  const items = byDay.get(ymd) ?? [];
                  const t = sumTotals(items);
                  const dnum = Number(ymd.slice(8));
                  const dow = i % 7;
                  const sel = selectedDay === ymd;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => setSelectedDay(sel ? null : ymd)}
                      className={`flex h-[68px] flex-col items-stretch border-b border-r border-gray-200 dark:border-gray-700 p-1 text-left ${sel ? 'bg-amber-50 dark:bg-amber-900/20' : ''}`}
                    >
                      <span className={`text-[11px] font-medium ${ymd === todayYmd ? 'inline-flex h-4 w-4 items-center justify-center self-start rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300'}`}>
                        {dnum}
                      </span>
                      <span className="mt-auto text-right text-[9.5px] leading-tight tabular-nums">
                        {t.income > 0 && <span className="block truncate text-blue-600 dark:text-blue-400">{won(t.income)}</span>}
                        {t.expense > 0 && <span className="block truncate text-red-500 dark:text-red-400">{won(t.expense)}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedDay && (
                <div className="mt-3">
                  {byDay.get(selectedDay)?.length ? (
                    <DayGroup ymd={selectedDay} items={byDay.get(selectedDay)!} onEdit={(t) => { setEditing(t); setFormOpen(true); }} />
                  ) : (
                    <div className="py-6 text-center text-sm text-gray-400">이날 기록이 없어요</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 월별 */}
          {tab === 'monthly' && (
            !yt ? (
              <div className="space-y-2 py-3">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />)}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {yt.map((t, i) => ({ m: i + 1, ...t })).reverse().map(({ m, income, expense }) => {
                  const empty = income === 0 && expense === 0;
                  return (
                    <li key={m}>
                      <button
                        type="button"
                        onClick={() => { setMonth(m); setTab('daily'); }}
                        className={`flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 ${empty ? 'opacity-40' : ''}`}
                      >
                        <span className="w-10 text-[17px] font-bold tabular-nums text-gray-900 dark:text-white">{m}월</span>
                        <span className="ml-auto flex text-right text-[13px] tabular-nums">
                          <span className="w-[86px] truncate text-blue-600 dark:text-blue-400">{won(income)}</span>
                          <span className="w-[86px] truncate text-red-500 dark:text-red-400">{won(expense)}</span>
                          <span className="w-[86px] truncate text-gray-900 dark:text-white">{won(income - expense)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          )}
        </main>

        {/* 거래 추가 — Asset 메뉴 왼쪽 */}
        <button
          type="button"
          onClick={openAdd}
          className="fixed bottom-24 right-[max(82px,calc(50%-124px))] sm:right-[calc(50%-112px)] z-[95] flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
          aria-label="거래 추가"
        >
          <IconPlus size={28} stroke={2.2} />
        </button>

        <FooterNav />
      </div>

      <TransactionForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        editing={editing as EditableTransaction | null}
        onDelete={handleDelete}
        defaultDate={tab === 'calendar' && selectedDay ? selectedDay : undefined}
      />
    </AuthGuard>
  );
}
