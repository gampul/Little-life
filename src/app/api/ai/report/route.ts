import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';

// OpenAI 클라이언트
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// 상세 사용자 데이터 수집
async function collectDetailedData() {
  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) {
    return { daily: [], diary: [], expense: [], property: [] };
  }
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Daily 루틴 데이터 (최근 7일 상세)
  const { data: dailyData } = await supabase
    .from('daily_records')
    .select('date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, meal_images, daily_memo, created_at, updated_at')
    .eq('user_id', userId)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  // Diary 메모 데이터 (최근 5개)
  const { data: diaryData } = await supabase
    .from('memos')
    .select('title, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Expense 가계부 데이터 (최근 30일)
  const { data: expenseData } = await supabase
    .from('expense_records')
    .select('*')
    .eq('user_id', userId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false });

  // Property 자산 데이터 (최근 3개월)
  const { data: propertyData } = await supabase
    .from('finance_records')
    .select('*')
    .eq('user_id', userId)
    .order('period', { ascending: false })
    .limit(300);

  return {
    daily: dailyData || [],
    diary: diaryData || [],
    expense: expenseData || [],
    property: propertyData || [],
  };
}

// 상세 데이터 분석
function analyzeData(data: {
  daily: any[];
  diary: any[];
  expense: any[];
  property: any[];
}) {
  // Daily 분석
  const dailyAnalysis = {
    totalDays: data.daily.length,
    records: data.daily.map(d => ({
      date: d.date,
      weight: d.weight ?? null,
      mealMemo: d.meal_memo ?? null,
      dailyMemo: d.daily_memo ?? null,
    })),
  };

  // Diary 분석
  const diaryAnalysis = data.diary.map(d => ({
    title: d.title || '제목없음',
    content: d.content?.replace(/<[^>]*>/g, '').slice(0, 200) || '',
    date: d.created_at,
  }));

  // Expense 분석
  let totalIncome = 0;
  let totalExpense = 0;
  const categoryExpense: { [key: string]: number } = {};
  const dailySpending: { [key: string]: number } = {};
  
  data.expense.forEach(e => {
    const amount = Number(e.amount) || 0;
    if (e.type === 'income') {
      totalIncome += amount;
    } else {
      totalExpense += amount;
      const category = e.category || '기타';
      categoryExpense[category] = (categoryExpense[category] || 0) + amount;
      
      const date = e.date?.split('T')[0] || '';
      dailySpending[date] = (dailySpending[date] || 0) + amount;
    }
  });

  const expenseAnalysis = {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    categoryBreakdown: categoryExpense,
    avgDailySpending: Object.values(dailySpending).length > 0 
      ? Object.values(dailySpending).reduce((a, b) => a + b, 0) / Object.values(dailySpending).length 
      : 0,
    topCategories: Object.entries(categoryExpense)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };

  // Property 분석
  const latestPeriod = data.property[0]?.period;
  const latestRecords = data.property.filter(p => p.period === latestPeriod);
  
  let totalAsset = 0;
  let totalDividend = 0;
  let totalInOut = 0;
  const assetByCategory: { [key: string]: number } = {};
  const assetByOwner: { [key: string]: number } = {};
  
  latestRecords.forEach(p => {
    const value = Number(p.value) || 0;
    totalAsset += value;
    totalDividend += Number(p.dividend) || 0;
    totalInOut += Number(p.in_out) || 0;
    const category = p.category || '기타';
    assetByCategory[category] = (assetByCategory[category] || 0) + value;
    const owner = p.owner || '미지정';
    assetByOwner[owner] = (assetByOwner[owner] || 0) + value;
  });

  const propertyAnalysis = {
    totalAsset,
    totalDividend,
    totalInOut,
    assetByCategory,
    assetByOwner,
    accountCount: latestRecords.length,
    latestPeriod,
    stocks: latestRecords.slice(0, 20).map(p => ({
      owner: p.owner,
      division: p.division,
      category: p.category,
      stock: p.stock,
      qty: p.qty,
      value: p.value,
      dividend: p.dividend,
      inOut: p.in_out,
      growthRate: p.growth_rate,
    })),
  };

  return {
    daily: dailyAnalysis,
    diary: diaryAnalysis,
    expense: expenseAnalysis,
    property: propertyAnalysis,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { reportType = 'daily' } = await request.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 데이터 수집 및 분석
    const userData = await collectDetailedData();
    const analysis = analyzeData(userData);

    // 리포트 타입별 프롬프트
    const reportPrompts: { [key: string]: string } = {
      daily: `오늘의 종합 리포트를 작성해줘. 일상, 감정, 지출, 자산 현황을 모두 분석해서 간단한 인사이트와 내일을 위한 조언을 해줘.`,
      financial: `재정 건강도 리포트를 작성해줘. 수입/지출 패턴, 저축률, 자산 구성을 분석하고 개선점을 제안해줘.`,
      lifestyle: `라이프스타일 리포트를 작성해줘. 일상 루틴, 수면 패턴, 운동, 감정 변화를 분석하고 더 나은 하루를 위한 조언을 해줘.`,
      weekly: `주간 종합 리포트를 작성해줘. 이번 주의 하이라이트, 개선점, 다음 주 목표를 제안해줘.`,
    };

    const systemPrompt = `# 역할
너는 "Little Life" 앱의 데이터 분석 전문가야. 사용자 데이터를 기반으로 정확한 리포트를 작성해.

# 핵심 규칙
1. 반드시 제공된 데이터만 사용해서 리포트 작성
2. 데이터에 없는 내용은 절대 추측하거나 지어내지 마
3. 모든 수치는 제공된 데이터에서 인용
4. 데이터가 부족하면 솔직하게 "데이터 부족"이라고 표시

# 리포트 형식
1. 📊 핵심 요약 (데이터 기반 지표 2-3개)
2. 💡 인사이트 (데이터에서 발견한 패턴)
3. ✅ 실천 제안 (구체적 행동 1-2개)

# 금지 사항
- 거짓 정보나 추측 금지
- 데이터에 없는 숫자 생성 금지
- 과장된 표현 금지

# 형식
- 한국어로 작성
- 마크다운 사용
- 300-500자 이내`;

    // 데이터 컨텍스트
    const dataContext = `
[사용자 데이터 분석 결과]

📅 일상 기록 (최근 ${analysis.daily.totalDays}일):
${JSON.stringify(analysis.daily.records.slice(0, 3), null, 2)}

📝 최근 일기:
${analysis.diary.map(d => `- ${d.title}: ${d.content.slice(0, 100)}...`).join('\n')}

💰 가계부 (최근 30일):
- 총 수입: ${analysis.expense.totalIncome.toLocaleString()}원
- 총 지출: ${analysis.expense.totalExpense.toLocaleString()}원
- 잔액: ${analysis.expense.balance.toLocaleString()}원
- 일평균 지출: ${Math.round(analysis.expense.avgDailySpending).toLocaleString()}원
- 카테고리별: ${analysis.expense.topCategories.map(([k, v]) => `${k}: ${v.toLocaleString()}원`).join(', ')}

🏦 자산 현황 (${analysis.property.latestPeriod || '데이터 없음'}):
- 총 자산: ${analysis.property.totalAsset.toLocaleString()}원
- 배당금: ${analysis.property.totalDividend.toLocaleString()}원
- 계좌 수: ${analysis.property.accountCount}개
- 카테고리별: ${Object.entries(analysis.property.assetByCategory).map(([k, v]) => `${k}: ${(v as number).toLocaleString()}원`).join(', ')}
`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `${dataContext}\n\n---\n\n${reportPrompts[reportType] || reportPrompts.daily}`
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const report = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ 
      success: true, 
      report,
      reportType,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAsset: analysis.property.totalAsset,
        monthlyExpense: analysis.expense.totalExpense,
        monthlyIncome: analysis.expense.totalIncome,
        savingRate: analysis.expense.totalIncome > 0 
          ? Math.round((1 - analysis.expense.totalExpense / analysis.expense.totalIncome) * 100)
          : 0,
      },
    });

  } catch (error: any) {
    console.error('AI Report Error:', error);
    return NextResponse.json({ 
      error: error.message || '리포트 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
