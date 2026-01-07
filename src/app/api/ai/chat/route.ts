import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServer } from '../../../lib/supabase_ssr';

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Supabase 클라이언트는 요청 쿠키 기반(SSR)로 생성 (로그인 사용자 스코프)
async function getSupabaseWithUserId() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

// ============================================
// Function Calling용 도구 정의
// ============================================
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'getDailyData',
      description: '사용자의 일상 기록을 조회합니다 (체중, 운동, 수면, 기분 등). 건강, 루틴, 체중, 운동, 수면 관련 질문에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: '조회할 일수 (기본: 7일)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getDiaryData',
      description: '사용자의 일기/메모를 조회합니다. 일기, 메모, 기록, 생각 관련 질문에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '조회할 개수 (기본: 5개)'
          },
          keyword: {
            type: 'string',
            description: '검색할 키워드'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getExpenseData',
      description: '사용자의 가계부 데이터를 조회합니다. 지출, 수입, 돈, 소비, 저축, 카테고리별 지출 관련 질문에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: '조회할 일수 (기본: 30일)'
          },
          category: {
            type: 'string',
            description: '조회할 카테고리 (예: 식비, 교통비)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPropertyData',
      description: '사용자의 자산/투자 데이터를 조회합니다. 자산, 주식, 투자, 배당금, 수익률, 포트폴리오 관련 질문에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {
          stockName: {
            type: 'string',
            description: '조회할 종목명 (예: 삼성전자)'
          },
          owner: {
            type: 'string',
            description: '조회할 소유자명'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getAllSummary',
      description: '모든 데이터의 요약을 조회합니다. 전체 현황, 종합 분석, 리포트 관련 질문에 사용하세요.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

// ============================================
// 개별 데이터 조회 함수들
// ============================================

// Daily 데이터 조회
async function getDailyData(days: number = 7) {
  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('daily_records')
    .select('*')
    .gte('date', pastDate.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(days);

  if (error) {
    console.error('Daily data fetch error:', error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { message: '일상 기록이 없습니다.' };
  }

  const summary = data.map(d => {
    const parts = [];
    if (d.date) parts.push(`날짜: ${d.date}`);
    if (d.weight) parts.push(`체중: ${d.weight}kg`);
    if (d.wake_time) parts.push(`기상: ${d.wake_time}`);
    if (d.sleep_time) parts.push(`취침: ${d.sleep_time}`);
    if (d.exercise) parts.push(`운동: ${d.exercise}`);
    if (d.mood) parts.push(`기분: ${d.mood}`);
    if (d.meals) parts.push(`식사: ${d.meals}`);
    if (d.water) parts.push(`물: ${d.water}잔`);
    if (d.memo) parts.push(`메모: ${d.memo}`);
    return parts.join(', ');
  });

  return {
    count: data.length,
    period: `최근 ${days}일`,
    records: summary
  };
}

// Diary 데이터 조회
async function getDiaryData(limit: number = 5, keyword?: string) {
  let query = supabase
    .from('memos')
    .select('title, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Diary data fetch error:', error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { message: '일기 기록이 없습니다.' };
  }

  let filteredData = data;
  if (keyword) {
    filteredData = data.filter(d => 
      d.title?.includes(keyword) || d.content?.includes(keyword)
    );
  }

  const summary = filteredData.map(d => {
    const text = d.content?.replace(/<[^>]*>/g, '') || '';
    return {
      date: d.created_at?.split('T')[0],
      title: d.title || '제목없음',
      content: text.slice(0, 300)
    };
  });

  return {
    count: summary.length,
    keyword: keyword || '없음',
    records: summary
  };
}

// Expense 데이터 조회
async function getExpenseData(days: number = 30, category?: string) {
  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  
  let query = supabase
    .from('expense_records')
    .select('*')
    .gte('date', pastDate.toISOString().split('T')[0])
    .order('date', { ascending: false });

  const { data, error } = await query;

  if (error) {
    console.error('Expense data fetch error:', error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { message: '가계부 기록이 없습니다.' };
  }

  let filteredData = data;
  if (category) {
    filteredData = data.filter(d => d.category?.includes(category));
  }

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryExpense: { [key: string]: number } = {};

  filteredData.forEach(e => {
    const amount = Number(e.amount) || 0;
    if (e.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      const cat = e.category || '기타';
      categoryExpense[cat] = (categoryExpense[cat] || 0) + amount;
    }
  });

  return {
    period: `최근 ${days}일`,
    filterCategory: category || '전체',
    totalIncome: `${totalIncome.toLocaleString()}원`,
    totalExpense: `${totalExpense.toLocaleString()}원`,
    balance: `${(totalIncome - totalExpense).toLocaleString()}원`,
    categoryBreakdown: Object.entries(categoryExpense).map(([k, v]) => `${k}: ${v.toLocaleString()}원`),
    recordCount: filteredData.length
  };
}

// Property 데이터 조회
async function getPropertyData(stockName?: string, owner?: string) {
  const { supabase, userId } = await getSupabaseWithUserId();
  if (!userId) return { message: '로그인이 필요합니다.' };

  const { data, error } = await supabase
    .from('finance_records')
    .select('*')
    .eq('user_id', userId)
    .order('period', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Property data fetch error:', error);
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { message: '자산 기록이 없습니다.' };
  }

  // 최신 기간 데이터만 필터
  const latestPeriod = data[0]?.period;
  let latestRecords = data.filter(p => p.period === latestPeriod);

  // 종목명 필터
  if (stockName) {
    latestRecords = latestRecords.filter(p => p.stock?.includes(stockName));
  }

  // 소유자 필터
  if (owner) {
    latestRecords = latestRecords.filter(p => p.owner?.includes(owner));
  }

  let totalAsset = 0;
  let totalDividend = 0;
  let totalInOut = 0;

  latestRecords.forEach(p => {
    totalAsset += Number(p.value) || 0;
    totalDividend += Number(p.dividend) || 0;
    totalInOut += Number(p.in_out) || 0;
  });

  const stocks = latestRecords.slice(0, 20).map(p => ({
    owner: p.owner,
    division: p.division,
    category: p.category,
    stock: p.stock,
    qty: p.qty,
    value: `${Number(p.value || 0).toLocaleString()}원`,
    dividend: `${Number(p.dividend || 0).toLocaleString()}원`,
    inOut: `${Number(p.in_out || 0) >= 0 ? '+' : ''}${Number(p.in_out || 0).toLocaleString()}원`,
    growthRate: p.growth_rate ? `${p.growth_rate}%` : null
  }));

  return {
    period: latestPeriod,
    filterStock: stockName || '전체',
    filterOwner: owner || '전체',
    totalAsset: `${totalAsset.toLocaleString()}원`,
    totalDividend: `${totalDividend.toLocaleString()}원`,
    totalInOut: `${totalInOut >= 0 ? '+' : ''}${totalInOut.toLocaleString()}원`,
    stockCount: latestRecords.length,
    stocks
  };
}

// 전체 요약 조회
async function getAllSummary() {
  const [daily, diary, expense, property] = await Promise.all([
    getDailyData(7),
    getDiaryData(3),
    getExpenseData(30),
    getPropertyData()
  ]);

  return {
    daily,
    diary,
    expense,
    property
  };
}

// 함수 실행기
async function executeFunction(name: string, args: any): Promise<any> {
  switch (name) {
    case 'getDailyData':
      return await getDailyData(args.days);
    case 'getDiaryData':
      return await getDiaryData(args.limit, args.keyword);
    case 'getExpenseData':
      return await getExpenseData(args.days, args.category);
    case 'getPropertyData':
      return await getPropertyData(args.stockName, args.owner);
    case 'getAllSummary':
      return await getAllSummary();
    default:
      return { error: '알 수 없는 함수입니다.' };
  }
}

// ============================================
// API 라우트
// ============================================
export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    const systemPrompt = `# 역할
너는 "Little Life" 앱의 AI 비서야. 사용자의 Supabase 데이터베이스에 저장된 실제 데이터를 조회해서 답변해.

# ⚠️ 절대 규칙 (반드시 지켜)
1. 모든 질문에 반드시 함수를 호출해서 실제 데이터를 조회해
2. 함수를 호출하지 않고 답변하면 안 돼
3. 너의 학습 데이터(2023년 등)는 절대 사용하지 마
4. 오직 함수로 조회한 Supabase 데이터만 참고해
5. 데이터가 없으면 "데이터가 없어"라고 솔직히 말해

# 함수 호출 (반드시 하나 이상 호출해!)
- 체중, 운동, 수면, 건강, 루틴, 일상 → getDailyData
- 일기, 메모, 기록, 생각 → getDiaryData  
- 지출, 수입, 돈, 가계부, 소비 → getExpenseData
- 자산, 주식, 투자, 배당, 재산 → getPropertyData
- 전체, 종합, 현황, 요약, 리포트 → getAllSummary
- 잘 모르겠으면 → getAllSummary

# 답변 형식
- 200자 이내, 친근한 반말
- 조회한 데이터의 구체적 숫자 인용`;

    // 1차 호출: AI가 반드시 함수를 호출하도록 설정
    const firstCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      tools: tools,
      tool_choice: 'required',  // 반드시 함수 호출
      max_tokens: 1000,
      temperature: 0.3,
    });

    const firstMessage = firstCompletion.choices[0].message;
    let functionsUsed: string[] = [];

    // 함수 호출이 필요한 경우
    if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
        firstMessage as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam
      ];

      // 각 함수 호출 실행
      for (const toolCall of firstMessage.tool_calls) {
        // 타입 가드: function 타입인 경우만 처리
        if (toolCall.type !== 'function') continue;
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tc = toolCall as any;
        const functionName = tc.function?.name || tc.name || '';
        const functionArgsStr = tc.function?.arguments || tc.arguments || '{}';
        const functionArgs = JSON.parse(functionArgsStr);
        
        console.log(`🔧 Function called: ${functionName}`, functionArgs);
        functionsUsed.push(functionName);

        const functionResult = await executeFunction(functionName, functionArgs);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(functionResult, null, 2)
        });
      }

      // 2차 호출: 함수 결과를 바탕으로 응답 생성
      const secondCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.3,
      });

      const response = secondCompletion.choices[0]?.message?.content || '';

      return NextResponse.json({ 
        success: true, 
        response,
        functionsUsed,
        debug: { mode: 'function_calling', functions: functionsUsed }
      });
    }

    // 함수 호출 없이 바로 응답하는 경우
    const response = firstMessage.content || '';

    return NextResponse.json({ 
      success: true, 
      response,
      functionsUsed: [],
      debug: { mode: 'direct_response' }
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ 
      error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.',
      debug: {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      }
    }, { status: 500 });
  }
}

// 디버그용 엔드포인트 - 환경변수 및 데이터 확인
export async function GET() {
  try {
    const { supabase, userId } = await getSupabaseWithUserId();
    const envCheck = {
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      openaiKey: !!process.env.OPENAI_API_KEY,
    };

    // 각 테이블 데이터 개수 확인
    const [daily, memos, expense, finance] = await Promise.all([
      userId
        ? supabase.from('daily_records').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        : supabase.from('daily_records').select('id', { count: 'exact', head: true }),
      userId
        ? supabase.from('memos').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        : supabase.from('memos').select('id', { count: 'exact', head: true }),
      userId
        ? supabase.from('expense_records').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        : supabase.from('expense_records').select('id', { count: 'exact', head: true }),
      userId
        ? supabase.from('finance_records').select('id', { count: 'exact', head: true }).eq('user_id', userId)
        : supabase.from('finance_records').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      envCheck,
      dataCounts: {
        daily_records: daily.count ?? daily.error?.message,
        memos: memos.count ?? memos.error?.message,
        expense_records: expense.count ?? expense.error?.message,
        finance_records: finance.count ?? finance.error?.message,
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
