'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconChevronLeft, IconChevronRight, IconToolsKitchen2, IconNotes, IconScaleOutline } from '@tabler/icons-react';
import { summarizeSubValues, type RoutineSubItem, type RoutineType, type SubValues } from '../../lib/routineSubItems';

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  sort_order: number;
  type: RoutineType;
  unit?: string;
  sub_items?: RoutineSubItem[];
}

interface RoutineCheckRow {
  date: string;
  routine_id: string;
  checked: boolean;
  value: number | null;
  image_url: string | null;
  image_urls?: string[] | null;
  book_title?: string | null;
  memo?: string | null;
  sub_values?: SubValues | null;
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
  weight_memo?: string | null;
  weight_images?: string[];
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
  /** 체중 줄을 탭하면 그 날짜의 체중 기록(메모·사진) 입력을 연다 */
  onWeightClick?: (dateStr: string) => void;
  /** 매트릭스와 같은 라인 아이콘 (없으면 아이콘 생략) */
  renderIcon?: (label: string) => ReactNode;
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

const getKstTodayString = (): string => {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
};

/** 숫자 값 표시 (정수면 정수, 아니면 소수 1자리) */
const formatValue = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);

/** 행의 사진 목록 (image_urls 우선, 없으면 기존 단일 image_url) */
const getRowImages = (row: RoutineCheckRow): string[] => {
  const list = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
  // 루틴별 캘린더(기존 단일 업로드)에서 사진을 바꾼 경우 image_url 만 갱신되므로 맨 앞에 합친다
  if (row.image_url && !list.includes(row.image_url)) return [row.image_url, ...list].slice(0, 5);
  return list;
};

const hasRecordContent = (r: DailyRecord): boolean =>
  r.weight != null ||
  !!r.meal_breakfast ||
  !!r.meal_lunch ||
  !!r.meal_dinner ||
  !!(r.meal_memo && r.meal_memo.trim()) ||
  !!(r.daily_memo && r.daily_memo.trim()) ||
  !!(r.meal_images && r.meal_images.length > 0) ||
  !!(r.weight_memo && r.weight_memo.trim()) ||
  !!(r.weight_images && r.weight_images.length > 0);

