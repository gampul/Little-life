import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';
import {
  addDays,
  collectInsightData,
  kstDate,
  stripHtml,
  weekdayOf,
  type InsightData,
} from '../../../../lib/aiInsights';
import { normalizeSubItems, normalizeSubValues, summarizeSubValues } from '../../../../lib/routineSubItems';
import { isEmbeddingSetupMissing, searchMemosSemantic } from '../../../../lib/memoEmbeddings';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

const MAX_HISTORY = 16; // 최근 대화 턴 수
const MAX_TOOL_ROUNDS = 4; // 도구 호출 라운드 상한

type ChatTurn = { role: 'user' | 'assistant'; content: string };

async function getSupabaseWithUserId() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const clampRange = (from?: string, to?: string, defaultDays = 7) => {
  const today = kstDate();
  let t = to && isoDate.test(to) ? to : today;
  if (t > today) t = today;
  let f = from && isoDate.test(from) ? from : addDays(t, -(defaultDays - 1));
  if (f > t) f = t;
  // 상한 120일
  if (Date.parse(t) - Date.parse(f) > 120 * 86400000) f = addDays(t, -119);
  return { from: f, to: t };
};

// ============================================
// 도구 정의 — "무엇을 알고 싶은가" 단위
// ============================================
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_routine_stats',
      description:
        '기간 동안의 루틴 달성 통계. 루틴별 달성일/전체일·달성률·연속일, 숫자형 합계, 복합형(800km 등) 하위 항목 횟수·합계, 날짜별 완료 수, 오늘 완료/미완료 목록, 기간 내 한 줄 메모. "이번 주 루틴 어땠어", "독서 며칠 했어", "800km 얼마나 했어", "오늘 뭐 남았어" 류.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '시작일 YYYY-MM-DD (기본: 오늘-6일)' },
          to: { type: 'string', description: '종료일 YYYY-MM-DD (기본: 오늘)' },
          routine: { type: 'string', description: '특정 루틴 이름(부분 일치). 생략하면 전체' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_day_detail',
      description:
        '특정 하루의 상세: 그날 각 루틴의 체크 여부·값·메모, 체중, 그날 쓴 일기 전문. "어제 뭐 했어", "9월 17일 어땠어", "그날 일기 보여줘" 류. 날짜가 대화에서 정해졌으면 그 날짜를 넣는다.',
      parameters: {
        type: 'object',
        properties: { date: { type: 'string', description: 'YYYY-MM-DD' } },
        required: ['date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_diary',
      description:
        '일기 목록 열람(정확 일치). 기간·카테고리로 최신순 글을 가져오거나, 정확한 단어(제목·본문 부분 일치)로 찾는다. "지난달 일기 요약", "독서 카테고리 최근 글", "9월에 쓴 글 목록", 고유명사·정확한 단어 검색에 적합. 기간 제한 없음(오래된 글도 가능). 의미·주제로 찾을 때는 semantic_search_diary 를 쓴다.',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '정확히 포함될 단어 (선택)' },
          category: { type: 'string', description: '카테고리 이름 (선택, 목록 참고)' },
          from: { type: 'string', description: '시작일 YYYY-MM-DD (선택)' },
          to: { type: 'string', description: '종료일 YYYY-MM-DD (선택)' },
          limit: { type: 'number', description: '최대 개수 (기본 8, 최대 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'semantic_search_diary',
      description:
        '일기 의미 검색(전체 기간). 질문의 뜻과 비슷한 내용을 쓴 글을 찾는다 — 표현이 달라도 됨("회사 옮길까" 로 쓴 글을 "이직 고민" 으로 찾음). "내가 ~에 대해 뭐라고 썼지", "~했을 때 기분", "비슷한 고민 한 적 있어?", "예전에 ~ 생각한 적", 주제·감정·상황 질문에 우선 사용. 기간·카테고리로 좁힐 수 있다.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '찾고 싶은 내용을 자연어 한 문장으로 (사용자 질문을 그대로 넣기보다 핵심 주제로)' },
          category: { type: 'string', description: '카테고리 이름 (선택)' },
          from: { type: 'string', description: '시작일 YYYY-MM-DD (선택)' },
          to: { type: 'string', description: '종료일 YYYY-MM-DD (선택)' },
          limit: { type: 'number', description: '최대 개수 (기본 6, 최대 12)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weight_trend',
      description: '기간 동안 체중 기록: 시작·최근·최저·최고·변화량·날짜별 추이. "체중 어때", "한 달 전보다", "살 빠졌어?" 류.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '시작일 YYYY-MM-DD (기본: 오늘-29일)' },
          to: { type: 'string', description: '종료일 YYYY-MM-DD (기본: 오늘)' },
        },
      },
    },
  },
];

