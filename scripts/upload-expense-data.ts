import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// .env.local 파일 로드
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Supabase 환경 변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ExpenseRecord {
  date: string;
  account: string;
  category: string;
  sub_category: string;
  description: string;
  amount: number;
  transaction_type: '입금' | '출금' | '이체입금' | '이체출금';
  memo: string;
  balance: number;
  currency: string;
}

// CSV 파싱 (따옴표 처리 포함)
const parseCSVLine = (line: string): string[] => {
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
};

const uploadExpenseData = async () => {
  try {
    console.log('📊 CSV 파일 읽기 중...');
    
    // CSV 파일 경로 (프로젝트 루트 또는 바탕화면)
    let csvPath = path.resolve(__dirname, '../expense-data.csv');
    
    // 파일이 없으면 바탕화면에서 찾기
    if (!fs.existsSync(csvPath)) {
      const desktopPath = path.join(process.env.USERPROFILE || '', 'OneDrive', '바탕 화면', '2022-12-31_2026-01-01.csv');
      if (fs.existsSync(desktopPath)) {
        csvPath = desktopPath;
      } else {
        console.error('❌ CSV 파일을 찾을 수 없습니다.');
        console.log('파일을 프로젝트 루트에 expense-data.csv로 복사하거나');
        console.log('바탕화면에 2022-12-31_2026-01-01.csv 파일이 있는지 확인하세요.');
        return;
      }
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    console.log('✅ CSV 파일 읽기 완료');

    console.log('📝 CSV 데이터 파싱 중...');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      console.error('❌ CSV 파일 형식이 올바르지 않습니다.');
      return;
    }

    const records: ExpenseRecord[] = [];

    // 헤더 스킵하고 데이터 파싱
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length < 10) continue;

      const parseNumber = (str: string): number => {
        if (!str || str.trim() === '' || str === '-') return 0;
        const cleaned = str.replace(/,/g, '').replace(/"/g, '').trim();
        return parseFloat(cleaned) || 0;
      };

      // 날짜 파싱 (예: "2026. 01. 01 09:04:28" -> "2026-01-01")
      const dateParts = values[0].split(' ')[0].split('.');
      const dateStr = dateParts.length >= 3 
        ? `${dateParts[0].trim()}-${dateParts[1].trim().padStart(2, '0')}-${dateParts[2].trim().padStart(2, '0')}`
        : values[0];

      const record: ExpenseRecord = {
        date: dateStr,
        account: values[1]?.replace(/"/g, '').trim() || '',
        category: values[2]?.replace(/"/g, '').trim() || '',
        sub_category: values[3]?.replace(/"/g, '').trim() || '',
        description: values[4]?.replace(/"/g, '').trim() || '',
        amount: parseNumber(values[5] || '0'),
        transaction_type: (values[6]?.replace(/"/g, '').trim() || '출금') as '입금' | '출금' | '이체입금' | '이체출금',
        memo: values[7]?.replace(/"/g, '').trim() || '',
        balance: parseNumber(values[8] || '0'),
        currency: values[9]?.replace(/"/g, '').trim() || 'KRW',
      };

      if (record.date && record.amount > 0) {
        records.push(record);
      }
    }
    
    console.log(`✅ ${records.length}개의 레코드 파싱 완료`);

    if (records.length === 0) {
      console.error('❌ 파싱된 데이터가 없습니다.');
      return;
    }

    // 샘플 데이터 출력
    console.log('\n📋 샘플 데이터 (처음 3개):');
    records.slice(0, 3).forEach((record, idx) => {
      console.log(`${idx + 1}. ${record.date} | ${record.transaction_type} | ${record.amount.toLocaleString()}원 | ${record.description}`);
    });

    console.log('\n🗑️  기존 데이터 삭제 중...');
    const { error: deleteError } = await supabase
      .from('expense_records')
      .delete()
      .not('id', 'is', null);

    if (deleteError) {
      console.error('❌ 삭제 오류:', deleteError);
      // 삭제 실패해도 계속 진행
    } else {
      console.log('✅ 기존 데이터 삭제 완료');
    }

    console.log('\n📥 새 데이터 삽입 중...');
    
    // 배치 단위로 삽입 (1000개씩)
    const batchSize = 1000;
    let insertedCount = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('expense_records')
        .insert(batch);

      if (insertError) {
        console.error(`❌ 배치 ${Math.floor(i / batchSize) + 1} 삽입 오류:`, insertError);
        throw insertError;
      }
      
      insertedCount += batch.length;
      console.log(`  진행: ${insertedCount}/${records.length} (${((insertedCount / records.length) * 100).toFixed(1)}%)`);
    }

    console.log(`\n✅ ${records.length}개의 레코드가 성공적으로 업로드되었습니다!`);
    
    // 통계 출력
    console.log('\n📊 업로드 통계:');
    const totalIncome = records
      .filter(r => r.transaction_type === '입금' || r.transaction_type === '이체입금')
      .reduce((sum, r) => sum + r.amount, 0);
    const totalExpense = records
      .filter(r => r.transaction_type === '출금' || r.transaction_type === '이체출금')
      .reduce((sum, r) => sum + r.amount, 0);
    
    console.log(`  총 수입: ${totalIncome.toLocaleString()}원`);
    console.log(`  총 지출: ${totalExpense.toLocaleString()}원`);
    console.log(`  잔액: ${(totalIncome - totalExpense).toLocaleString()}원`);
    
    // 기간 정보
    const dates = records.map(r => new Date(r.date)).sort((a, b) => a.getTime() - b.getTime());
    console.log(`  기간: ${dates[0].toLocaleDateString('ko-KR')} ~ ${dates[dates.length - 1].toLocaleDateString('ko-KR')}`);
    
  } catch (error) {
    console.error('❌ 데이터 업로드 실패:', error);
  }
};

uploadExpenseData();

