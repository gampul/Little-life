import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { parseLedgerRows, type LedgerExcelRow } from '../../../../lib/ledgerImport';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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
    // mode=replace: 기존 내역을 모두 지우고 이 파일로 교체 (기본은 없는 거래만 추가)
    const replaceAll = formData.get('mode') === 'replace';
    
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
    // 날짜는 시리얼 숫자 그대로 받아 KST 로 직접 변환 (cellDates 는 서버 시간대·초 단위 오차가 생김)
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // 첫 번째 시트 파싱
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData: LedgerExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

    if (jsonData.length === 0) {
      return NextResponse.json({ error: '데이터가 없습니다' }, { status: 400 });
    }

    // 데이터 변환 (이모지 제거·이체 상대 자산·내용→메모 는 lib/ledgerImport)
    const parsed = parseLedgerRows(jsonData);
    const errors = parsed.errors;
    const transactions: TransactionInsert[] = parsed.rows.map((r) => ({
      ...r,
      user_id: userId,
      currency: 'KRW',
      source: 'csv',
      import_batch_id: importBatchId,
    }));

    if (transactions.length === 0) {
      return NextResponse.json({ 
        success: false,
        error: '유효한 데이터가 없습니다',
        errors: errors.slice(0, 20),
      }, { status: 400 });
    }

    // 전체 교체: 백업 → 삭제 → 삽입을 DB 함수 한 번(한 트랜잭션)으로. 실패하면 기존 내역 그대로
    if (replaceAll) {
      const { data: replaced, error: replaceError } = await supabase.rpc('replace_transactions', {
        p_rows: transactions.map(({ user_id: _u, ...rest }) => rest),
      });
      if (replaceError) {
        console.error('Replace error:', replaceError);
        return NextResponse.json({
          success: false,
          error: '교체 실패 (기존 내역은 그대로입니다)',
          details: replaceError.message,
        }, { status: 500 });
      }
      const result = (replaced ?? {}) as { inserted?: number; deleted?: number };
      return NextResponse.json({
        success: true,
        replaced: true,
        imported: result.inserted ?? 0,
        deleted: result.deleted ?? 0,
        total: transactions.length,
        skipped: transactions.length - (result.inserted ?? 0),
        errors: errors.slice(0, 10),
        import_batch_id: importBatchId,
      });
    }

    // 이미 있는 거래는 건너뜀 — 같은 자산·금액·유형이고 시각이 2초 안이면 같은 거래로 봄
    // (예전 업로드와 밀리초 단위가 조금 달라도 중복으로 쌓이지 않게)
    const times = transactions.map((t) => Date.parse(t.date));
    const from = new Date(Math.min(...times) - 5000).toISOString();
    const to = new Date(Math.max(...times) + 5000).toISOString();
    const existing = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
      const { data: page, error: exErr } = await supabase
        .from('transactions')
        .select('date, amount, asset, transaction_type')
        .eq('user_id', userId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true })
        .range(offset, offset + 999);
      if (exErr) break;
      for (const e of page ?? []) {
        const sec = Math.floor(Date.parse(e.date as string) / 1000);
        existing.add(`${sec}|${e.amount}|${e.asset}|${e.transaction_type}`);
      }
      if (!page || page.length < 1000) break;
    }
    const isExisting = (t: TransactionInsert) => {
      const sec = Math.floor(Date.parse(t.date) / 1000);
      for (const d of [-2, -1, 0, 1, 2]) if (existing.has(`${sec + d}|${t.amount}|${t.asset}|${t.transaction_type}`)) return true;
      return false;
    };
    const fresh = transactions.filter((t) => !isExisting(t));
    if (fresh.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        total: transactions.length,
        skipped: transactions.length,
        errors: errors.slice(0, 10),
        import_batch_id: importBatchId,
      });
    }

    // Supabase에 삽입 (중복 무시)
    const { data: insertedData, error: insertError } = await supabase
      .from('transactions')
      .upsert(fresh, {
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
