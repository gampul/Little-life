import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';
import { buildInsightContext, collectInsightData, kstDate } from '../../../../lib/aiInsights';

/**
 * Daily 상단 "오늘의 한 줄" — 최근 14일 루틴·체중·일기를 읽고 1~2문장 인사이트.
 *  GET  : 오늘 저장된 문구가 있으면 그대로, 없으면 생성 후 저장
 *  POST : { force: true } 새로 생성 (↻ 버튼, 루틴 체크·체중 기록 직후)
 * ai_reports 에 kind 'insight' 로 저장 (ai_reports_kind_check 에 insight 필요).
 */
export const maxDuration = 30;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const SYSTEM = `너는 "Little Life" 앱 사용자의 기록(루틴 체크, 체중·체중 메모, 일기)을 읽고, 앱 첫 화면에 띄울 "오늘의 한 줄"을 쓰는 코치다.

규칙:
- 한국어 존댓말, 1~2문장, 합쳐서 70자 이내. 마크다운·따옴표·이모지 금지(문장 맨 앞 이모지 1개는 허용).
- 데이터에 있는 사실과 숫자만 사용한다. 지어내지 않는다.
- 뻔한 말("꾸준히 하세요", "화이팅") 금지. 사용자가 몰랐을 법한 연결·흐름을 하나 짚는다.
  좋은 소재: 연속일 기록(곧 최장), 무너진 루틴, 체중 추이와 루틴/메모의 연결, 일기에 반복된 감정과 루틴의 관계, 오늘 남은 것 중 가장 중요한 하나.
- 오늘 이미 한 일이 있으면 인정하고, 남은 것 하나를 가볍게 권한다.
- 문장만 출력한다.`;

const isKindCheckError = (e: { message?: string } | null | undefined) => !!e && /kind_check|violates check constraint/i.test(e.message || '');
const isMissingTable = (e: { message?: string; code?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|Could not find the table/i.test(e.message || ''));

async function generate(supabase: any, userId: string) {
  const today = kstDate();
  const data = await collectInsightData(supabase, userId, 'weekly', {
    range: { from: kstDateMinus(today, 13), to: today },
    diaryCharLimit: 500,
  });
  const context = buildInsightContext(data);
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 160,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `[데이터 — 최근 14일, 오늘 ${today}]\n${context}\n\n오늘의 한 줄을 써줘.` },
    ],
  });
  const text = (completion.choices[0]?.message?.content || '')
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\n+/g, ' ')
    .slice(0, 160);
  return { text, today };
}

const kstDateMinus = (d: string, n: number) => {
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd - n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

async function save(supabase: any, userId: string, today: string, text: string) {
  const { error } = await supabase.from('ai_reports').insert({
    user_id: userId,
    kind: 'insight',
    period_from: today,
    period_to: today,
    content: text,
  });
  if (error && !isKindCheckError(error) && !isMissingTable(error)) console.error('insight save error:', error.message);
  return !error;
}

async function handle(request: NextRequest, force: boolean) {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const today = kstDate();
  if (!force) {
    const { data: existing, error } = await supabase
      .from('ai_reports')
      .select('content, created_at')
      .eq('user_id', userId)
      .eq('kind', 'insight')
      .eq('period_to', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && existing?.content) {
      return NextResponse.json({ text: existing.content, date: today, cached: true, createdAt: existing.created_at });
    }
  }

  const { text } = await generate(supabase, userId);
  if (!text) return NextResponse.json({ error: '문구를 만들지 못했어요.' }, { status: 500 });
  const saved = await save(supabase, userId, today, text);
  return NextResponse.json({ text, date: today, cached: false, saved });
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request, false);
  } catch (e: any) {
    console.error('insight GET error:', e);
    return NextResponse.json({ error: e.message || '오류' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    return await handle(request, !!body.force);
  } catch (e: any) {
    console.error('insight POST error:', e);
    return NextResponse.json({ error: e.message || '오류' }, { status: 500 });
  }
}
