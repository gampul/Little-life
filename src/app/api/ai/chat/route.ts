import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

// Gemini API 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
  const { data: propertyData } = await supabase
    .from('account_records')
    .select('*')
    .order('record_month', { ascending: false })
    .limit(100);

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
  // Daily 요약
  const dailySummary = data.daily.length > 0 
    ? `최근 ${data.daily.length}일간의 일상 기록이 있습니다.`
    : '일상 기록이 없습니다.';

  // Diary 요약
  const diarySummary = data.diary.length > 0
    ? data.diary.map(d => {
        const text = d.content?.replace(/<[^>]*>/g, '') || '';
        return `- ${d.title || '제목없음'}: ${text.slice(0, 100)}...`;
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

  // Property 요약
  let totalAsset = 0;
  const latestMonth = data.property[0]?.record_month;
  const latestRecords = data.property.filter(p => p.record_month === latestMonth);
  latestRecords.forEach(p => {
    totalAsset += Number(p.current_value) || 0;
  });

  const propertySummary = latestRecords.length > 0
    ? `총 자산: ${totalAsset.toLocaleString()}원 (${latestMonth} 기준)\n보유 계좌/자산: ${latestRecords.length}개`
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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 사용자 데이터 수집
    let dataContext = '';
    if (includeData) {
      const userData = await collectUserData();
      dataContext = summarizeData(userData);
    }

    // Gemini 모델 설정
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-pro',
      systemInstruction: `너는 사용자의 개인 라이프 코치이자 재정 어드바이저야.
사용자의 일상(Daily), 일기(Diary), 가계부(Expense), 자산(Property) 데이터를 분석하여 
친근하고 실용적인 조언을 해줘.

중요한 규칙:
1. 한국어로 답변해줘
2. 이모지를 적절히 사용해서 친근하게 대화해
3. 구체적인 숫자나 데이터를 인용하면서 조언해
4. 긍정적이고 격려하는 톤을 유지해
5. 필요시 실천 가능한 구체적인 행동 제안을 해줘
6. 답변은 간결하되 핵심을 담아줘 (200-400자 정도)`,
    });

    // 프롬프트 구성
    const prompt = includeData 
      ? `${dataContext}\n\n---\n\n[사용자 질문]\n${message}`
      : message;

    // AI 응답 생성
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    return NextResponse.json({ 
      success: true, 
      response,
      hasData: includeData && dataContext.length > 100,
    });

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ 
      error: error.message || 'AI 응답 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

