/**
 * 루틴기록 달력 "이달의 그림" 점수 계산 (순수 함수 — 테스트하기 쉽게 화면과 분리)
 *  - 하루 만점 기준: 그날 있던 루틴 수의 80% (10개면 8개). 최소 1개.
 *  - 하루 점수 = min(1, 한 개수 / 만점 기준)
 *  - 색 단계: 0 흑백 → 점점 진하게 → 1(만점) 풀컬러
 *  - 한 달 진행률 = 하루 점수 합 / 그 달 날짜 수. 80% 이상이면 그림 완성.
 */
import { isRoutineRowDone, type DoneCheckRow } from './routineDone';

export const DAY_FULL_RATIO = 0.8;
export const MONTH_COMPLETE_RATIO = 0.8;

export interface ScoreRoutine {
  id: string;
  /** 루틴을 만든 날 (YYYY-MM-DD, KST). 없으면 처음부터 있던 것으로 봄 */
  since?: string | null;
}

/** 그날 있던 루틴 수 → 만점에 필요한 개수 */
export function dayTarget(routines: ScoreRoutine[], date: string): number {
  const existing = routines.filter((r) => !r.since || r.since <= date).length;
  const n = existing > 0 ? existing : routines.length;
  return Math.max(1, Math.ceil(n * DAY_FULL_RATIO - 1e-9));
}

export function dayScore(doneCount: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, doneCount / target));
}

/** 점수 → 단계 0..4 (0 = 안 함, 4 = 만점) */
export function scoreLevel(score: number): 0 | 1 | 2 | 3 | 4 {
  if (score <= 0) return 0;
  if (score >= 1) return 4;
  if (score < 0.3) return 1;
  if (score < 0.6) return 2;
  return 3;
}

/** 단계별 흑백 정도 (CSS grayscale) */
export const LEVEL_GRAYSCALE = [1, 0.75, 0.5, 0.2, 0] as const;
/** 단계별 밝기 — 아직 안 칠한 칸은 살짝 흐리게 */
export const LEVEL_OPACITY = [0.45, 0.7, 0.82, 0.92, 1] as const;

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthDates(month: string): string[] {
  return Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${pad2(i + 1)}`);
}

export interface MonthProgress {
  /** 0..1 (그 달 전체 날짜 기준) */
  progress: number;
  /** 만점 받은 날 수 */
  perfectDays: number;
  /** 지금까지 지난 날 수 (오늘 포함) */
  elapsedDays: number;
  complete: boolean;
}

export function monthProgress(scoreByDate: Map<string, number>, month: string, today: string): MonthProgress {
  const dates = monthDates(month);
  let sum = 0;
  let perfect = 0;
  let elapsed = 0;
  for (const d of dates) {
    if (d > today) continue;
    elapsed++;
    const s = scoreByDate.get(d) ?? 0;
    sum += s;
    if (s >= 1) perfect++;
  }
  const progress = dates.length ? sum / dates.length : 0;
  return { progress, perfectDays: perfect, elapsedDays: elapsed, complete: progress >= MONTH_COMPLETE_RATIO - 1e-9 };
}

function prevDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** 만점 연속 일수 — 오늘 만점이면 오늘부터, 아니면 어제부터 거꾸로 */
export function perfectStreak(scoreByDate: Map<string, number>, today: string): number {
  let cursor = (scoreByDate.get(today) ?? 0) >= 1 ? today : prevDate(today);
  let n = 0;
  while ((scoreByDate.get(cursor) ?? 0) >= 1) {
    n++;
    cursor = prevDate(cursor);
  }
  return n;
}

/** 배열에서 하나 랜덤 (except 는 가능하면 피함) */
export function pickRandom<T>(pool: T[], except?: T | null): T | null {
  if (pool.length === 0) return null;
  const candidates = pool.length > 1 && except != null ? pool.filter((p) => p !== except) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

/** ISO 시각 → KST 날짜 (YYYY-MM-DD) */
export function kstDateOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface ScoreInputRoutine {
  id: string;
  type: string;
  created_at?: string | null;
}

/** 루틴별 체크 행 → 날짜별 한 개수·점수 (오늘 이후 제외) */
export function buildDayScores(
  routines: ScoreInputRoutine[],
  checksByRoutine: Record<string, (DoneCheckRow & { date: string })[]>,
  today: string
): { doneByDate: Map<string, Set<string>>; scoreByDate: Map<string, number> } {
  const doneByDate = new Map<string, Set<string>>();
  for (const r of routines) {
    for (const row of checksByRoutine[r.id] ?? []) {
      if (row.date > today || !isRoutineRowDone(r.type, row)) continue;
      if (!doneByDate.has(row.date)) doneByDate.set(row.date, new Set());
      doneByDate.get(row.date)!.add(r.id);
    }
  }
  const scoreRoutines: ScoreRoutine[] = routines.map((r) => ({ id: r.id, since: kstDateOf(r.created_at) }));
  const scoreByDate = new Map<string, number>();
  for (const [date, set] of doneByDate) scoreByDate.set(date, dayScore(set.size, dayTarget(scoreRoutines, date)));
  return { doneByDate, scoreByDate };
}
