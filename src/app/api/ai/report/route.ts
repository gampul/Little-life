import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';
import {
  buildInsightContext,
  collectInsightData,
  REPORT_LABEL,
  type ReportKind,
} from '../../../../lib/aiInsights';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const KINDS: ReportKind[] = ['coach', 'weekly', 'monthly'];
const normalizeKind = (v: unknown): ReportKind => {
  if (v === 'daily' || v === 'lifestyle') return 'coach'; // 구버전 호환
  return KINDS.includes(v as ReportKind) ? (v as ReportKind) : 'weekly';
};

const SYSTEM_PROMPT = `# 역할
너는 "Little Life" 앱 사용자의 개인 라이프 코치다. 사용자가 매일 기록한 루틴 체크, 체중, 일기를 읽고
그 사람만을 위한 요약·분석·제안을 한국어로 쓴다. 따뜻하지만 솔직하게, 친구가 조언하듯 존댓말로.

# 절대 규칙
1. 아래 [데이터]에 있는 사실과 숫자만 사용한다. 없는 수치·사건은 절대 지어내지 않는다.
2. 수치를 인용할 때는 데이터의 값을 그대로 쓴다 (예: "글쓰기 5/7일(71%)").
3. 일기는 사용자가 쓴 글이다. 내용을 근거로 감정·관심사·고민을 짚되, 과잉 해석·진단은 하지 않는다.
4. 데이터가 없는 영역은 한 줄로 "기록이 없어요"라고만 말하고 넘어간다.
5. 제안은 구체적이고 작아야 한다 (내일/이번 주에 바로 할 수 있는 것). 뻔한 일반론("꾸준히 하세요") 금지.
6. 마크다운 사용. 이모지는 섹션 제목에만 최소한으로.`;

const KIND_PROMPTS: Record<ReportKind, string> = {
  coach: `오늘의 코칭을 써줘. 매일 아침에 읽는 짧은 글이다. 250~400자.
구성:
1. 한 줄 인사 + 최근 7일 흐름 중 가장 눈에 띄는 것 하나 (연속일 기록, 무너진 루틴, 체중 변화, 일기에서 드러난 마음 중 택1)
2. **오늘 할 것**: 오늘 미완료 루틴 중 우선순위 1~2개를 이유와 함께 (연속일이 끊길 위험이 있는 것을 우선)
3. 마지막 한 문장 응원 (일기 내용과 연결되면 더 좋음)`,

  weekly: `주간 리포트를 써줘. 600~900자.
구성:
## 📊 이번 주 요약
- 전체 달성 흐름 (날짜별 완료/전체 데이터로 잘된 날·무너진 날, 요일 패턴)
- 루틴별 하이라이트: 잘 지킨 것(연속일 포함) 2~3개, 흔들린 것 1~2개 — 숫자로
- 체중: 시작→최근, 변화량, 추이 해석 (기록 없으면 한 줄)
## 📝 일기에서
- 이번 주 일기 전체를 읽고 반복된 주제·감정·고민 2~3개를 사용자의 표현을 인용해 정리 (없으면 한 줄)
- 루틴 데이터와 일기 사이의 연결점이 있으면 짚기 (예: 일기에서 피곤함을 자주 말한 주에 운동이 빠짐)
## ✅ 다음 주 제안
- 딱 3개. 각각 "무엇을, 언제, 어떻게" + 근거가 되는 데이터 한 줄`,

  monthly: `월간 리포트를 써줘. 900~1300자.
구성:
## 📊 이번 달 요약
- 루틴별 달성률 표 (마크다운 표: 루틴 | 달성 | 연속 | 비고). 숫자형·복합형은 합계 포함
- 날짜별 완료/전체 데이터로 상반기·하반기 흐름, 주말/평일 차이
- 체중: 시작→최근, 최저/최고, 추이 해석
## 📝 한 달의 일기
- 일기를 시간순으로 읽고 이 달의 큰 흐름(사건, 관심사, 감정 변화)을 3~5문장으로. 사용자의 표현 인용
- 자주 등장한 주제 3개
## 💡 발견
- 루틴·체중·일기를 교차해서 보이는 패턴 2~3개 (근거 데이터 명시)
## ✅ 다음 달 제안
- 3개. 하나는 "줄이거나 그만둘 것"이어도 좋다. 각각 근거 한 줄`,
};

const isMissingTable = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(e.message || ''));

/** 저장된 리포트 목록 (최근 20개) */
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { data, error } = await supabase
    .from('ai_reports')
    .select('id, kind, period_from, period_to, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ reports: [], tableMissing: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ reports: data ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const kind = normalizeKind(body.reportType ?? body.kind);
    const force = !!body.force;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const supabase = await createSupabaseServer();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const data = await collectInsightData(supabase, userId, kind);

    // 같은 기간에 이미 만든 리포트가 있으면 재사용 (force 면 새로 생성)
    if (!force) {
      const { data: existing, error } = await supabase
        .from('ai_reports')
        .select('id, kind, period_from, period_to, content, created_at')
        .eq('user_id', userId)
        .eq('kind', kind)
        .eq('period_to', data.to)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && existing) {
        return NextResponse.json({ success: true, report: existing.content, reportType: kind, kind, cached: true, saved: existing });
      }
    }

    const context = buildInsightContext(data);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `[데이터]\n${context}\n\n---\n\n${KIND_PROMPTS[kind]}` },
      ],
      max_tokens: kind === 'monthly' ? 2200 : 1400,
      temperature: 0.4,
    });
    const report = completion.choices[0]?.message?.content?.trim() || '';
    if (!report) return NextResponse.json({ error: '리포트가 비어 있습니다. 다시 시도해 주세요.' }, { status: 500 });

    // 저장 (테이블이 없으면 건너뛰고 안내)
    let saved: any = null;
    let tableMissing = false;
    const { data: inserted, error: insErr } = await supabase
      .from('ai_reports')
      .insert({
        user_id: userId,
        kind,
        period_from: data.from,
        period_to: data.to,
        content: report,
        stats: {
          routines: data.routines.map((r) => ({ label: r.label, rate: r.rate, streak: r.streak })),
          weight: { first: data.weight.first, last: data.weight.last, delta: data.weight.delta },
          diaryCount: data.diary.length,
        },
      })
      .select('id, kind, period_from, period_to, content, created_at')
      .single();
    if (insErr) {
      if (isMissingTable(insErr)) tableMissing = true;
      else console.error('ai_reports insert error:', insErr.message);
    } else saved = inserted;

    return NextResponse.json({
      success: true,
      report,
      reportType: kind,
      kind,
      label: REPORT_LABEL[kind],
      period: { from: data.from, to: data.to },
      cached: false,
      saved,
      tableMissing,
      meta: {
        routineCount: data.routines.length,
        diaryCount: data.diary.length,
        weightCount: data.weight.count,
      },
    });
  } catch (error: any) {
    console.error('AI Report Error:', error);
    return NextResponse.json({ error: error.message || '리포트 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
