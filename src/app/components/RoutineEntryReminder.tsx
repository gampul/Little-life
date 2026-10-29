'use client';

/**
 * 앱에 들어왔을 때(처음 열기·다시 앞으로 왔을 때) 오늘 안 한 루틴을 화면 위에 알려 주는 알림.
 * 휴대폰 푸시(routine-reminder, 13시·22시)와 같은 기준·시간대:
 *  - 오후 1시 이후 / 밤 10시 이후 시간대마다 한 번만 (localStorage 로 기억)
 *  - 완료 판정은 routineDone.ts 의 isRoutineRowDone (숫자형 0·메모·사진 없음 = 안 함)
 *  - 안 한 루틴이 없으면 띄우지 않음
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IconBell, IconX } from '@tabler/icons-react';
import { getSupabase } from '../../lib/supabase';
import { isRoutineRowDone, kstTodayString, type DoneCheckRow } from '../../lib/routineDone';
import { useAuth } from './AuthProvider';

type Slot = 'afternoon' | 'night';

/** 지금 KST 시각의 알림 시간대 (오후 1시 전이면 없음) */
function currentSlot(): Slot | null {
  const h = new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
  if (h >= 22) return 'night';
  if (h >= 13) return 'afternoon';
  return null;
}

const shownKey = (date: string, slot: Slot) => `little-life:entry-reminder:${date}:${slot}`;

interface Missing {
  id: number;
  slot: Slot;
  labels: string[];
}

export default function RoutineEntryReminder() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const [missing, setMissing] = useState<Missing | null>(null);
  const [leaving, setLeaving] = useState(false);
  const checking = useRef(false);

  const check = useCallback(async () => {
    if (!userId || checking.current) return;
    const slot = currentSlot();
    if (!slot) return;
    const today = kstTodayString();
    try {
      if (localStorage.getItem(shownKey(today, slot))) return;
    } catch {
      return;
    }
    const supabase = getSupabase();
    if (!supabase) return;
    checking.current = true;
    try {
      const [tplRes, chkRes] = await Promise.all([
        supabase
          .from('routine_templates')
          .select('id, label, type, sort_order')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true }),
        supabase
          .from('daily_routine_checks')
          .select('routine_id, checked, value, memo, image_url, image_urls')
          .eq('user_id', userId)
          .eq('date', today),
      ]);
      if (tplRes.error || chkRes.error) return;
      // 같은 루틴에 행이 여러 개면 체크된 쪽 우선
      const rowByRoutine = new Map<string, DoneCheckRow & { routine_id: string }>();
      for (const c of (chkRes.data ?? []) as (DoneCheckRow & { routine_id: string })[]) {
        const prev = rowByRoutine.get(c.routine_id);
        if (!prev || (c.checked && !prev.checked)) rowByRoutine.set(c.routine_id, c);
      }
      const labels = ((tplRes.data ?? []) as { id: string; label: string; type: string | null }[])
        .filter((r) => !isRoutineRowDone(r.type, rowByRoutine.get(r.id)))
        .map((r) => r.label);
      try { localStorage.setItem(shownKey(today, slot), '1'); } catch {}
      if (labels.length > 0) {
        setLeaving(false);
        setMissing({ id: Date.now(), slot, labels });
      }
    } finally {
      checking.current = false;
    }
  }, [userId]);

  // 처음 열 때 + 다른 앱에 갔다가 다시 돌아왔을 때
  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  // 닫는 애니메이션 뒤 지움 — 그 사이 새 알림이 떴으면 새 알림은 지우지 않음
  const close = () => {
    const closingId = missing?.id;
    setLeaving(true);
    window.setTimeout(() => setMissing((m) => (m && m.id === closingId ? null : m)), 200);
  };

  if (!missing) return null;

  const n = missing.labels.length;
  const title = missing.slot === 'afternoon' ? `오늘 아직 안 한 루틴 ${n}개` : `오늘 남은 루틴 ${n}개`;
  const hint = missing.slot === 'afternoon' ? '오후에 하나씩 챙겨 봐요' : '자기 전에 마무리해 볼까요?';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[72px] z-[150] flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-full max-w-[388px] rounded-2xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 shadow-lg backdrop-blur-md transition-all duration-200 ${
          leaving ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0 animate-[reminderIn_0.25s_ease-out]'
        }`}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
            <IconBell size={18} stroke={1.8} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-gray-900 dark:text-white">{title}</div>
            <div className="mt-0.5 text-[13px] leading-snug text-gray-600 dark:text-gray-300 line-clamp-2">
              {missing.labels.join(', ')} — {hint}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  close();
                  if (pathname !== '/daily') router.push('/daily');
                }}
                className="rounded-lg bg-gray-900 dark:bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-white dark:text-gray-900"
              >
                체크하러 가기
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                나중에
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="알림 닫기"
            className="-mr-1 -mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <IconX size={16} />
          </button>
        </div>
      </div>
      <style>{`@keyframes reminderIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
