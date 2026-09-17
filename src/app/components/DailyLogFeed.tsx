'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  sort_order: number;
  type: 'checkbox' | 'number';
  unit?: string;
}

interface RoutineCheckRow {
  date: string;
  routine_id: string;
  checked: boolean;
  value: number | null;
  image_url: string | null;
  book_title?: string | null;
  memo?: string | null;
}

interface DailyRecord {
  date: string;
  weight: number | null;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  meal_images?: string[];
  daily_memo: string;
}

interface Props {
  routineTemplates: RoutineTemplate[];
  /** Home 이 이미 로드한 루틴별 체크 행 (추가 쿼리 없음) */
  checksByRoutine: Record<string, RoutineCheckRow[]>;
  /** Home 이 이미 로드한 daily_records 전체 */
  records: DailyRecord[];
  /** 루틴 줄을 탭하면 해당 날짜의 입력 시트를 연다 */
  onEntryClick: (routineId: string, dateStr: string) => void;
  onImageClick?: (url: string) => void;
}

interface DayEntry {
  routine: RoutineTemplate;
  row: RoutineCheckRow;
}

interface DayLog {
  date: string;
  entries: DayEntry[];
  missed: RoutineTemplate[];
  record: DailyRecord | null;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_PER_PAGE = 2;

const getKstTodayString = (): string => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
};

/** 숫자 값 표시 (정수면 정수, 아니면 소수 1자리) */
const formatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

const hasRecordContent = (r: DailyRecord): boolean =>
  r.weight != null ||
  !!r.meal_breakfast ||
  !!r.meal_lunch ||
  !!r.meal_dinner ||
  !!(r.meal_memo && r.meal_memo.trim()) ||
  !!(r.daily_memo && r.daily_memo.trim()) ||
  !!(r.meal_images && r.meal_images.length > 0);