export default function DailyLogFeed({
  routineTemplates,
  checksByRoutine,
  records,
  onEntryClick,
  onImageClick,
  onWeightClick,
  renderIcon,
}: Props) {
  // 월 단위 페이지: 0 = 기록이 있는 가장 최근 달
  const [monthIndex, setMonthIndex] = useState(0);
  const topRef = useRef<HTMLDivElement | null>(null);
  const [expandedMissed, setExpandedMissed] = useState<Record<string, boolean>>({});

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
          getRowImages(row).length === 0
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

  // 데이터가 바뀌어 달 수가 줄어든 경우 범위 보정
  useEffect(() => {
    if (monthIndex > 0 && monthIndex >= months.length) setMonthIndex(Math.max(0, months.length - 1));
  }, [monthIndex, months.length]);

  const current = months[Math.min(monthIndex, Math.max(0, months.length - 1))];
  const hasOlder = monthIndex < months.length - 1;
  const hasNewer = monthIndex > 0;
  const goMonth = (next: number) => {
    setMonthIndex(next);
    // 새 달의 첫 글이 보이도록 섹션 상단으로 이동 (상단 고정 네비 높이만큼 여유)
    requestAnimationFrame(() => {
      const el = topRef.current;
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    });
  };

  const totalRoutines = routineTemplates.length;

  return (
    <section aria-label="루틴 기록" className="mb-2" ref={topRef}>
      <div className="flex items-baseline justify-between px-1 mt-4 mb-2">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">루틴 기록</h3>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">아이콘을 누르면 기록 수정</span>
      </div>

      {months.length === 0 && (
        <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400 dark:text-gray-500">
          아직 기록이 없습니다. 루틴을 체크하면 이곳에 그날의 글이 만들어져요.
        </div>
      )}

      {current && [current].map((month) => (
        <div key={month.key}>
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => goMonth(monthIndex + 1)}
              disabled={!hasOlder}
              aria-label="이전 달 기록"
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <IconChevronLeft size={18} stroke={1.5} />
            </button>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {month.label}
              <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">{month.days.length}일 기록</span>
            </div>
            <button
              type="button"
              onClick={() => goMonth(monthIndex - 1)}
              disabled={!hasNewer}
              aria-label="다음 달 기록"
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <IconChevronRight size={18} stroke={1.5} />
            </button>
          </div>

          <div className="space-y-1.5 mb-3">
            {month.days.map((day) => {
              const d = new Date(`${day.date}T00:00:00`);
              const weekday = WEEKDAYS[d.getDay()];
              const isSun = d.getDay() === 0;
              const isSat = d.getDay() === 6;
              const rec = day.record;
              const meals = rec
                ? [rec.meal_breakfast && '아침', rec.meal_lunch && '점심', rec.meal_dinner && '저녁'].filter(Boolean)
                : [];

              // "내용"이 있는 루틴만 본문에 — 값(숫자/복합), 메모, 책 제목. 체크만 한 루틴은 아이콘 도장 줄로만
              const contentEntries = day.entries.filter(({ routine, row }) => {
                const hasValue =
                  (routine.type === 'number' && row.value != null && row.value !== 0) ||
                  (routine.type === 'multi' && !!summarizeSubValues(row.sub_values, routine.sub_items ?? []));
                return hasValue || !!row.memo?.trim() || !!row.book_title;
              });
              const photos: { url: string; label: string }[] = [];
              for (const { routine, row } of day.entries) {
                for (const url of getRowImages(row)) photos.push({ url, label: routine.label });
              }
              for (const url of rec?.weight_images ?? []) photos.push({ url, label: '체중' });
              for (const url of rec?.meal_images ?? []) photos.push({ url, label: '식사' });
              const weightMemo = rec?.weight_memo?.trim() || '';
              const mealMemo = rec?.meal_memo?.trim() || '';
              const dailyMemo = rec?.daily_memo?.trim() || '';
              const hasContent =
                contentEntries.length > 0 || !!weightMemo || !!mealMemo || !!dailyMemo || photos.length > 0;
              const expanded = !!expandedMissed[day.date];

              const dateLabel = (
                <>
                  {d.getMonth() + 1}월 {d.getDate()}일{' '}
                  <span className={isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}>
                    ({weekday})
                  </span>
                </>
              );
              const rightMeta = (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {rec?.weight != null && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onWeightClick?.(day.date);
                      }}
                      className="inline-flex items-center gap-0.5 rounded-md px-1 -mx-1 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                      aria-label={`${day.date} 체중 기록 수정`}
                    >
                      <IconScaleOutline size={14} stroke={1.5} aria-hidden="true" />
                      {rec.weight}kg
                    </button>
                  )}
                  {totalRoutines > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 font-medium text-gray-700 dark:text-gray-200">
                      {day.entries.length}/{totalRoutines}
                    </span>
                  )}
                </div>
              );
              const stampRow = day.entries.length > 0 && (
                <div className="flex flex-wrap items-center gap-1" aria-label="완료한 루틴">
                  {day.entries.map(({ routine }) => (
                    <button
                      key={routine.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEntryClick(routine.id, day.date);
                      }}
                      title={routine.label}
                      aria-label={`${routine.label} ${day.date} 기록`}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-white/70 dark:bg-gray-700/60 border border-gray-200/80 dark:border-gray-600 text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                      {renderIcon ? renderIcon(routine.label) : <span className="text-sm leading-none">{routine.emoji}</span>}
                    </button>
                  ))}
                </div>
              );

              // 체크만 있고 남긴 내용이 없는 날 — 한 줄로 접기 (탭하면 도장 줄만 펼침)
              if (!hasContent) {
                return (
                  <div
                    key={day.date}
                    className="rounded-lg px-3 py-1.5 bg-transparent hover:bg-[rgb(254,252,247)] dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedMissed((prev) => ({ ...prev, [day.date]: !prev[day.date] }))}
                      aria-expanded={expanded}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">{dateLabel}</span>
                      {rightMeta}
                    </button>
                    {expanded && <div className="mt-1.5">{stampRow}</div>}
                  </div>
                );
              }

              return (
                <article
                  key={day.date}
                  className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3"
                >
                  <header className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{dateLabel}</h4>
                    {rightMeta}
                  </header>

                  {stampRow && <div className="mb-2">{stampRow}</div>}

                  {/* 남긴 내용 — 루틴 이름 없이 아이콘 + 값/메모 */}
                  {(contentEntries.length > 0 || weightMemo || mealMemo || dailyMemo) && (
                    <ul className="space-y-1 text-[13px] text-gray-600 dark:text-gray-300">
                      {contentEntries.map(({ routine, row }) => {
                        const value =
                          routine.type === 'number' && row.value != null && row.value !== 0
                            ? `${formatValue(row.value)}${routine.unit || ''}`
                            : routine.type === 'multi'
                              ? summarizeSubValues(row.sub_values, routine.sub_items ?? [])
                              : '';
                        return (
                          <li key={routine.id}>
                            <button
                              type="button"
                              onClick={() => onEntryClick(routine.id, day.date)}
                              title={routine.label}
                              className="w-full text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                              aria-label={`${routine.label} ${day.date} 기록 수정`}
                            >
                              <p className="flex items-start gap-2 whitespace-pre-wrap break-words">
                                <span aria-hidden="true" className="shrink-0 mt-px text-gray-400 dark:text-gray-500">
                                  {renderIcon ? renderIcon(routine.label) : routine.emoji}
                                </span>
                                <span className="min-w-0">
                                  {value && <span className="font-semibold text-gray-900 dark:text-white">{value}</span>}
                                  {/* 숫자형은 값만으로는 무엇인지 알 수 없어 이름을 작게 덧붙임 (복합형은 항목명이 값에 포함) */}
                                  {value && routine.type === 'number' && (
                                    <span className="ml-1 text-[11px] text-gray-400 dark:text-gray-500">{routine.label}</span>
                                  )}
                                  {row.book_title && (
                                    <span className={`text-gray-500 dark:text-gray-400 ${value ? ' ml-1' : ''}`}>《{row.book_title}》</span>
                                  )}
                                  {(value || row.book_title) && row.memo?.trim() ? ' — ' : ''}
                                  {row.memo?.trim()}
                                </span>
                              </p>
                            </button>
                          </li>
                        );
                      })}
                      {weightMemo && (
                        <li>
                          <button
                            type="button"
                            onClick={() => onWeightClick?.(day.date)}
                            className="w-full text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                            aria-label={`${day.date} 체중 기록 수정`}
                          >
                            <p className="flex items-start gap-2 whitespace-pre-wrap break-words">
                              <IconScaleOutline size={18} stroke={1.5} aria-hidden="true" className="shrink-0 text-gray-400 dark:text-gray-500" />
                              <span className="min-w-0">{weightMemo}</span>
                            </p>
                          </button>
                        </li>
                      )}
                      {mealMemo && (
                        <li>
                          <p className="flex items-start gap-2 whitespace-pre-wrap break-words px-1 -mx-1 py-0.5">
                            <IconToolsKitchen2 size={18} stroke={1.5} aria-hidden="true" className="shrink-0 text-gray-400 dark:text-gray-500" />
                            <span className="min-w-0">
                              {meals.length > 0 && <span className="font-medium">{meals.join(' · ')} — </span>}
                              {mealMemo}
                            </span>
                          </p>
                        </li>
                      )}
                      {dailyMemo && (
                        <li>
                          <p className="flex items-start gap-2 whitespace-pre-wrap break-words px-1 -mx-1 py-0.5">
                            <IconNotes size={18} stroke={1.5} aria-hidden="true" className="shrink-0 text-gray-400 dark:text-gray-500" />
                            <span className="min-w-0">{dailyMemo}</span>
                          </p>
                        </li>
                      )}
                    </ul>
                  )}

                  {/* 그날의 사진 — 카드 맨 아래 한 줄 */}
                  {photos.length > 0 && (
                    <div className={contentEntries.length > 0 || weightMemo || mealMemo || dailyMemo ? 'mt-2 pt-2 border-t border-gray-200 dark:border-gray-700' : ''}>
                      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                        {photos.map((p, i) => (
                          <button
                            key={p.url + i}
                            type="button"
                            onClick={() => onImageClick?.(p.url)}
                            className="relative shrink-0"
                            aria-label={`${p.label} 사진 크게 보기`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={p.url}
                              alt={`${p.label} 사진`}
                              loading="lazy"
                              className="h-20 w-20 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                            />
                            <span className="absolute left-1 bottom-1 max-w-[calc(100%-8px)] truncate px-1 py-0.5 rounded bg-black/55 text-white text-[10px] leading-none">
                              {p.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      ))}

      {months.length > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1 pb-2">
          <button
            type="button"
            onClick={() => goMonth(monthIndex + 1)}
            disabled={!hasOlder}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-[rgb(254,252,247)] dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <IconChevronLeft size={16} stroke={1.5} />
            {hasOlder ? months[monthIndex + 1].label : '이전 달 없음'}
          </button>
          <button
            type="button"
            onClick={() => goMonth(monthIndex - 1)}
            disabled={!hasNewer}
            className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 bg-[rgb(254,252,247)] dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            {hasNewer ? months[monthIndex - 1].label : '최신 달'}
            <IconChevronRight size={16} stroke={1.5} />
          </button>
        </div>
      )}
    </section>
  );
}
