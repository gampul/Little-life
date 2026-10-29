'use client';

/**
 * 오늘 루틴이 만점(그날 루틴의 80%)을 넘는 순간 잠깐 띄우는 축하 토스트.
 * 사용자가 이번 화면에서 직접 기록해서 넘었을 때만, 하루 한 번.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildDayScores, dayTarget, kstDateOf } from '../../lib/monthArt';
import { kstTodayString, type DoneCheckRow } from '../../lib/routineDone';

interface Props {
  routines: { id: string; type: string; created_at?: string | null }[];
  checksByRoutine: Record<string, (DoneCheckRow & { date: string })[]>;
  /** 사용자가 기록을 바꿀 때마다 늘어나는 값 (0 = 아직 안 바꿈) */
  signal: number;
}

const shownKey = (date: string) => `little-life:today-perfect:${date}`;

export default function TodayPerfectToast({ routines, checksByRoutine, signal }: Props) {
  const today = kstTodayString();
  const { score, done, target } = useMemo(() => {
    const { scoreByDate, doneByDate } = buildDayScores(routines, checksByRoutine, today);
    const t = dayTarget(routines.map((r) => ({ id: r.id, since: kstDateOf(r.created_at) })), today);
    return { score: scoreByDate.get(today) ?? 0, done: doneByDate.get(today)?.size ?? 0, target: t };
  }, [routines, checksByRoutine, today]);

  const lastScore = useRef<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const prev = lastScore.current;
    lastScore.current = score;
    if (routines.length === 0 || signal === 0 || prev == null || prev >= 1 || score < 1) return;
    try {
      if (localStorage.getItem(shownKey(today))) return;
      localStorage.setItem(shownKey(today), '1');
    } catch {}
    setShow(true);
    window.setTimeout(() => setShow(false), 4200);
  }, [score, signal, routines.length, today]);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[76px] z-[160] flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-gray-900/95 dark:bg-gray-100/95 px-4 py-3 text-white dark:text-gray-900 shadow-lg animate-[perfectIn_0.35s_cubic-bezier(.2,1.4,.4,1)]"
        onClick={() => setShow(false)}
      >
        <span className="text-[22px] animate-[perfectSpin_1.2s_ease-out]">✨</span>
        <div>
          <div className="text-[14px] font-semibold">오늘 만점! 그림 한 칸이 풀컬러가 됐어요</div>
          <div className="text-[12px] opacity-75">
            루틴 {done}개 완료 (만점 기준 {target}개)
          </div>
        </div>
      </div>
      <style>{`@keyframes perfectIn { from { opacity: 0; transform: translateY(-10px) scale(.92); } to { opacity: 1; transform: none; } }
@keyframes perfectSpin { from { transform: rotate(-90deg) scale(.4); } to { transform: none; } }`}</style>
    </div>
  );
}