export default function DailyLogFeed({
  routineTemplates,
  checksByRoutine,
  records,
  onEntryClick,
  onImageClick,
}: Props) {
  const [visibleMonths, setVisibleMonths] = useState(MONTHS_PER_PAGE);
  const [expandedMissed, setExpandedMissed] = useState<Record<string, boolean>>({});
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 날짜별로 루틴 체크 + daily_records 를 머지 → 월 단위 그룹 (최신순)
  const months = useMemo(() => {
    const todayStr = getKstTodayString();
    const ordered = [...routineTemplates].sort((a, b) => a.sort_order - b.sort_order);
    const byDate = new Map<string, Map<string, RoutineCheckRow>>();

    for (const routine of ordered) {
      for (const row of checksByRoutine[routine.id] ?? []) {
        if (!row.checked || row.date > todayStr) continue;
        // 값이 0 이고 메모·사진도 없는 숫자 기록은 "하지 않음"으로 본다
        if (
          routine.type === 'number' &&
          (row.value == null || row.value === 0) &&
          !row.memo &&
          !row.image_url
        ) {
          continue;
        }
        if (!byDate.has(row.date)) byDate.set(row.date, new Map());
        byDate.get(row.date)!.set(routine.id, row);
      }
    }

    const recordByDate = new Map<string, DailyRecord>();
    // 체크 데이터 로드 범위(작년 1월 1일~)와 맞춘다
    const minDate = `${Number(todayStr.slice(0, 4)) - 1}-01-01`;
    for (const r of records) {
      if (r.date > todayStr || r.date < minDate || !hasRecordContent(r)) continue;
      recordByDate.set(r.date, r);
    }

    const allDates = new Set<string>([...byDate.keys(), ...recordByDate.keys()]);
    const days: DayLog[] = [...allDates]
      .sort((a, b) => (a < b ? 1 : -1))
      .map((date) => {
        const rows = byDate.get(date);
        const entries: DayEntry[] = [];
        const missed: RoutineTemplate[] = [];
        for (const routine of ordered) {
          const row = rows?.get(routine.id);
          if (row) entries.push({ routine, row });
          else missed.push(routine);
        }
        return { date, entries, missed, record: recordByDate.get(date) ?? null };
      });

    const grouped: { key: string; label: string; days: DayLog[] }[] = [];
    for (const day of days) {
      const key = day.date.slice(0, 7);
      let group = grouped[grouped.length - 1];
      if (!group || group.key !== key) {
        const [y, m] = key.split('-');
        group = { key, label: `${y}년 ${Number(m)}월`, days: [] };
        grouped.push(group);
      }
      group.days.push(day);
    }
    return grouped;
  }, [routineTemplates, checksByRoutine, records]);

  const hasMore = visibleMonths < months.length;

  // 맨 아래 도달 시 이전 달 이어서 표시
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleMonths((n) => n + MONTHS_PER_PAGE);
        }
      },
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visibleMonths]);

  const totalRoutines = routineTemplates.length;

  return (
    <section aria-label="루틴 기록" className="mb-2">
      <div className="flex items-baseline justify-between px-1 mt-4 mb-2">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">루틴 기록</h3>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">길게 눌러 메모 남기기</span>
      </div>

      {months.length === 0 && (
        <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400 dark:text-gray-500">
          아직 기록이 없습니다. 루틴을 체크하면 이곳에 그날의 글이 만들어져요.
        </div>
      )}

      {months.slice(0, visibleMonths).map((month) => (
        <div key={month.key}>
          <div className="sticky top-16 z-10 -mx-1 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-[rgb(254,252,247)]/90 dark:bg-gray-900/90 backdrop-blur">
            {month.label}
            <span className="ml-1.5 font-normal text-gray-400 dark:text-gray-500">{month.days.length}일 기록</span>
          </div>

          <div className="space-y-2 mb-3">
            {month.days.map((day) => {
              const d = new Date(`${day.date}T00:00:00`);
              const weekday = WEEKDAYS[d.getDay()];
              const isSun = d.getDay() === 0;
              const isSat = d.getDay() === 6;
              const rec = day.record;
              const meals = rec
                ? [rec.meal_breakfast && '아침', rec.meal_lunch && '점심', rec.meal_dinner && '저녁'].filter(Boolean)
                : [];
              const showMissed = !!expandedMissed[day.date];

              return (
                <article
                  key={day.date}
                  className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3"
                >
                  <header className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {d.getMonth() + 1}월 {d.getDate()}일{' '}
                      <span className={isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}>
                        ({weekday})
                      </span>
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                      {rec?.weight != null && <span>{rec.weight}kg</span>}
                      {totalRoutines > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200">
                          {day.entries.length}/{totalRoutines}
                        </span>
                      )}
                    </div>
                  </header>

                  {day.entries.length > 0 && (
                    <ul className="space-y-1.5">
                      {day.entries.map(({ routine, row }) => (
                        <li key={routine.id}>
                          <button
                            type="button"
                            onClick={() => onEntryClick(routine.id, day.date)}
                            className="w-full text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                            aria-label={`${routine.label} ${day.date} 기록 수정`}
                          >
                            <div className="flex items-baseline gap-1.5 text-sm">
                              <span aria-hidden="true">{routine.emoji || '✅'}</span>
                              <span className="text-gray-800 dark:text-gray-100 break-words min-w-0">{routine.label}</span>
                              {routine.type === 'number' && row.value != null && row.value !== 0 && (
                                <span className="shrink-0 font-semibold text-gray-900 dark:text-white">
                                  {formatValue(row.value)}
                                  {routine.unit || ''}
                                </span>
                              )}
                              {row.book_title && (
                                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">《{row.book_title}》</span>
                              )}
                            </div>
                            {row.memo && (
                              <p className="ml-6 mt-0.5 text-[13px] leading-snug text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words">
                                {row.memo}
                              </p>
                            )}
                          </button>
                          {row.image_url && (
                            <button
                              type="button"
                              onClick={() => onImageClick?.(row.image_url!)}
                              className="ml-6 mt-1 block"
                              aria-label={`${routine.label} 사진 크게 보기`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={row.image_url}
                                alt={`${routine.label} 사진`}
                                loading="lazy"
                                className="h-24 w-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                              />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  {rec && (meals.length > 0 || rec.meal_memo?.trim() || rec.daily_memo?.trim() || (rec.meal_images?.length ?? 0) > 0) && (
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1 text-[13px] text-gray-600 dark:text-gray-300">
                      {(meals.length > 0 || rec.meal_memo?.trim()) && (
                        <p className="whitespace-pre-wrap break-words">
                          <span aria-hidden="true">🍽️ </span>
                          {meals.length > 0 && <span className="font-medium">{meals.join(' · ')}</span>}
                          {meals.length > 0 && rec.meal_memo?.trim() ? ' — ' : ''}
                          {rec.meal_memo?.trim()}
                        </p>
                      )}
                      {(rec.meal_images?.length ?? 0) > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto">
                          {rec.meal_images!.map((url, i) => (
                            <button key={url + i} type="button" onClick={() => onImageClick?.(url)} className="shrink-0" aria-label="식사 사진 크게 보기">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={url} alt="식사 사진" loading="lazy" className="h-16 w-16 object-cover rounded-lg border border-gray-200 dark:border-gray-700" />
                            </button>
                          ))}
                        </div>
                      )}
                      {rec.daily_memo?.trim() && (
                        <p className="whitespace-pre-wrap break-words">
                          <span aria-hidden="true">📝 </span>
                          {rec.daily_memo.trim()}
                        </p>
                      )}
                    </div>
                  )}

                  {day.missed.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedMissed((prev) => ({ ...prev, [day.date]: !prev[day.date] }))}
                        className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-expanded={showMissed}
                      >
                        미완료 {day.missed.length}개 {showMissed ? '접기' : '보기'}
                      </button>
                      {showMissed && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {day.missed.map((routine) => (
                            <button
                              key={routine.id}
                              type="button"
                              onClick={() => onEntryClick(routine.id, day.date)}
                              className="px-2 py-0.5 rounded-full text-[11px] border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                            >
                              {routine.emoji} {routine.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}

      {hasMore && <div ref={sentinelRef} className="h-8" aria-hidden="true" />}
      {!hasMore && months.length > 0 && (
        <p className="py-3 text-center text-[11px] text-gray-400 dark:text-gray-500">올해·작년 기록을 모두 불러왔습니다.</p>
      )}
    </section>
  );
}
