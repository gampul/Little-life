import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 타입 매핑
const TYPE_MAPPING: Record<string, string> = {
  '수입': 'income',
  '지출': 'expense',
  '이체지출': 'transfer',
  '이체': 'transfer',
};

interface ExcelRow {
  날짜?: string | number | Date;
  자산?: string;
  분류?: string;
  소분류?: string;
  내용?: string;
  금액?: number | string;
  '수입/지출'?: string;
}

interface TransactionInsert {
  user_id: string;
  date: string;
  asset: string;
  category: string;
  sub_category: string | null;
  description: string | null;
  amount: number;
  type: string;
  currency: string;
  source: string;
  import_batch_id: string;
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 서비스 롤 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // 토큰으로 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '인증 실패' }, { status: 401 });
    }

    const userId = user.id;
    const importBatchId = crypto.randomUUID();

    // FormData에서 파일 추출
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '파일이 없습니다' }, { status: 400 });
    }

    // 파일 확장자 확인
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      return NextResponse.json({ error: '지원하지 않는 파일 형식입니다 (xlsx, xls, csv만 가능)' }, { status: 400 });
    }

    // 파일 읽기
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    // 첫 번째 시트 파싱
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json({ error: '데이터가 없습니다' }, { status: 400 });
    }

    // 데이터 변환
    const transactions: TransactionInsert[] = [];
    const errors: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // Excel은 1-based, 헤더 제외

      try {
        // 날짜 파싱
        let dateValue: Date;
        if (row.날짜 instanceof Date) {
          dateValue = row.날짜;
        } else if (typeof row.날짜 === 'number') {
          // Excel 시리얼 날짜
          dateValue = new Date((row.날짜 - 25569) * 86400 * 1000);
        } else if (typeof row.날짜 === 'string') {
          dateValue = new Date(row.날짜);
        } else {
          errors.push(`Row ${rowNum}: 날짜가 없습니다`);
          continue;
        }

        if (isNaN(dateValue.getTime())) {
          errors.push(`Row ${rowNum}: 잘못된 날짜 형식`);
          continue;
        }

        // 금액 파싱
        let amount: number;
        if (typeof row.금액 === 'number') {
          amount = Math.abs(row.금액);
        } else if (typeof row.금액 === 'string') {
          amount = Math.abs(parseInt(row.금액.replace(/[^0-9-]/g, '')) || 0);
        } else {
          errors.push(`Row ${rowNum}: 금액이 없습니다`);
          continue;
        }

        if (amount <= 0) {
          errors.push(`Row ${rowNum}: 금액은 0보다 커야 합니다`);
          continue;
        }

        // 타입 매핑
        const typeText = row['수입/지출']?.trim() || '';
        const type = TYPE_MAPPING[typeText];
        if (!type) {
          errors.push(`Row ${rowNum}: 알 수 없는 수입/지출 유형 "${typeText}"`);
          continue;
        }

        // 필수 필드 확인
        const asset = row.자산?.trim();
        const category = row.분류?.trim();
        
        if (!asset) {
          errors.push(`Row ${rowNum}: 자산이 없습니다`);
          continue;
        }
        if (!category) {
          errors.push(`Row ${rowNum}: 분류가 없습니다`);
          continue;
        }

        transactions.push({
          user_id: userId,
          date: dateValue.toISOString(),
          asset,
          category,
          sub_category: row.소분류?.trim() || null,
          description: row.내용?.trim() || null,
          amount,
          type,
          currency: 'KRW',
          source: 'excel',
          import_batch_id: importBatchId,
        });
      } catch (err) {
        errors.push(`Row ${rowNum}: 처리 오류`);
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({ 
        error: '유효한 데이터가 없습니다',
        details: errors.slice(0, 10),
      }, { status: 400 });
    }

    // Supabase에 삽입 (중복 무시)
    const { data: insertedData, error: insertError } = await supabase
      .from('ledger_transactions')
      .upsert(transactions, {
        onConflict: 'user_id,date,amount,asset,type',
        ignoreDuplicates: true,
      })
      .select('id');

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ 
        error: '데이터 저장 실패',
        details: insertError.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported: insertedData?.length || 0,
      total: transactions.length,
      skipped: transactions.length - (insertedData?.length || 0),
      errors: errors.slice(0, 10),
      import_batch_id: importBatchId,
    });

  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ 
      error: '서버 오류',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}
