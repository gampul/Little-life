import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// 사용자 데이터 수집 함수
async function collectUserData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Daily 루틴 데이터 (최근 30일)
  const { data: dailyData } = await supabase
    .from('daily_records')
    .select('*')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(30);

  // Diary 메모 데이터 (최근 10개)
  const { data: diaryData } = await supabase
    .from('memos')
    .select('title, content, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  // Expense 가계부 데이터 (최근 30일)
  const { data: expenseData } = await supabase
    .from('expense_records')
    .select('*')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  // Property 자산 데이터 (최신)
  const { data: propertyData, error: propertyError } = await supabase
    .from('finance_records')
    .select('*')
    .order('period', { ascending: false })
    .limit(100);

  // 디버깅: 에러 로그
  if (propertyError) {
    console.error('Property data fetch error:', propertyError);
  }
  console.log('Property data count:', propertyData?.length || 0);

  return {
    daily: dailyData || [],
    diary: diaryData || [],
    expense: expenseData || [],
    property: propertyData || [],
  };
}

// 데이터 요약 생성
function summarizeData(data: {
  daily: any[];
  diary: any[];
  expense: any[];
  property: any[];
}) {
  // Daily 요약 (실제 데이터 포함)
  const dailySummary = data.daily.length > 0 
    ? data.daily.slice(0, 10).map(d => {
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
        return `- ${parts.join(', ')}`;
      }).join('\n')
    : '일상 기록이 없습니다.';

  // Diary 요약 (내용 확장)
  const diarySummary = data.diary.length > 0
    ? data.diary.map(d => {
        const text = d.content?.replace(/<[^>]*>/g, '') || '';
        return `- [${d.created_at?.split('T')[0] || '날짜없음'}] ${d.title || '제목없음'}: ${text.slice(0, 500)}`;
      }).join('\n')
    : '일기 기록이 없습니다.';

  // Expense 요약
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryExpense: { [key: string]: number } = {};
  
  data.expense.forEach(e => {
    const amount = Number(e.amount) || 0;
    if (e.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      const category = e.category || '기타';
      categoryExpense[category] = (categoryExpense[category] || 0) + amount;
    }
  });

  const expenseSummary = data.expense.length > 0
    ? `최근 30일 수입: ${totalIncome.toLocaleString()}원, 지출: ${totalExpense.toLocaleString()}원\n카테고리별 지출: ${Object.entries(categoryExpense).map(([k, v]) => `${k}: ${v.toLocaleString()}원`).join(', ')}`
    : '가계부 기록이 없습니다.';

  // Property 요약 (상세 정보 포함)
  let totalAsset = 0;
  let totalDividend = 0;
  let totalInOut = 0;
  const latestPeriod = data.property[0]?.period;
  const latestRecords = data.property.filter(p => p.period === latestPeriod);
  latestRecords.forEach(p => {
    totalAsset += Number(p.value) || 0;
    totalDividend += Number(p.dividend) || 0;
    totalInOut += Number(p.in_out) || 0;
  });

  const propertySummary = latestRecords.length > 0
    ? `[${latestPeriod} 기준 자산 현황]
총 자산: ${totalAsset.toLocaleString()}원
총 배당금: ${totalDividend.toLocaleString()}원
총 입출금: ${totalInOut >= 0 ? '+' : ''}${totalInOut.toLocaleString()}원

[개별 자산 목록]
${latestRecords.slice(0, 20).map(p => {
  const parts = [];
  if (p.owner) parts.push(`소유자: ${p.owner}`);
  if (p.division) parts.push(`구분: ${p.division}`);
  if (p.category) parts.push(`분류: ${p.category}`);
  if (p.stock) parts.push(`종목: ${p.stock}`);
  if (p.qty) parts.push(`수량: ${p.qty}`);
  if (p.value) parts.push(`현재가치: ${Number(p.value).toLocaleString()}원`);
  if (p.dividend) parts.push(`배당금: ${Number(p.dividend).toLocaleString()}원`);
  if (p.in_out) parts.push(`입출금: ${Number(p.in_out) >= 0 ? '+' : ''}${Number(p.in_out).toLocaleString()}원`);
  if (p.growth_rate) parts.push(`수익률: ${p.growth_rate}%`);
  return `- ${parts.join(', ')}`;
}).join('\n')}`
    : '자산 기록이 없습니다.';

  return `
[사용자 데이터 요약]

📅 일상 기록:
${dailySummary}

📝 최근 일기:
${diarySummary}

💰 가계부:
${expenseSummary}

🏦 자산 현황:
${propertySummary}
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const { message, includeData = true } = await request.json();

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 사용자 데이터 수집
    let dataContext = '';
    let debugInfo = { daily: 0, diary: 0, expense: 0, property: 0 };
    if (includeData) {
      const userData = await collectUserData();
      debugInfo = {
        daily: userData.daily.length,
        diary: userData.diary.length,
        expense: userData.expense.length,
        property: userData.property.length,
      };
      dataContext = summarizeData(userData);
    }

    const systemPrompt = `# 역할
너는 "Little Life" 앱의 AI 비서야. 사용자의 일상, 일기, 가계부, 자산 데이터를 분석해서 맞춤형 조언을 제공해.

# 핵심 규칙
1. 반드시 제공된 데이터만 참고해서 답변해
2. 데이터에 없는 내용은 절대 추측하거나 지어내지 마
3. 모르거나 데이터가 부족하면 솔직하게 "데이터가 부족합니다"라고 말해
4. 구체적인 숫자를 인용해서 근거 있는 답변을 해
5. 한국어로 답변해

# 답변 형식
- 200자 이내로 간결하게 답변
- 핵심만 전달하고 불필요한 말 생략
- 친근하지만 정확한 톤 유지

# 금지 사항
- 거짓 정보나 추측 금지
- 데이터에 없는 내용 생성 금지
- 장황하거나 반복적인 답변 금지
- 확실하지 않은 조언 금지`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: includeData 
            ? `${dataContext}\n\n---\n\n[사용자 질문]\n${message}`
            : message
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ 
      success: true, 
      response,
      hasData: includeData && dataContext.length > 100,
      debug: debugInfo,  // 디버깅용: 가져온 데이터 개수
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ 
      error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