// ============================================
// 도구 구현
// ============================================
const routineSummary = (d: InsightData, filter?: string) => {
  const list = filter
    ? d.routines.filter((r) => r.label.toLowerCase().includes(filter.toLowerCase()))
    : d.routines;
  return list.map((r) => ({
    routine: r.label,
    type: r.type,
    done: `${r.doneDays}/${r.totalDays}일`,
    rate: `${r.rate}%`,
    streak: `${r.streak}일 연속`,
    ...(r.type === 'number' ? { sum: `${r.sum}${r.unit || ''}`, avg: `${r.avg}${r.unit || ''}/일` } : {}),
    ...(r.subItems ? { items: r.subItems.map((s) => `${s.label}: ${s.count}회${s.sum ? ` 합계 ${s.sum}${s.unit}` : ''}`) } : {}),
    missedDates: r.missedDates.slice(0, 7),
    memos: r.memos.slice(-5),
  }));
};

async function getRoutineStats(args: { from?: string; to?: string; routine?: string }) {
  const { supabase, userId } = await getSupabaseWithUserId();
  if (!userId) return { error: '로그인이 필요합니다.' };
  const { from, to } = clampRange(args.from, args.to, 7);
  const d = await collectInsightData(supabase, userId, 'weekly', { range: { from, to }, diaryCharLimit: 0 });
  const routines = routineSummary(d, args.routine);
  if (args.routine && routines.length === 0) {
    return { period: `${from} ~ ${to}`, message: `'${args.routine}' 와 비슷한 이름의 루틴이 없습니다.`, availableRoutines: d.routines.map((r) => r.label) };
  }
  return {
    period: `${from} ~ ${to} (${d.days}일)`,
    today: `${d.today} (${weekdayOf(d.today)})`,
    routines,
    dailyCompletion: d.dailyCompletion.map((c) => `${c.date}(${weekdayOf(c.date)}) ${c.done}/${c.total}`),
    todayDone: d.todayDone,
    todayMissed: d.todayMissed,
  };
}

async function getDayDetail(args: { date: string }) {
  const { supabase, userId } = await getSupabaseWithUserId();
  if (!userId) return { error: '로그인이 필요합니다.' };
  const today = kstDate();
  const date = isoDate.test(args.date || '') ? args.date : today;
  if (date > today) return { error: `${date} 는 미래 날짜입니다. 오늘은 ${today} 입니다.` };

  const [{ data: templates }, checksRes, { data: rec }, { data: memos }] = await Promise.all([
    supabase
      .from('routine_templates')
      .select('id, label, type, unit, sort_order, sub_items')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('daily_routine_checks')
      .select('routine_id, checked, value, memo, sub_values, image_urls')
      .eq('user_id', userId)
      .eq('date', date),
    supabase.from('daily_records').select('weight, daily_memo').eq('user_id', userId).eq('date', date).maybeSingle(),
    supabase
      .from('memos')
      .select('title, content, created_at, memo_categories(name)')
      .gte('created_at', `${date}T00:00:00+09:00`)
      .lte('created_at', `${date}T23:59:59+09:00`)
      .order('created_at', { ascending: true })
      .limit(10),
  ]);

  const checks = new Map<string, any>();
  for (const c of checksRes.data || []) checks.set(c.routine_id, c);
  const routines = (templates || []).map((t: any) => {
    const c = checks.get(t.id);
    const done = !!c?.checked;
    let value: string | null = null;
    if (done && t.type === 'number' && c.value != null) value = `${c.value}${t.unit || ''}`;
    if (done && t.type === 'multi') value = summarizeSubValues(normalizeSubValues(c.sub_values), normalizeSubItems(t.sub_items)) || '체크만';
    return {
      routine: t.label,
      done,
      ...(value ? { value } : {}),
      ...(c?.memo ? { memo: String(c.memo) } : {}),
      ...(Array.isArray(c?.image_urls) && c.image_urls.length ? { photos: c.image_urls.length } : {}),
    };
  });

  return {
    date: `${date} (${weekdayOf(date)})`,
    completed: `${routines.filter((r) => r.done).length}/${routines.length}`,
    routines,
    weight: rec?.weight != null ? `${rec.weight}kg` : null,
    dailyMemo: rec?.daily_memo || null,
    diary: (memos || []).map((m: any) => ({
      title: m.title || '제목 없음',
      category: m.memo_categories?.name ?? null,
      text: stripHtml(m.content || '').slice(0, 2000),
    })),
  };
}

