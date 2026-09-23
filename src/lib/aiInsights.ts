/**
 * AI 리포트/채팅용 Daily(루틴·체중) + Diary 데이터 수집·집계 (서버 전용)
 *
 * - 루틴: routine_templates + daily_routine_checks(sub_values 포함) → 루틴별 달성률·연속일·하위 항목 합계
 * - 체중: daily_records.weight → 기간 시작/끝/최저/최고, 변화량
 * - 일기: memos → 기간 내 글 전문(HTML 제거, 글당 상한) + 카테고리
 * 모든 수치는 여기서 계산해 모델에는 "사실"만 넘긴다 (모델이 수치를 지어내지 않도록).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizeSubItems,
  normalizeSubValues,
  type RoutineSubItem,
  type SubValues,
} from './routineSubItems';

export type ReportKind = 'coach' | 'weekly' | 'monthly';

export const REPORT_DAYS: Record<ReportKind, number> = { coach: 7, weekly: 7, monthly: 30 };
export const REPORT_LABEL: Record<ReportKind, string> = {
  coach: '오늘의 코칭',
  weekly: '주간 리포트',
  monthly: '월간 리포트',
};

const KST_OFFSET = 9 * 60 * 60 * 1000;

/** KST 기준 YYYY-MM-DD */
export const kstDate = (d: Date = new Date()): string => {
  const k = new Date(d.getTime() + KST_OFFSET);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}-${String(k.getUTCDate()).padStart(2, '0')}`;
};

export const addDays = (dateStr: string, n: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayOf = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

export interface RoutineStat {
  label: string;
  type: 'checkbox' | 'number' | 'multi';
  unit?: string;
  doneDays: number;
  totalDays: number;
  rate: number; // %
  streak: number; // 오늘(또는 어제)부터 이어진 연속일
  /** 숫자형: 기간 합계·평균 */
  sum?: number;
  avg?: number;
  /** 복합형: 하위 항목별 체크 횟수·합계 */
  subItems?: { label: string; unit: string; count: number; sum: number }[];
  /** 기간 내 남긴 한 줄 메모 (날짜: 메모) */
  memos: string[];
  /** 놓친 날짜(최근 순) — 코칭용 */
  missedDates: string[];
}

export interface WeightStat {
  first: { date: string; kg: number } | null;
  last: { date: string; kg: number } | null;
  min: number | null;
  max: number | null;
  delta: number | null;
  count: number;
  /** 날짜별 (오래된 순) */
  series: { date: string; kg: number; memo?: string | null }[];
  /** 메모가 있는 기록 수 */
  memoCount: number;
}

export interface DiaryEntry {
  date: string;
  title: string;
  category: string | null;
  text: string;
  chars: number;
}

export interface InsightData {
  kind: ReportKind;
  from: string;
  to: string;
  days: number;
  today: string;
  routines: RoutineStat[];
  weight: WeightStat;
  diary: DiaryEntry[];
  /** 오늘 미완료 루틴 (코칭용) */
  todayMissed: string[];
  todayDone: string[];
  /** 날짜별 달성 수/전체 (오래된 순) */
  dailyCompletion: { date: string; done: number; total: number }[];
}

export const stripHtml = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export async function collectInsightData(
  supabase: SupabaseClient,
  userId: string,
  kind: ReportKind,
  opts?: { diaryCharLimit?: number; /** 임의 기간 (채팅 도구용). 없으면 kind 기본 기간 */ range?: { from: string; to: string } }
): Promise<InsightData> {
  const today = kstDate();
  const to = opts?.range?.to ?? today;
  const from = opts?.range?.from ?? addDays(today, -(REPORT_DAYS[kind] - 1));
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1);
  // 연속일 계산용으로 더 이전 데이터도 읽음 (PostgREST 기본 max-rows 1000 안에 들도록 최근순·상한)
  const streakFrom = from < addDays(today, -120) ? from : addDays(today, -120);
  const diaryCharLimit = opts?.diaryCharLimit ?? (kind === 'monthly' ? 700 : 1500);

  // ---- 루틴 템플릿
  let templates: any[] = [];
  {
    const r = await supabase
      .from('routine_templates')
      .select('id, label, type, unit, sort_order, sub_items, deleted_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (r.error && /sub_items/i.test(r.error.message || '')) {
      const r2 = await supabase
        .from('routine_templates')
        .select('id, label, type, unit, sort_order, deleted_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });
      templates = r2.data || [];
    } else {
      templates = r.data || [];
    }
  }

  // ---- 루틴 체크 (스트릭용 장기간)
  let checks: any[] = [];
  {
    const cols = 'date, routine_id, checked, value, memo, sub_values';
    let r: { data: any[] | null; error: { message?: string } | null } = await supabase
      .from('daily_routine_checks')
      .select(cols)
      .eq('user_id', userId)
      .eq('checked', true)
      .gte('date', streakFrom)
      .lte('date', to)
      .order('date', { ascending: false })
      .limit(1000);
    if (r.error && /sub_values/i.test(r.error.message || '')) {
      r = await supabase
        .from('daily_routine_checks')
        .select('date, routine_id, checked, value, memo')
        .eq('user_id', userId)
        .eq('checked', true)
        .gte('date', streakFrom)
        .lte('date', to)
        .order('date', { ascending: false })
        .limit(1000);
    }
    if (r.error) console.error('daily_routine_checks load error:', r.error.message);
    checks = r.data || [];
  }

  const byRoutine = new Map<string, Map<string, any>>();
  for (const c of checks) {
    if (!byRoutine.has(c.routine_id)) byRoutine.set(c.routine_id, new Map());
    byRoutine.get(c.routine_id)!.set(c.date, c);
  }

  const periodDates: string[] = [];
  for (let i = 0; i < days; i++) periodDates.push(addDays(from, i));

  const routines: RoutineStat[] = templates.map((t) => {
    const rows = byRoutine.get(t.id) ?? new Map<string, any>();
    const type = (t.type || 'checkbox') as RoutineStat['type'];
    const subItems: RoutineSubItem[] = normalizeSubItems(t.sub_items);

    const inPeriod = periodDates.filter((d) => rows.has(d));
    const doneDays = inPeriod.length;

    // 연속일: 오늘 체크됐으면 오늘부터, 아니면 어제부터
    let streak = 0;
    let cursor = rows.has(today) ? today : addDays(today, -1);
    while (rows.has(cursor) && streak < 120) {
      streak++;
      cursor = addDays(cursor, -1);
    }

    const stat: RoutineStat = {
      label: t.label,
      type,
      unit: t.unit || undefined,
      doneDays,
      totalDays: days,
      rate: Math.round((doneDays / days) * 100),
      streak,
      memos: [],
      missedDates: periodDates.filter((d) => !rows.has(d)).reverse().slice(0, 10),
    };

    if (type === 'number') {
      const vals = inPeriod.map((d) => Number(rows.get(d).value)).filter((v) => Number.isFinite(v) && v > 0);
      const sum = vals.reduce((a, b) => a + b, 0);
      stat.sum = Math.round(sum * 10) / 10;
      stat.avg = vals.length ? Math.round((sum / vals.length) * 10) / 10 : 0;
    }
    if (type === 'multi' && subItems.length) {
      stat.subItems = subItems.map((it) => {
        let count = 0;
        let sum = 0;
        for (const d of inPeriod) {
          const sv: SubValues = normalizeSubValues(rows.get(d).sub_values);
          if (Object.prototype.hasOwnProperty.call(sv, it.key)) {
            count++;
            if (sv[it.key] != null) sum += Number(sv[it.key]);
          }
        }
        return { label: it.label, unit: it.unit, count, sum: Math.round(sum * 10) / 10 };
      });
    }
    for (const d of inPeriod) {
      const m = rows.get(d).memo;
      if (m && String(m).trim()) stat.memos.push(`${d.slice(5)}: ${String(m).trim().slice(0, 120)}`);
    }
    return stat;
  });

  const dailyCompletion = periodDates.map((d) => ({
    date: d,
    done: templates.filter((t) => byRoutine.get(t.id)?.has(d)).length,
    total: templates.length,
  }));
  const todayDone = templates.filter((t) => byRoutine.get(t.id)?.has(today)).map((t) => t.label);
  const todayMissed = templates.filter((t) => !byRoutine.get(t.id)?.has(today)).map((t) => t.label);

  // ---- 체중
  // weight_memo 컬럼(add_weight_memo_images.sql)이 없는 DB 는 체중만 조회
  let recsRes: { data: any[] | null; error: { code?: string; message?: string } | null } = await supabase
    .from('daily_records')
    .select('date, weight, weight_memo')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .not('weight', 'is', null)
    .order('date', { ascending: true });
  if (recsRes.error && (recsRes.error.code === '42703' || /weight_memo/.test(recsRes.error.message || ''))) {
    recsRes = await supabase
      .from('daily_records')
      .select('date, weight')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)
      .not('weight', 'is', null)
      .order('date', { ascending: true });
  }
  const series = ((recsRes.data as any[]) || [])
    .map((r: any) => ({
      date: r.date as string,
      kg: Number(r.weight),
      memo: typeof r.weight_memo === 'string' && r.weight_memo.trim() ? r.weight_memo.trim().slice(0, 200) : null,
    }))
    .filter((r) => Number.isFinite(r.kg) && r.kg > 0);
  const kgs = series.map((s) => s.kg);
  const weight: WeightStat = {
    first: series[0] ?? null,
    last: series[series.length - 1] ?? null,
    min: kgs.length ? Math.min(...kgs) : null,
    max: kgs.length ? Math.max(...kgs) : null,
    delta: series.length >= 2 ? Math.round((series[series.length - 1].kg - series[0].kg) * 10) / 10 : null,
    count: series.length,
    series,
    memoCount: series.filter((s) => s.memo).length,
  };

  // ---- 일기 (기간 내, created_at 기준)
  // memos 테이블에는 user_id 컬럼이 없음(RLS 로 사용자 스코프) — 앱의 useMemos 와 동일하게 필터 없이 조회
  const { data: memos, error: memoErr } = await supabase
    .from('memos')
    .select('title, content, created_at, memo_categories(name)')
    .gte('created_at', `${from}T00:00:00+09:00`)
    .lte('created_at', `${to}T23:59:59+09:00`)
    .order('created_at', { ascending: true })
    .limit(days > 31 ? 120 : days > 7 ? 60 : 30);
  if (memoErr) console.error('memos load error:', memoErr.message);
  const diary: DiaryEntry[] = (memos || []).map((m: any) => {
    const text = stripHtml(m.content || '');
    return {
      date: kstDate(new Date(m.created_at)),
      title: m.title || '제목 없음',
      category: m.memo_categories?.name ?? null,
      text: text.length > diaryCharLimit ? `${text.slice(0, diaryCharLimit)}…(이하 생략)` : text,
      chars: text.length,
    };
  });

  return { kind, from, to, days, today, routines, weight, diary, todayMissed, todayDone, dailyCompletion };
}

/** 모델에 넘길 압축 컨텍스트 (사실만, 마크다운) */
export function buildInsightContext(d: InsightData): string {
  const lines: string[] = [];
  lines.push(`# 기간: ${d.from} ~ ${d.to} (${d.days}일, 오늘 ${d.today} ${weekdayOf(d.today)}요일)`);

  lines.push('\n## 루틴 (기간 내 달성)');
  if (d.routines.length === 0) lines.push('- 등록된 루틴 없음');
  for (const r of d.routines) {
    let extra = '';
    if (r.type === 'number') extra = `, 합계 ${r.sum}${r.unit || ''} / 일평균 ${r.avg}${r.unit || ''}`;
    if (r.type === 'multi' && r.subItems) {
      extra = ', 항목: ' + r.subItems.map((s) => `${s.label} ${s.count}회${s.sum ? ` ${s.sum}${s.unit}` : ''}`).join(' · ');
    }
    lines.push(`- ${r.label}: ${r.doneDays}/${r.totalDays}일 (${r.rate}%), 연속 ${r.streak}일${extra}`);
    if (r.missedDates.length && r.missedDates.length < r.totalDays)
      lines.push(`  - 놓친 날: ${r.missedDates.slice(0, 7).map((x) => `${x.slice(5)}(${weekdayOf(x)})`).join(', ')}`);
    for (const m of r.memos.slice(-5)) lines.push(`  - 메모 ${m}`);
  }

  lines.push('\n## 날짜별 달성 (완료/전체)');
  lines.push(d.dailyCompletion.map((c) => `${c.date.slice(5)}(${weekdayOf(c.date)}) ${c.done}/${c.total}`).join(', '));
  lines.push(`\n오늘 완료: ${d.todayDone.join(', ') || '없음'} / 오늘 미완료: ${d.todayMissed.join(', ') || '없음'}`);

  lines.push('\n## 체중');
  if (d.weight.count === 0) lines.push('- 기간 내 체중 기록 없음');
  else {
    lines.push(
      `- 기록 ${d.weight.count}회, 시작 ${d.weight.first!.date} ${d.weight.first!.kg}kg → 최근 ${d.weight.last!.date} ${d.weight.last!.kg}kg (변화 ${d.weight.delta != null ? (d.weight.delta > 0 ? '+' : '') + d.weight.delta : '-'}kg), 최저 ${d.weight.min}kg / 최고 ${d.weight.max}kg`
    );
    lines.push('- 추이: ' + d.weight.series.map((s) => `${s.date.slice(5)} ${s.kg}`).join(', '));
    const withMemo = d.weight.series.filter((s) => s.memo);
    if (withMemo.length) {
      lines.push('- 체중 메모 (사용자가 직접 남김):');
      for (const s of withMemo.slice(-10)) lines.push(`  - ${s.date}: ${s.memo}`);
    }
  }

  lines.push(`\n## 일기 (${d.diary.length}편)`);
  if (d.diary.length === 0) lines.push('- 기간 내 일기 없음');
  for (const e of d.diary) {
    lines.push(`\n### ${e.date} (${weekdayOf(e.date)}) — ${e.title}${e.category ? ` [${e.category}]` : ''} (${e.chars}자)`);
    lines.push(e.text || '(본문 없음)');
  }
  return lines.join('\n');
}

/** 채팅 도구용 짧은 루틴 요약 (숫자만) */
export function summarizeRoutinesForChat(d: InsightData): Record<string, unknown> {
  return {
    period: `${d.from} ~ ${d.to}`,
    routines: d.routines.map((r) => ({
      label: r.label,
      done: `${r.doneDays}/${r.totalDays}`,
      rate: `${r.rate}%`,
      streak: r.streak,
      ...(r.sum != null ? { sum: `${r.sum}${r.unit || ''}` } : {}),
      ...(r.subItems ? { items: r.subItems.map((s) => `${s.label} ${s.count}회 ${s.sum}${s.unit}`) } : {}),
    })),
    todayMissed: d.todayMissed,
    weight: d.weight.count
      ? { first: d.weight.first, last: d.weight.last, delta: d.weight.delta, min: d.weight.min, max: d.weight.max }
      : null,
  };
}
