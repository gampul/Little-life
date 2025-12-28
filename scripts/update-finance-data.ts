import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

// .env.local 파일 로드
config({ path: '.env.local' });

// Supabase 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface FinanceRecord {
  period: string;
  owner: string;
  division: string;
  category: string;
  stock: string;
  qty: number;
  in_out: number;
  dividend: number;
  value: number;
  growth_rate: number;
  memo?: string;
}

// CSV 파싱 함수
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseNumber(str: string): number {
  if (!str || str.trim() === '' || str === '-') return 0;
  const cleaned = str.replace(/,/g, '').replace(/"/g, '').trim();
  return parseFloat(cleaned) || 0;
}

async function updateFinanceData() {
  try {
    console.log('📊 CSV 파일 읽기 중...');
    
    // CSV 파일 읽기
    const csvPath = path.join('C:', 'Users', 'rapaa', 'OneDrive', '바탕 화면', 'gampul story - Finance.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('✅ CSV 파일 읽기 완료');
    
    // CSV 파싱
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      console.error('❌ CSV 파일 형식이 올바르지 않습니다.');
      process.exit(1);
    }
    
    const headers = parseCSVLine(lines[0]);
    const records: FinanceRecord[] = [];
    
    console.log('📝 CSV 데이터 파싱 중...');
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 9) continue;
      
      const record: FinanceRecord = {
        period: values[0]?.replace(/"/g, '').trim() || '',
        owner: values[1]?.replace(/"/g, '').trim() || '',
        division: values[2]?.replace(/"/g, '').trim() || '',
        category: values[3]?.replace(/"/g, '').trim() || '',
        stock: values[4]?.replace(/"/g, '').trim() || '',
        qty: parseNumber(values[5] || '0'),
        in_out: parseNumber(values[6] || '0'),
        dividend: parseNumber(values[7] || '0'),
        value: parseNumber(values[8] || '0'),
        growth_rate: 0,
        memo: values[9]?.replace(/"/g, '').trim() || '',
      };
      
      if (record.period && record.owner && record.stock) {
        records.push(record);
      }
    }
    
    console.log(`✅ ${records.length}개의 레코드 파싱 완료`);
    
    // 기존 데이터 삭제
    console.log('🗑️  기존 데이터 삭제 중...');
    const { error: deleteError } = await supabase
      .from('finance_records')
      .delete()
      .not('id', 'is', null);
    
    if (deleteError) {
      console.error('❌ 삭제 오류:', deleteError);
    } else {
      console.log('✅ 기존 데이터 삭제 완료');
    }
    
    // 새 데이터 삽입
    console.log('📥 새 데이터 삽입 중...');
    const { error: insertError } = await supabase
      .from('finance_records')
      .insert(records);
    
    if (insertError) {
      console.error('❌ 삽입 오류:', insertError);
      process.exit(1);
    }
    
    console.log(`✅ ${records.length}개의 레코드가 성공적으로 업데이트되었습니다!`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

// 실행
updateFinanceData();

