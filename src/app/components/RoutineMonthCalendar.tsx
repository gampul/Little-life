'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { isRoutineRowDone, kstTodayString, type DoneCheckRow } from '../../lib/routineDone';

interface CalendarRoutine {
  id: string;
  label: string;
  emoji: string;
  type: string;
  unit?: string;
  icon?: string | null;
}

interface CalendarCheckRow extends DoneCheckRow {
  date: string;
  routine_id: string;
}

interface Props {
  /** 정렬된 루틴 목록 */
  routines: CalendarRoutine[];
  checksByRoutine: Record<string, CalendarCheckRow[]>;
  /** null = 전체 */
  selectedRoutineId: string | null;
  onSelectRoutine: (id: string | null) => void;
  /** 그 날짜의 루틴 입력 시트 열기 (체크·값·메모·사진) */
  onEntryClick: (routineId: string, dateStr: string) => void;
  /** 루틴기록(날짜별 글)의 그날 카드로 이동 */
  onShowDayLog?: (dateStr: string) => void;
  /** 그날 루틴기록 카드가 있는지 */
  hasDayLog?: (dateStr: string) => boolean;
  renderIcon?: (routine: { label: string; icon?: string | null }) => ReactNode;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
const prevDay = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const fmtNum = (n: number) => (Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toFixed(1));

/** 완료 비율 → 칸 색 (전체 보기) */
const heatClass = (ratio: number) => {
  if (ratio <= 0) return '';
  if (ratio < 0.34) return 'bg-emerald-500/20';
  if (ratio < 0.67) return 'bg-emerald-500/45';
  if (ratio < 1) return 'bg-emerald-500/70 text-white';
  return 'bg-emerald-600 text-white';
};

/** 루틴기록 > 달력: 전체(완료 비율 색) / 루틴별(완료 표시·값) 한 달 보기 */
export default function RoutineMonthCalendar({
  routines,
  checksByRoutine,
  selectedRoutineId,
  onSelectRoutine,
  onEntryClick,
  onShowDayLog,
  hasDayLog,
  renderIcon,
}: Props) {
  const today = kstTodayString();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // 날짜 → 완료한 루틴, 날짜·루틴 → 행
  const { doneByDate, rowByKey, firstMonth } = useMemo(() => {
    const done = new Map<string, Set<string>>();
    const rows = new Map<string, CalendarCheckRow>();
    let first = thisMonth;
    for (const r of routines) {
      for (const row of checksByRoutine[r.id] ?? []) {
        if (row.date > today) continue;
        rows.set(`${row.date}|${r.id}`, row);
        if (!isRoutineRowDone(r.type, row)) continue;
        if (!done.has(row.date)) done.set(row.date, new Set());
        done.get(row.date)!.add(r.id);
        if (row.date.slice(0, 7) < first) first = row.date.slice(0, 7);
      }
    }
    return { doneByDate: done, rowByKey: rows, firstMonth: first };
  }, [routines, checksByRoutine, today, thisMonth]);

  const selected = routines.find((r) => r.id === selectedRoutineId) ?? null;

  // 다른 루틴을 고르면 선택한 날 패널은 닫는다
  useEffect(() => {
    setSelectedDay(null);
  }, [selectedRoutineId]);

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => ymd(y, m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const total = routines.length;
  const isDone = (date: string, routineId: string) => !!doneByDate.get(date)?.has(routineId);

  // 요약
  const summary = useMemo(() => {
    const monthDates = Array.from({ length: daysInMonth }, (_, i) => ymd(y, m, i + 1)).filter((d) => d <= today);
    if (!selected) {
      const recorded = monthDates.filter((d) => (doneByDate.get(d)?.size ?? 0) > 0).length;
      const ratios = monthDates.map((d) => (total > 0 ? (doneByDate.get(d)?.size ?? 0) / total : 0));
      const avg = ratios.length ? Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) : 0;
      return [`기록한 날 ${recorded}일`, `평균 완료율 ${avg}%`];
    }
    const id = selected.id;
    const count = monthDates.filter((d) => isDone(d, id)).length;
    // 현재 연속: 오늘(아직 안 했으면 어제)부터 거꾸로
    let streak = 0;
    let cursor = isDone(today, id) ? today : prevDay(today);
    while (isDone(cursor, id)) {
      streak++;
      cursor = prevDay(cursor);
    }
    const parts = [`이번 달 ${count}회`, `${streak}일 연속`];
    if (selected.type === 'number') {
      const sum = monthDates.reduce((acc, d) => {
        const row = rowByKey.get(`${d}|${id}`);
        return acc + (isDone(d, id) && row?.value ? Number(row.value) : 0);
      }, 0);
      if (sum > 0) parts.push(`합계 ${fmtNum(sum)}${selected.unit ?? ''}`);
    }
    return parts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, doneByDate, rowByKey, month, today, total]);

  const canPrev = month > firstMonth;
  const canNext = month < thisMonth;

  const glyph = (r: CalendarRoutine, done: boolean) =>
    !r.icon && r.emoji && r.emoji !== '✅' ? (
      <span className={`text-[15px] leading-none ${done ? '' : 'grayscale opacity-40'}`}>{r.emoji}</span>
    ) : renderIcon ? (
      renderIcon(r)
    ) : (
      <span className="text-[15px] leading-none">✅</span>
    );

  return (
    <div>
      {/* 루틴 고르기 */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="달력에 볼 루틴">
        {[{ id: null as string | null, label: '전체' }, ...routines.map((r) => ({ id: r.id as string | null, label: r.label }))].map((c) => {
          const active = selectedRoutineId === c.id;
          const r = routines.find((x) => x.id === c.id);
          return (
            <button
              key={c.id ?? 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectRoutine(c.id)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                active
                  ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white dark:bg-gray-100 dark:border-gray-100 dark:text-gray-900'
                  : 'bg-[rgb(254,252,247)] dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {r && <span className="inline-flex scale-[0.85] -my-1">{glyph(r, true)}</span>}
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-3">
        {/* 월 이동 + 요약 */}
        <div className="flex items-center justify-between mb-1">
          <button
            type="button"
            onClick={() => canPrev && setMonth(shiftMonth(month, -1))}
            disabled={!canPrev}
            aria-label="이전 달"
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
          >
            <IconChevronLeft size={18} stroke={1.5} />
          </button>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {y}년 {m}월{selected && <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">{selected.label}</span>}
          </div>
          <button
            type="button"
            onClick={() => canNext && setMonth(shiftMonth(month, 1))}
            disabled={!canNext}
            aria-label="다음 달"
            className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30"
          >
            <IconChevronRight size={18} stroke={1.5} />
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-500 dark:text-gray-400 mb-2">{summary.join(' · ')}</p>

        {/* 요일 */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`text-center text-[10px] ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 날짜 */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} className="aspect-square" />;
            const day = Number(date.slice(8));
            const future = date > today;
            const isToday = date === today;
            const doneCount = doneByDate.get(date)?.size ?? 0;
            const isSel = selectedDay === date;

            if (!selected) {
              const ratio = total > 0 ? doneCount / total : 0;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={future}
                  onClick={() => setSelectedDay(isSel ? null : date)}
                  aria-label={`${m}월 ${day}일 ${doneCount}/${total} 완료`}
                  aria-pressed={isSel}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[12px] tabular-nums transition-colors ${
                    future ? 'text-gray-300 dark:text-gray-600' : heatClass(ratio) || 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${isToday ? 'ring-2 ring-[#1E3A5F] dark:ring-gray-200' : ''} ${isSel ? 'outline outline-2 outline-offset-1 outline-amber-400' : ''}`}
                >
                  {day}
                  {!future && doneCount > 0 && <span className="text-[9px] leading-none opacity-80">{doneCount}</span>}
                </button>
              );
            }

            const done = isDone(date, selected.id);
            const row = rowByKey.get(`${date}|${selected.id}`);
            const value = selected.type === 'number' && done && row?.value ? fmtNum(Number(row.value)) : '';
            return (
              <button
                key={date}
                type="button"
                disabled={future}
                onClick={() => onEntryClick(selected.id, date)}
                aria-label={`${m}월 ${day}일 ${selected.label} ${done ? '완료' : '안 함'} — 눌러서 기록`}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[12px] tabular-nums transition-colors ${
                  future
                    ? 'text-gray-300 dark:text-gray-600'
                    : done
                      ? 'bg-[#474c56] text-white dark:bg-gray-200 dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${isToday ? 'ring-2 ring-[#1E3A5F] dark:ring-gray-200 ring-offset-1 ring-offset-[rgb(254,252,247)] dark:ring-offset-gray-800' : ''}`}
              >
                {day}
                {value && <span className="text-[9px] leading-none opacity-80 truncate max-w-full px-0.5">{value}</span>}
              </button>
            );
          })}
        </div>

        {/* 범례 / 안내 */}
        {!selected ? (
          <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-gray-400 dark:text-gray-500">
            적음
            {[0.2, 0.5, 0.8, 1].map((r) => (
              <span key={r} className={`inline-block w-3 h-3 rounded-sm ${heatClass(r)}`} />
            ))}
            다 함
          </div>
        ) : (
          <p className="mt-2 text-right text-[10px] text-gray-400 dark:text-gray-500">날짜를 누르면 그날 기록을 고칠 수 있어요</p>
        )}

        {/* 전체 보기: 고른 날의 루틴 */}
        {!selected && selectedDay && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
                {Number(selectedDay.slice(5, 7))}월 {Number(selectedDay.slice(8))}일 ({WEEKDAYS[new Date(`${selectedDay}T00:00:00`).getDay()]})
                <span className="ml-1.5 text-xs font-normal text-gray-400">
                  {doneByDate.get(selectedDay)?.size ?? 0}/{total}
                </span>
              </span>
              {onShowDayLog && hasDayLog?.(selectedDay) && (
                <button
                  type="button"
                  onClick={() => onShowDayLog(selectedDay)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  그날 기록 보기 ›
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5" aria-label="그날 루틴 (누르면 기록)">
              {routines.map((r) => {
                const done = isDone(selectedDay, r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onEntryClick(r.id, selectedDay)}
                    title={`${r.label}${done ? ' · 완료' : ' · 미완료'}`}
                    aria-label={`${r.label} ${done ? '완료' : '미완료'} — 눌러서 기록`}
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
                      done ? 'text-[#474c56] dark:text-[#c9ccd3]' : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'
                    }`}
                  >
                    {glyph(r, done)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
