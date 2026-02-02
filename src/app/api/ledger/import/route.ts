import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 거래 유형 매핑 (CSV → DB)
const TYPE_MAPPING: Record<string, { transaction_type: string; is_transfer: boolean }> = {
  '수입': { transaction_type: '수입', is_transfer: false },
  '지출': { transaction_type: '지출', is_transfer: false },
  '이체': { transaction_type: '자산이체', is_transfer: true },
  '이체지출': { transaction_type: '자산이체', is_transfer: true },
  '이체입금': { transaction_type: '자산이체', is_transfer: true },
};

interface ExcelRow {
  날짜?: string | number | Date;
  자산?: string;
  이체자산?: string;
  분류?: string;
  소분류?: string;
  메모?: string;
  '금액(원)'?: number | string;
  금액?: number | string;
  '수입/지출'?: string;
}

interface TransactionInsert {
  user_id: string;
  date: string;
  asset: string;
  category: string;
  sub_category: string | null;
  transaction_type: string;
  is_transfer: boolean;
  transfer_asset: string | null;
  amount: number;
  memo: string | null;
  currency: string;
  source: string;
  import_batch_id: string;
}

export async function POST(request: NextRequest) {
  try {
    // 환경 변수 확인
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Supabase 설정이 없습니다' }, { status: 500 });
    }

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // 사용자 토큰으로 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
    
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
          // "2026. 01. 30 20:10:58" 형식 파싱
          const cleaned = row.날짜.replace(/\. /g, '-').replace(/ /, 'T');
          dateValue = new Date(cleaned);
          if (isNaN(dateValue.getTime())) {
            dateValue = new Date(row.날짜);
          }
        } else {
          errors.push(`Row ${rowNum}: 날짜가 없습니다`);
          continue;
        }

        if (isNaN(dateValue.getTime())) {
          errors.push(`Row ${rowNum}: 잘못된 날짜 형식`);
          continue;
        }

        // 금액 파싱 (금액(원) 또는 금액 컬럼)
        const rawAmount = row['금액(원)'] ?? row.금액;
        let amount: number;
        if (typeof rawAmount === 'number') {
          amount = Math.abs(rawAmount);
        } else if (typeof rawAmount === 'string') {
          amount = Math.abs(parseInt(rawAmount.replace(/[^0-9-]/g, '')) || 0);
        } else {
          errors.push(`Row ${rowNum}: 금액이 없습니다`);
          continue;
        }

        if (amount <= 0) {
          errors.push(`Row ${rowNum}: 금액은 0보다 커야 합니다`);
          continue;
        }

        // 거래 유형 매핑
        const typeText = row['수입/지출']?.trim() || '';
        const typeInfo = TYPE_MAPPING[typeText];
        if (!typeInfo) {
          errors.push(`Row ${rowNum}: 알 수 없는 거래 유형 "${typeText}"`);
          continue;
        }

        // 필수 필드 확인
        const asset = row.자산?.trim();
        
        if (!asset) {
          errors.push(`Row ${rowNum}: 자산이 없습니다`);
          continue;
        }

        // 분류 처리 (이체인 경우 '자산이체'로 설정)
        let category = row.분류?.trim() || '';
        if (typeInfo.is_transfer) {
          category = '자산이체';
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
          transaction_type: typeInfo.transaction_type,
          is_transfer: typeInfo.is_transfer,
          transfer_asset: typeInfo.is_transfer ? (row.이체자산?.trim() || null) : null,
          amount,
          memo: row.메모?.trim() || null,
          currency: 'KRW',
          source: 'csv',
          import_batch_id: importBatchId,
        });
      } catch (err) {
        errors.push(`Row ${rowNum}: 처리 오류`);
      }
    }

    if (transactions.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: '유효한 데이터가 없습니다',
        errors: errors.slice(0, 20),
      }, { status: 400 });
    }

    // Supabase에 삽입 (중복 무시)
    const { data: insertedData, error: insertError } = await supabase
      .from('transactions')
      .upsert(transactions, {
        onConflict: 'user_id,date,amount,asset,transaction_type',
        ignoreDuplicates: true,
      })
      .select('id');

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json({ 
        success: false,
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
      success: false,
      error: '서버 오류',
      details: err instanceof Error ? err.message : 'Unknown error',
    }, { status: 500 });
  }
}
