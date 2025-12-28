const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const csvData = [
  { period: '2025. 8', owner: '김희창', division: 'P', category: 'REITs', stock: 'Tigier 리츠부동산 인프라&ACE 미국 S&P500 채권혼합액티브', qty: 0, in_out: 0, dividend: 163086, value: 31949405, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '김희창', division: 'P', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 0, dividend: 80678, value: 32563960, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '김희창', division: 'P', category: 'DOW', stock: 'SOL 미국배당다우존스', qty: 0, in_out: 0, dividend: 65912, value: 26738630, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '김희창', division: 'P', category: 'CC', stock: 'KODEX 미국배당커버드콜액티브', qty: 0, in_out: 0, dividend: 44528, value: 4851120, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '민수진', division: 'P', category: 'NASDAQ', stock: 'RISE 미국나스닥 100', qty: 0, in_out: 0, dividend: 0, value: 4183900, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '김희창', division: 'G', category: 'ROBOT', stock: 'KODEX 미국휴머노이드로봇', qty: 0, in_out: 0, dividend: 8999, value: 19606850, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '김희창', division: 'ISA', category: 'CC', stock: 'KODEX 미국배당커브드콜액티브', qty: 0, in_out: 0, dividend: 11592, value: 1545700, growth_rate: 0, memo: '' },
  { period: '2025. 8', owner: '김희창', division: 'G', category: 'SPEC', stock: '미국 SPEC', qty: 0, in_out: 0, dividend: 0, value: 800000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'P', category: 'REITs', stock: 'Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브', qty: 0, in_out: 0, dividend: 163086, value: 32540000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'P', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 0, dividend: 0, value: 33720000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'P', category: 'DOW', stock: 'SOL 미국배당다우존스', qty: 0, in_out: 0, dividend: 75968, value: 26435000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'P', category: 'CC', stock: 'KODEX 미국배당커버드콜액티브', qty: 0, in_out: 0, dividend: 44804, value: 5020000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '민수진', division: 'P', category: 'NASDAQ', stock: 'RISE 미국나스닥 100', qty: 0, in_out: 500000, dividend: 0, value: 4800000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'G', category: 'ROBOT', stock: 'KODEX 미국휴머노이드로봇', qty: 0, in_out: -527851, dividend: 0, value: 21104495, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'ISA', category: 'CC', stock: 'KODEX 미국배당커브드콜액티브', qty: 0, in_out: 0, dividend: 11960, value: 1585000, growth_rate: 0, memo: '' },
  { period: '2025. 9', owner: '김희창', division: 'G', category: 'SPEC', stock: '미국 SPEC', qty: 0, in_out: 0, dividend: 0, value: 1140000, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'P', category: 'REITs', stock: 'Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브', qty: 0, in_out: 0, dividend: 164703, value: 33634620, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'P', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 0, dividend: 83700, value: 33845670, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'P', category: 'DOW', stock: 'SOL 미국배당다우존스', qty: 0, in_out: 0, dividend: 80954, value: 26637550, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'P', category: 'CC', stock: 'KODEX 미국배당커버드콜액티브', qty: 0, in_out: 0, dividend: 39168, value: 5114280, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '민수진', division: 'P', category: 'NASDAQ', stock: 'RISE 미국나스닥 100', qty: 0, in_out: 0, dividend: 0, value: 4500000, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'G', category: 'ROBOT', stock: 'KODEX 미국휴머노이드로봇', qty: 0, in_out: 0, dividend: 0, value: 22000000, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'ISA', category: 'CC', stock: 'KODEX 미국배당커브드콜액티브', qty: 0, in_out: 0, dividend: 7584, value: 1629550, growth_rate: 0, memo: '' },
  { period: '2025. 10', owner: '김희창', division: 'G', category: 'SPEC', stock: '미국 SPEC', qty: 0, in_out: 0, dividend: 0, value: 1140000, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'P', category: 'REITs', stock: 'Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브', qty: 0, in_out: 0, dividend: 164703, value: 34153185, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'P', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 0, dividend: 0, value: 36240810, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'P', category: 'DOW', stock: 'SOL 미국배당다우존스', qty: 0, in_out: 0, dividend: 83700, value: 27951300, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'P', category: 'CC', stock: 'KODEX 미국배당커버드콜액티브', qty: 0, in_out: 0, dividend: 39703, value: 5255040, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '민수진', division: 'P', category: 'NASDAQ', stock: 'RISE 미국나스닥 100', qty: 0, in_out: 0, dividend: 0, value: 6500000, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'G', category: 'ROBOT', stock: 'KODEX 미국휴머노이드로봇', qty: 0, in_out: -22000000, dividend: 0, value: 0, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'ISA', category: 'CC', stock: 'KODEX 미국배당커브드콜액티브', qty: 0, in_out: 0, dividend: 7584, value: 1674400, growth_rate: 0, memo: '' },
  { period: '2025. 11', owner: '김희창', division: 'G', category: 'SPEC', stock: '미국 SPEC', qty: 0, in_out: 0, dividend: 0, value: 1140000, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'P', category: 'REITs', stock: 'Tigier 리츠부동산 인프라&ACE 미국 S&P500채권혼합액티브', qty: 0, in_out: 3000000, dividend: 164703, value: 37148323, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'P', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 0, dividend: 0, value: 36101955, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'P', category: 'DOW', stock: 'SOL 미국배당다우존스', qty: 0, in_out: 0, dividend: 83615, value: 28393720, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'P', category: 'CC', stock: 'KODEX 미국배당커버드콜액티브', qty: 0, in_out: 0, dividend: 39984, value: 5370335, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '민수진', division: 'P', category: 'NASDAQ', stock: 'RISE 미국나스닥 100', qty: 0, in_out: 1500000, dividend: 0, value: 6700000, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'G', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 19000000, dividend: 0, value: 18964260, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김사랑', division: 'G', category: 'S&P', stock: 'ACE 미국 S&P 500', qty: 0, in_out: 20000000, dividend: 0, value: 19974375, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'ISA', category: 'CC', stock: 'KODEX 미국배당커브드콜액티브', qty: 0, in_out: 0, dividend: 7742, value: 1658800, growth_rate: 0, memo: '' },
  { period: '2025. 12', owner: '김희창', division: 'G', category: 'SPEC', stock: '미국 SPEC', qty: 0, in_out: 0, dividend: 0, value: 1160000, growth_rate: 0, memo: '' },
];

async function updateData() {
  try {
    console.log('🗑️  기존 데이터 삭제 중...');
    const { error: deleteError } = await supabase
      .from('finance_records')
      .delete()
      .neq('id', '');

    if (deleteError) {
      console.error('❌ 삭제 오류:', deleteError);
      throw deleteError;
    }

    console.log('✅ 기존 데이터 삭제 완료');
    console.log(`📤 ${csvData.length}개의 새 레코드 삽입 중...`);

    const { error: insertError } = await supabase
      .from('finance_records')
      .insert(csvData);

    if (insertError) {
      console.error('❌ 삽입 오류:', insertError);
      throw insertError;
    }

    console.log(`✅ ${csvData.length}개의 레코드가 성공적으로 업로드되었습니다!`);
  } catch (error) {
    console.error('❌ 업데이트 실패:', error);
    process.exit(1);
  }
}

updateData();

