import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkData() {
  const { data, error } = await supabase
    .from('finance_records')
    .select('*')
    .order('period', { ascending: true });

  if (error) {
    console.error('❌ 오류:', error);
    return;
  }

  console.log('✅ 총 레코드 수:', data.length);
  console.log('\n📊 기간별 레코드 수:');
  
  const periods: { [key: string]: number } = {};
  data.forEach((r: any) => {
    periods[r.period] = (periods[r.period] || 0) + 1;
  });
  
  Object.entries(periods)
    .sort()
    .forEach(([period, count]) => {
      console.log(`  ${period}: ${count}개`);
    });

  console.log('\n📋 샘플 데이터 (최근 3개):');
  data.slice(-3).forEach((r: any) => {
    console.log(`  ${r.period} | ${r.owner} | ${r.stock} | ${r.value.toLocaleString()}원`);
  });
}

checkData();

