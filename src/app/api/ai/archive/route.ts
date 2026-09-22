import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';
import { kstDate, stripHtml, weekdayOf } from '../../../../lib/aiInsights';

/**
 * 전체 글(Diary) 분석 리포트 — 2단계(월별 요약 → 종합)
 * 서버리스 타임아웃을 피하기 위해 클라이언트가 단계별로 호출한다.
 *   POST { step: 'plan',  category?, from?, to? }  → 월 목록(글 수·글자 수)
 *   POST { step: 'month', month: 'YYYY-MM', category? } → 그 달 요약
 *   POST { step: 'final', category?, from, to, months: [{month,count,summary}] } → 종합 리포트 (ai_reports 저장)
 */
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isoMonth = /^\d{4}-\d{2}$/;
const MONTH_CHAR_BUDGET = 16000; // 한 달치 입력 상한(글자)
const MAX_MONTHS = 36;

type MemoLite = { id: string; title: string | null; content: string | null; created_at: string; category: string | null };

const toCategory = (raw: any): string | null => {
  const c = raw?.memo_categories;
  if (!c) return null;
  return Array.isArray(c) ? c[0]?.name ?? null : c.name ?? null;
};

async function fetchMemos(supabase: any, opts: { category?: string | null; from?: string | null; to?: string | null; withContent: boolean }) {
  const cat = (opts.category || '').trim();
  const cols = `id, title, ${opts.withContent ? 'content, ' : ''}created_at, ${cat ? 'memo_categories!inner(name)' : 'memo_categories(name)'}`;
  // memos 에는 user_id 컬럼이 없음 (RLS 스코프). PostgREST 기본 1000행 상한 → 최신순
  let q = supabase.from('memos').select(cols).order('created_at', { ascending: false }).limit(1000);
  if (opts.from && isoDate.test(opts.from)) q = q.gte('created_at', `${opts.from}T00:00:00+09:00`);
  if (opts.to && isoDate.test(opts.to)) q = q.lte('created_at', `${opts.to}T23:59:59+09:00`);
  if (cat) q = q.eq('memo_categories.name', cat);
  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[]) || []).map<MemoLite>((m) => ({
    id: m.id,
    title: m.title ?? null,
    content: opts.withContent ? m.content ?? null : null,
    created_at: m.created_at,
    category: toCategory(m),
  }));
}