async function searchDiary(args: { keyword?: string; category?: string; from?: string; to?: string; limit?: number }) {
  const { supabase, userId } = await getSupabaseWithUserId();
  if (!userId) return { error: '로그인이 필요합니다.' };
  const limit = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
  const keyword = (args.keyword || '').trim();
  const category = (args.category || '').trim();

  // memos 에는 user_id 컬럼이 없음 (RLS 스코프)
  let q = supabase
    .from('memos')
    .select(category ? 'title, content, created_at, memo_categories!inner(name)' : 'title, content, created_at, memo_categories(name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (args.from && isoDate.test(args.from)) q = q.gte('created_at', `${args.from}T00:00:00+09:00`);
  if (args.to && isoDate.test(args.to)) q = q.lte('created_at', `${args.to}T23:59:59+09:00`);
  if (keyword) q = q.or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`);
  if (category) q = q.ilike('memo_categories.name', `%${category}%`);

  const { data, error } = await q;
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return {
      count: 0,
      message: keyword
        ? `'${keyword}' 가 들어간 일기가 없습니다. 표현이 다를 수 있으니 semantic_search_diary 로 다시 찾아보세요.`
        : category
          ? `'${category}' 카테고리에 해당 기간 일기가 없습니다.`
          : '해당 기간에 일기가 없습니다.',
    };
  }
  const perEntry = data.length > 6 ? 900 : 1800;
  return {
    count: data.length,
    keyword: keyword || null,
    entries: data.map((m: any) => {
      const text = stripHtml(m.content || '');
      const d = kstDate(new Date(m.created_at));
      return {
        date: `${d} (${weekdayOf(d)})`,
        title: m.title || '제목 없음',
        category: m.memo_categories?.name ?? null,
        text: text.length > perEntry ? `${text.slice(0, perEntry)}…(이하 생략, 총 ${text.length}자)` : text,
      };
    }),
  };
}

async function getWeightTrend(args: { from?: string; to?: string }) {
  const { supabase, userId } = await getSupabaseWithUserId();
  if (!userId) return { error: '로그인이 필요합니다.' };
  const { from, to } = clampRange(args.from, args.to, 30);
  const { data } = await supabase
    .from('daily_records')
    .select('date, weight')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .not('weight', 'is', null)
    .order('date', { ascending: true });
  const series = (data || []).map((r: any) => ({ date: r.date, kg: Number(r.weight) })).filter((r) => r.kg > 0);
  if (series.length === 0) return { period: `${from} ~ ${to}`, message: '해당 기간에 체중 기록이 없습니다.' };
  const kgs = series.map((s) => s.kg);
  const first = series[0];
  const last = series[series.length - 1];
  return {
    period: `${from} ~ ${to}`,
    count: series.length,
    first: `${first.date} ${first.kg}kg`,
    last: `${last.date} ${last.kg}kg`,
    delta: `${(last.kg - first.kg >= 0 ? '+' : '')}${Math.round((last.kg - first.kg) * 10) / 10}kg`,
    min: `${Math.min(...kgs)}kg`,
    max: `${Math.max(...kgs)}kg`,
    avg: `${Math.round((kgs.reduce((a, b) => a + b, 0) / kgs.length) * 10) / 10}kg`,
    series: series.map((s) => `${s.date.slice(5)} ${s.kg}`).join(', '),
  };
}

async function semanticSearchDiary(args: { query?: string; category?: string; from?: string; to?: string; limit?: number }) {
  const { supabase, userId } = await getSupabaseWithUserId();
  if (!userId) return { error: '로그인이 필요합니다.' };
  const query = (args.query || '').trim();
  if (!query) return { error: 'query 가 필요합니다.' };
  try {
    const matches = await searchMemosSemantic(supabase, query, {
      limit: Math.min(Math.max(Number(args.limit) || 6, 1), 12),
      category: (args.category || '').trim() || null,
      from: args.from && isoDate.test(args.from) ? args.from : null,
      to: args.to && isoDate.test(args.to) ? args.to : null,
    });
    if (matches.length === 0) {
      return { count: 0, message: '비슷한 내용의 일기를 찾지 못했습니다. (AI Agent 페이지에서 "일기 색인" 이 완료되어 있어야 검색됩니다.)' };
    }
    return {
      count: matches.length,
      query,
      note: 'text 는 글에서 가장 관련 있는 부분(발췌)이다. 전문이 필요하면 get_day_detail(date) 로 그날 일기를 읽는다.',
      entries: matches.map((m) => ({ date: m.date, title: m.title, category: m.category, similarity: m.similarity, text: m.text })),
    };
  } catch (e: any) {
    if (isEmbeddingSetupMissing(e)) {
      return { error: '의미 검색 준비가 안 되어 있습니다(임베딩 테이블 없음). 대신 search_diary 를 사용하세요.' };
    }
    return { error: e?.message || '의미 검색 오류' };
  }
}

async function executeTool(name: string, args: any) {
  switch (name) {
    case 'semantic_search_diary':
      return semanticSearchDiary(args || {});
    case 'get_routine_stats':
      return getRoutineStats(args || {});
    case 'get_day_detail':
      return getDayDetail(args || {});
    case 'search_diary':
      return searchDiary(args || {});
    case 'get_weight_trend':
      return getWeightTrend(args || {});
    default:
      return { error: `알 수 없는 도구: ${name}` };
  }
}

// ============================================
// 시스템 프롬프트 — 오늘 날짜 + 사용자의 루틴 목록을 넣어 지시어·루틴명 해석의 기준을 준다
// ============================================
async function buildSystemPrompt(): Promise<string> {
  const { supabase, userId } = await getSupabaseWithUserId();
  const today = kstDate();
  const wd = weekdayOf(today);
  // 이번 주 = 월요일 시작
  const dow = ['일', '월', '화', '수', '목', '금', '토'].indexOf(wd);
  const monday = addDays(today, -((dow + 6) % 7));

  let routineLines = '- (루틴 정보를 불러오지 못함)';
  let categoryLine = '(없음)';
  if (userId) {
    const { data: cats } = await supabase.from('memo_categories').select('name').order('sort_order', { ascending: true }).limit(50);
    if (cats?.length) categoryLine = cats.map((c: any) => c.name).filter(Boolean).join(', ');
    const { data } = await supabase
      .from('routine_templates')
      .select('label, type, unit, sub_items')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });
    if (data?.length) {
      routineLines = data
        .map((t: any) => {
          if (t.type === 'number') return `- ${t.label} (숫자형, 단위 ${t.unit || '없음'})`;
          if (t.type === 'multi')
            return `- ${t.label} (복합형: ${normalizeSubItems(t.sub_items).map((s) => `${s.label}[${s.unit || '체크'}]`).join(', ')})`;
          return `- ${t.label} (체크형)`;
        })
        .join('\n');
    }
  }

  return `# 역할
너는 "Little Life" 앱 사용자의 개인 라이프 코치이자 데이터 비서다. 사용자가 매일 기록하는 Daily(루틴 체크, 체중)와 Diary(일기)를 도구로 조회해 답한다.

# 오늘
- 오늘: ${today} (${wd}요일). 이번 주: ${monday} ~ ${today} (월요일 시작). 어제: ${addDays(today, -1)}.
- "이번 주"는 이번 주 월요일부터 오늘, "지난 주"는 ${addDays(monday, -7)} ~ ${addDays(monday, -1)}, "최근/요즘"은 오늘 포함 7일, "지난달/한 달"은 오늘 포함 30일로 해석한다. 사용자가 날짜를 명시하면 그것을 우선한다.

# 사용자의 루틴 (이 이름으로 부른다)
${routineLines}

# Diary 카테고리
${categoryLine}

# 답하는 원칙
1. 먼저 사용자가 무엇을 알고 싶은지 정한다: (a) 사실 확인(며칠 했나, 몇 kg인가) (b) 흐름·비교(늘었나, 지난주보다) (c) 일기 내용·감정 (d) 조언·다음 행동 (e) 그냥 대화(인사, 감사, 의견). 이전 대화의 주제·날짜·루틴명을 이어받는다 ("그럼 지난주는?" → 같은 루틴, 지난주 기간).
2. 데이터가 필요하면 도구를 호출한다. 필요 없는 대화(인사, 감사, 개념 질문, 이미 조회한 데이터로 답할 수 있는 후속 질문)에는 호출하지 않는다. 한 질문에 여러 조회가 필요하면 이어서 호출한다 (예: 루틴 통계로 무너진 날을 찾고 → 그날 상세를 본다).
3. 루틴 이름이 애매하면(예: "운동") 위 목록에서 가장 가까운 것을 고르고 답에 그 이름을 밝힌다. 정말 모호하면 짧게 되묻는다.
4. 숫자는 도구 결과에서만 인용한다. 없는 수치·사건은 만들지 않는다. 데이터가 없으면 없다고 말한다.
5. 조언은 조회한 데이터에 근거해 구체적으로 (어떤 루틴을, 언제, 어떻게). 뻔한 일반론은 피한다.
6. 일기 내용을 말할 때는 사용자의 표현을 짧게 인용하고, 과잉 해석·진단은 하지 않는다.
7. 일기 질문은 두 도구를 구분한다: 주제·감정·상황("~에 대해 뭐라고 썼어", "비슷한 고민", "예전에 ~ 생각한 적")은 semantic_search_diary 를 먼저 쓴다(기간 제한 없음, 표현이 달라도 찾음). 정확한 단어·고유명사, 특정 기간/카테고리의 글 목록·요약은 search_diary 를 쓴다. 검색 결과에 없는 글은 없다고 말한다. 답할 때는 날짜(와 제목)를 함께 적어 사용자가 원문을 찾을 수 있게 한다.

# 말투·형식
- 한국어 존댓말, 친근하고 담백하게. 질문 크기에 맞게: 단순 확인은 1~3문장, 분석·조언은 짧은 문단 몇 개. 마크다운 목록·굵게는 필요할 때만.
- 마지막에 도구 이름이나 내부 동작을 언급하지 않는다.`;
}

// ============================================
// API 라우트
// ============================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const message: string = (body.message || '').toString().trim();
    const historyRaw: ChatTurn[] = Array.isArray(body.history) ? body.history : [];

    if (!message) return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });

    // 최근 대화만, 내용 길이 제한
    const history = historyRaw
      .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string' && t.content.trim())
      .slice(-MAX_HISTORY)
      .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));

    const systemPrompt = await buildSystemPrompt();
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    const functionsUsed: string[] = [];
    let finalText = '';

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        // 마지막 라운드에서는 도구 없이 답을 마무리
        tool_choice: round === MAX_TOOL_ROUNDS ? 'none' : 'auto',
        max_tokens: 1200,
        temperature: 0.4,
      });
      const msg = completion.choices[0]?.message;
      if (!msg) break;

      const calls = (msg.tool_calls || []).filter((c: any) => c.type === 'function');
      if (calls.length === 0) {
        finalText = msg.content?.trim() || '';
        break;
      }

      messages.push(msg as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);
      for (const call of calls) {
        const tc = call as any;
        const name = tc.function?.name || '';
        let args: any = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }
        functionsUsed.push(name);
        let result: unknown;
        try {
          result = await executeTool(name, args);
        } catch (e: any) {
          result = { error: e?.message || '도구 실행 오류' };
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    if (!finalText) finalText = '답을 정리하지 못했어요. 질문을 조금 다르게 해 주시면 다시 찾아볼게요.';

    return NextResponse.json({ success: true, response: finalText, functionsUsed });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 디버그용 — 환경변수·데이터 개수
export async function GET() {
  try {
    const { supabase, userId } = await getSupabaseWithUserId();
    const [daily, memos, checks] = await Promise.all([
      userId
        ? supabase.from('daily_records').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        : supabase.from('daily_records').select('id', { count: 'exact', head: true }),
      supabase.from('memos').select('id', { count: 'exact', head: true }),
      userId
        ? supabase.from('daily_routine_checks').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        : supabase.from('daily_routine_checks').select('id', { count: 'exact', head: true }),
    ]);
    return NextResponse.json({
      envCheck: {
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        openaiKey: !!process.env.OPENAI_API_KEY,
      },
      dataCounts: {
        daily_records: daily.count ?? daily.error?.message,
        memos: memos.count ?? memos.error?.message,
        daily_routine_checks: checks.count ?? checks.error?.message,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
