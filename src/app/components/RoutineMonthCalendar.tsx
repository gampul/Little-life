'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { getSupabase } from '../../lib/supabase';

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  field_key: string;
  sort_order: number;
  type: 'checkbox' | 'number';
  unit?: string;
  image_upload_enabled?: boolean;
}

interface DailyRoutineCheck {
  date: string;
  routine_id: string;
  checked: boolean;
  value: number | null;
  user_id: string;
}

interface Props {
  userId: string | null;
  routineTemplates: RoutineTemplate[];
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];

// 로컬 날짜를 YYYY-MM-DD 문자열로 변환
const toDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 한국 시간 기준 오늘 날짜 문자열
const getKstTodayString = (): string => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = kst.getUTCFullYear();
  const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 숫자 값 표시 포맷 (정수면 정수, 아니면 소수 1자리)
const formatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

export default function RoutineMonthCalendar({ userId, routineTemplates }: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthChecks, setMonthChecks] = useState<DailyRoutineCheck[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = getSupabase();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed
  const todayStr = getKstTodayString();

  // 해당 월 데이터 fetch
  const loadMonthChecks = useCallback(async () => {
    if (!supabase || !userId) {
      setMonthChecks([]);
      return;
    }

    const firstDay = toDateString(new Date(year, month, 1));
    const lastDay = toDateString(new Date(year, month + 1, 0));

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_routine_checks')
        .select('date, routine_id, checked, value, user_id')
        .eq('user_id', userId)
        .gte('date', firstDay)
        .lte('date', lastDay);

      if (error) {
        console.error('월간 캘린더 데이터 로드 오류:', error);
        setMonthChecks([]);
      } else {
        setMonthChecks((data as DailyRoutineCheck[]) || []);
      }
    } catch (err) {
      console.error('월간 캘린더 데이터 로드 예외:', err);
      setMonthChecks([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId, year, month]);

  useEffect(() => {
    loadMonthChecks();
  }, [loadMonthChecks]);

  // 날짜별 완료된 체크 매핑 (checked === true)
  const checksByDate: Record<string, DailyRoutineCheck[]> = {};
  for (const check of monthChecks) {
    if (!check.checked) continue;
    if (!checksByDate[check.date]) checksByDate[check.date] = [];
    checksByDate[check.date].push(check);
  }

  // 루틴 id로 템플릿 빠르게 조회
  const templateById: Record<string, RoutineTemplate> = {};
  for (const t of routineTemplates) templateById[t.id] = t;

  // 캘린더 그리드 생성 (월요일 시작)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=일 ~ 6=토
  const leadingOffset = (firstWeekday + 6) % 7; // 월요일 시작 보정
  const totalCells = Math.ceil((leadingOffset + daysInMonth) / 7) * 7;

  const cells: { date: Date; inMonth: boolean }[] = [];
  const gridStart = new Date(year, month, 1 - leadingOffset);
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }

  const goPrevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const goNextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  return (
    <div className="w-full max-w-[412px] mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-3 mb-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrevMonth}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="이전 달"
        >
          <IconChevronLeft size={18} />
        </button>
        <div className="text-sm font-semibold text-gray-900 dark:text-white">
          {year}년 {month + 1}월
          {isLoading && <span className="ml-2 text-xs text-gray-400">불러오는 중…</span>}
        </div>
        <button
          onClick={goNextMonth}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="다음 달"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      {/* 요일 행 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((wd, idx) => (
          <div
            key={wd}
            className={`text-center text-[11px] font-medium py-1 ${
              idx === 5
                ? 'text-blue-500 dark:text-blue-400'
                : idx === 6
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 border-t border-l border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
        {cells.map(({ date, inMonth }, idx) => {
          const dateStr = toDateString(date);
          const isToday = dateStr === todayStr;
          const dayChecks = inMonth ? checksByDate[dateStr] || [] : [];

          // 완료된 루틴 태그 생성 (템플릿 순서대로)
          const tags = dayChecks
            .map((c) => templateById[c.routine_id] && { tmpl: templateById[c.routine_id], value: c.value })
            .filter((x): x is { tmpl: RoutineTemplate; value: number | null } => Boolean(x))
            .sort((a, b) => a.tmpl.sort_order - b.tmpl.sort_order);

          const visibleTags = tags.slice(0, 3);
          const extraCount = tags.length - visibleTags.length;

          return (
            <div
              key={idx}
              className="min-h-[80px] border-r border-b border-gray-100 dark:border-gray-800 p-1 flex flex-col gap-1"
            >
              {/* 날짜 숫자 */}
              <div className="flex justify-end">
                {isToday ? (
                  <span className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium">
                    {date.getDate()}
                  </span>
                ) : (
                  <span
                    className={`w-7 h-7 flex items-center justify-center text-sm font-medium ${
                      inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-700'
                    }`}
                  >
                    {date.getDate()}
                  </span>
                )}
              </div>

              {/* 루틴 태그 */}
              {inMonth && visibleTags.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  {visibleTags.map(({ tmpl, value }) => {
                    const isNumber = tmpl.type === 'number';
                    const labelText =
                      isNumber && value != null
                        ? `${formatValue(value)}${tmpl.unit || ''}`
                        : tmpl.label;
                    return (
                      <span
                        key={tmpl.id}
                        className={`flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] leading-tight truncate ${
                          isNumber
                            ? 'bg-gray-900/10 dark:bg-gray-200/15 text-gray-900 dark:text-gray-200'
                            : 'bg-gray-900 dark:bg-gray-700 text-white'
                        }`}
                        title={`${tmpl.emoji} ${tmpl.label}${isNumber && value != null ? ` ${formatValue(value)}${tmpl.unit || ''}` : ''}`}
                      >
                        <span className="shrink-0">{tmpl.emoji}</span>
                        <span className="truncate">{labelText}</span>
                      </span>
                    );
                  })}
                  {extraCount > 0 && (
                    <span className="px-1 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
                      +{extraCount}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