const monthOf = (iso: string) => kstDate(new Date(iso)).slice(0, 7);
const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};
const monthLabel = (month: string) => `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;

const SYSTEM = `너는 "Little Life" 앱 사용자의 Diary(일기·글) 를 읽고 정리하는 개인 기록 분석가다.
사용자가 직접 쓴 글만 근거로 삼고, 없는 사건·감정을 지어내지 않는다. 과잉 해석·심리 진단은 하지 않는다.
한국어 존댓말, 마크다운.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    const supabase = await createSupabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const step = body.step as 'plan' | 'month' | 'final';
    const category: string | null = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : null;

    // ---------- 1) 계획: 월별 글 수 ----------
    if (step === 'plan') {
      const from = body.from && isoDate.test(body.from) ? body.from : null;
      const to = body.to && isoDate.test(body.to) ? body.to : null;
      const memos = await fetchMemos(supabase, { category, from, to, withContent: true });
      const byMonth = new Map<string, { count: number; chars: number }>();
      for (const m of memos) {
        const k = monthOf(m.created_at);
        const cur = byMonth.get(k) || { count: 0, chars: 0 };
        cur.count += 1;
        cur.chars += stripHtml(m.content || '').length;
        byMonth.set(k, cur);
      }
      const months = [...byMonth.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .map(([month, v]) => ({ month, ...v }));
      if (months.length > MAX_MONTHS) {
        return NextResponse.json({ error: `기간이 너무 깁니다 (${months.length}개월). ${MAX_MONTHS}개월 이하로 좁혀 주세요.` }, { status: 400 });
      }
      const dates = memos.map((m) => kstDate(new Date(m.created_at)));
      return NextResponse.json({
        success: true,
        total: memos.length,
        truncated: memos.length >= 1000,
        from: dates.length ? dates[dates.length - 1] : null,
        to: dates.length ? dates[0] : null,
        months,
      });
    }

    // ---------- 2) 월별 요약 ----------
    if (step === 'month') {
      const month: string = body.month;
      if (!isoMonth.test(month || '')) return NextResponse.json({ error: 'month 형식 오류' }, { status: 400 });
      const { from, to } = monthRange(month);
      const memos = (await fetchMemos(supabase, { category, from, to, withContent: true })).reverse(); // 시간순
      if (memos.length === 0) return NextResponse.json({ success: true, month, count: 0, summary: '' });

      const perEntry = Math.max(300, Math.floor(MONTH_CHAR_BUDGET / memos.length));
      const blocks = memos.map((m) => {
        const d = kstDate(new Date(m.created_at));
        const text = stripHtml(m.content || '');
        const cut = text.length > perEntry ? `${text.slice(0, perEntry)}…(생략, 총 ${text.length}자)` : text;
        return `### ${d} (${weekdayOf(d)}) — ${m.title || '제목 없음'}${m.category ? ` [${m.category}]` : ''}\n${cut}`;
      });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        max_tokens: 900,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `아래는 ${monthLabel(month)}에 쓴 글 ${memos.length}편이다${category ? ` (카테고리: ${category})` : ''}.
이 달을 나중에 다른 달과 합쳐 큰 흐름을 볼 수 있도록 300~500자로 압축해라. 형식:
- **주요 사건/활동**: 날짜와 함께 2~4개
- **반복된 주제**: 2~3개 (글에서 쓴 표현을 짧게 인용)
- **감정·상태**: 이 달의 전반적 분위기와 변화 (근거 날짜)
- **인상적인 문장**: 1개 (원문 인용, 날짜)

[글]
${blocks.join('\n\n')}`,
          },
        ],
      });
      const summary = completion.choices[0]?.message?.content?.trim() || '';
      return NextResponse.json({ success: true, month, count: memos.length, summary });
    }

    // ---------- 3) 종합 ----------
    if (step === 'final') {
      const months: { month: string; count: number; summary: string }[] = Array.isArray(body.months) ? body.months : [];
      const valid = months.filter((m) => isoMonth.test(m.month) && m.summary);
      if (valid.length === 0) return NextResponse.json({ error: '요약된 달이 없습니다.' }, { status: 400 });
      valid.sort((a, b) => (a.month < b.month ? -1 : 1));
      const total = valid.reduce((s, m) => s + (Number(m.count) || 0), 0);
      const from = body.from && isoDate.test(body.from) ? body.from : monthRange(valid[0].month).from;
      const to = body.to && isoDate.test(body.to) ? body.to : monthRange(valid[valid.length - 1].month).to;
      const span = valid.length;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: span > 6 ? 2600 : 2000,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `아래는 ${from} ~ ${to} (${span}개월, 글 ${total}편${category ? `, 카테고리 "${category}"` : ''}) 의 월별 요약이다.
이걸 바탕으로 "전체 글 분석" 리포트를 ${span > 6 ? '1200~1800자' : '900~1400자'}로 써라. 월별 요약에 있는 사실·인용만 사용한다.

구성:
## 🧭 큰 흐름
- 기간 전체를 3~5문장으로. 시작과 끝이 어떻게 다른지, 전환점이 된 달/사건
## 🔁 반복된 주제
- 기간 내내 또는 여러 달에 걸쳐 나온 주제 3~5개. 각 주제마다: 언제(어느 달들) 나왔는지 + 원문 인용 1개
## 🌊 감정·에너지의 변화
- 달별 분위기를 짧게 이어서 (예: 3월 지침 → 4월 회복 → …). 근거가 되는 사건
## 💎 남겨둘 문장
- 월별 "인상적인 문장" 중 3개 (날짜와 함께)
## 💡 발견과 제안
- 글을 다시 읽으며 보이는 패턴 2~3개 (예: 힘든 시기에 반복되는 원인, 잘 풀린 시기의 공통점)
- 앞으로 글쓰기·생활에 대한 제안 2개, 근거 한 줄씩

[월별 요약]
${valid.map((m) => `## ${monthLabel(m.month)} (${m.count}편)\n${m.summary}`).join('\n\n')}`,
          },
        ],
      });
      const report = completion.choices[0]?.message?.content?.trim() || '';
      if (!report) return NextResponse.json({ error: '리포트가 비어 있습니다.' }, { status: 500 });

      let saved: any = null;
      let saveError: string | null = null;
      const { data: inserted, error: insErr } = await supabase
        .from('ai_reports')
        .insert({
          user_id: userId,
          kind: 'archive',
          period_from: from,
          period_to: to,
          content: report,
          stats: { category, total, months: valid },
        })
        .select('id, kind, period_from, period_to, content, created_at, stats')
        .single();
      if (insErr) {
        saveError = /kind_check|violates check constraint/i.test(insErr.message)
          ? 'ai_reports 에 archive 종류가 아직 허용되지 않았습니다. add_memo_embeddings.sql 을 실행해 주세요.'
          : insErr.message;
        console.error('archive report save error:', insErr.message);
      } else saved = inserted;

      return NextResponse.json({ success: true, report, period: { from, to }, category, total, months: span, saved, saveError });
    }

    return NextResponse.json({ error: 'step 이 필요합니다 (plan | month | final).' }, { status: 400 });
  } catch (e: any) {
    console.error('archive route error:', e);
    return NextResponse.json({ error: e.message || '전체 글 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
