// Deno runtime Edge Function: sms-parser
// Requirements:
// - POST with headers: Authorization: Bearer {SUPABASE_ANON_KEY}, x-user-id: {USER_UUID}
// - Body: { sender, message, received_at }
// - Parse SMS content and insert into pending_transactions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type Json = Record<string, unknown>;

interface RequestBody {
  sender?: string;
  message?: string;
  received_at?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL_INTERNAL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-user-id, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonResponse(status: number, body: Json) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// ─── Amount Parsing ─────────────────────────────────────
// 금액 파싱: "N,NNN원" 패턴을 우선 매칭, 날짜/시간 숫자 제외
function parseAmount(message: string): number | null {
  // 1) "N,NNN원" or "N원" 형태를 모두 수집
  const wonMatches = [...message.matchAll(/([0-9][0-9,]*)\s*원/g)];
  if (wonMatches.length > 0) {
    // 가장 큰 금액을 선택 (보통 실제 거래 금액)
    let best: number | null = null;
    for (const m of wonMatches) {
      const raw = m[1].replace(/,/g, '');
      const n = Number(raw);
      if (Number.isFinite(n) && (best === null || n > best)) {
        best = n;
      }
    }
    return best;
  }

  // 2) "원" 없는 경우: 콤마가 포함된 숫자를 찾기 (1,000 이상)
  const commaNum = message.match(/\b([0-9]{1,3}(?:,[0-9]{3})+)\b/);
  if (commaNum) {
    const n = Number(commaNum[1].replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function parseAmountBeforeTax(message: string): number | null {
  // e.g. "185,039원 (세전)" or "185,039 (세전)"
  const m = message.match(/([0-9][0-9,]*)\s*원?\s*\(세전\)/);
  if (!m) return null;
  const raw = m[1].replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseAfterTaxAmount(message: string): number | null {
  // e.g. "172,209원 (세후)" or "172,209 (세후)"
  const m = message.match(/([0-9][0-9,]*)\s*원?\s*\(세후\)/);
  if (!m) return null;
  const raw = m[1].replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// ─── Date / Time Parsing ────────────────────────────────
function parseTransactionDate(message: string, receivedAt?: string): string | null {
  // YYYY-MM-DD
  const full = message.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (full) {
    return `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')}`;
  }
  // YYYY.MM.DD or YYYY/MM/DD
  const dotFull = message.match(/\b(20\d{2})[./](\d{1,2})[./](\d{1,2})\b/);
  if (dotFull) {
    return `${dotFull[1]}-${dotFull[2].padStart(2, '0')}-${dotFull[3].padStart(2, '0')}`;
  }
  // MM/DD (without year)
  const md = message.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (md) {
    const now = receivedAt ? new Date(receivedAt) : new Date();
    const y = now.getFullYear().toString();
    return `${y}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`;
  }
  // MM.DD
  const mdDot = message.match(/\b(\d{1,2})\.(\d{1,2})\b/);
  if (mdDot) {
    const mNum = parseInt(mdDot[1]);
    const dNum = parseInt(mdDot[2]);
    if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
      const now = receivedAt ? new Date(receivedAt) : new Date();
      const y = now.getFullYear().toString();
      return `${y}-${mdDot[1].padStart(2, '0')}-${mdDot[2].padStart(2, '0')}`;
    }
  }
  return receivedAt ? new Date(receivedAt).toISOString().slice(0, 10) : null;
}

function parseTransactionTime(message: string): string | null {
  const m = message.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b/);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const min = m[2];
  const sec = m[3] ?? '00';
  return `${h}:${min}:${sec}`;
}

// ─── Account / Item / Sender ────────────────────────────
function parseAccountNumber(message: string): string | null {
  // Masked patterns: 52**-**44, 123-45-6789-00, 1234-****-****-5678
  const m = message.match(/\b[\d\*]{2,4}-[\d\*]{2,4}(?:-[\d\*]{2,6})*\b/);
  return m ? m[0] : null;
}

function parseItemName(message: string): string | null {
  // 1) Labeled fields: "종목명: TIGER 미국초단기(3개월이하)국채"
  // - 숫자/괄호 포함 이름도 허용
  // - 줄바꿈 전까지 추출
  const labeled =
    message.match(/종목명\s*[:\-]\s*([^\n\r]+)/) ||
    message.match(/가맹점\s*[:\-]\s*([^\n\r]+)/) ||
    message.match(/적요\s*[:\-]\s*([^\n\r]+)/);
  if (labeled) {
    const name = labeled[1]
      .replace(/^▶\s*/, '')
      .trim();
    if (name.length > 0) return name;
  }

  // 2) Card approval format: "MM/DD HH:MM 가맹점명 N,NNN원 승인"
  const afterTime = message.match(/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s+(.+?)\s+[0-9,]+원/);
  if (afterTime) return afterTime[1].trim();

  // 3) "HH:MM 가맹점명 N,NNN원"
  const afterTime2 = message.match(/\d{1,2}:\d{2}\s+(.+?)\s+[0-9,]+원/);
  if (afterTime2) return afterTime2[1].trim();

  // 4) Text between 원 and 승인/결제
  const between = message.match(/원\s+(.+?)\s+(?:승인|결제)/);
  if (between) return between[1].trim();

  return null;
}

function parseSenderName(senderHeader: string | undefined, message: string): string | null {
  const senderTrimmed = (senderHeader ?? '').trim();

  // 1) Prefer explicit institution name in [brackets] for Kakao notifications.
  //    Example:
  //    senderHeader="카카오톡", message="[키움] ... " => sender="키움"
  const bracket = message.match(/\[([^\]]+)\]/);
  const bracketSender = bracket?.[1]?.trim() ?? '';
  if (senderTrimmed) {
    if (/카카오|kakao|알림톡/i.test(senderTrimmed) && bracketSender) {
      return bracketSender;
    }
    // 2) 일반 SMS면 기존 sender 헤더 우선
    return senderTrimmed;
  }

  // 3) sender header가 없으면 [brackets] 사용
  if (bracketSender) return bracketSender;

  // 4) Extract from (parentheses) at start
  const paren = message.match(/^\(([^)]+)\)/);
  if (paren) return paren[1].trim();
  return null;
}

// ─── Category / Type Inference ──────────────────────────
function inferCategory(message: string): string | null {
  const s = message;
  // 키워드 기반 카테고리 추론 (우선순위 순)
  if (/배당/.test(s)) return '배당금';
  if (/급여|월급/.test(s)) return '급여';
  if (/이자/.test(s)) return '이자';
  if (/이체/.test(s)) return '이체';
  if (/택시|버스|지하철|교통/.test(s)) return '교통';
  if (/편의점|마트|슈퍼/.test(s)) return '생활비';
  if (/카페|스타벅스|커피/.test(s)) return '카페';
  if (/식당|치킨|피자|배달/.test(s)) return '식비';
  if (/병원|약국|의료/.test(s)) return '의료';
  if (/승인|결제/.test(s)) return '생활비';
  if (/입금/.test(s)) return '수입';
  if (/출금/.test(s)) return '지출';
  return null;
}

function inferTransactionType(message: string): 'income' | 'expense' | 'transfer' | null {
  const s = message;
  if (/이체/.test(s)) return 'transfer';
  if (/입금|배당|급여|월급|이자/.test(s)) return 'income';
  if (/출금|결제|승인|인출/.test(s)) return 'expense';
  return null;
}

// ─── Main Handler ───────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const auth = req.headers.get('authorization');
    if (!auth) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return jsonResponse(401, { error: 'Unauthorized: missing x-user-id' });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse(500, { error: 'Server misconfigured: missing SUPABASE env' });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body: RequestBody = await req.json().catch(() => ({}));
    const senderRaw = (body.sender ?? '').toString();
    const message = (body.message ?? '').toString();
    const receivedAt = (body.received_at ?? '').toString();

    if (!message) {
      return jsonResponse(400, { error: 'message is required' });
    }

    // Parse fields
    const sender = parseSenderName(senderRaw, message);
    const amountBeforeTax = parseAmountBeforeTax(message);
    const afterTaxAmount = parseAfterTaxAmount(message);
    // Prefer explicit 세후 > 세전 > general amount
    const amount = afterTaxAmount ?? parseAmount(message);

    const transactionDate = parseTransactionDate(message, receivedAt ?? undefined);
    const transactionTime = parseTransactionTime(message);
    const accountNumber = parseAccountNumber(message);
    const itemName = parseItemName(message);
    const category = inferCategory(message);
    const txType = inferTransactionType(message);

    const parsed: Json = {
      received_at: receivedAt || null,
      detected_amount: amount,
      detected_amount_before_tax: amountBeforeTax,
      detected_date: transactionDate,
      detected_time: transactionTime,
      detected_account_number: accountNumber,
      detected_item_name: itemName,
      inferred_category: category,
      inferred_transaction_type: txType,
      raw_sender_header: senderRaw || null,
    };

    const insertPayload = {
      user_id: userId,
      raw_sms: message,
      sender: sender,
      amount: amount,
      amount_before_tax: amountBeforeTax,
      transaction_date: transactionDate,
      transaction_time: transactionTime,
      account_number: accountNumber,
      item_name: itemName,
      transaction_type: txType,
      category: category,
      memo: null as string | null,
      parsed_data: parsed as unknown as Json,
    };

    const { data, error } = await supabase
      .from('pending_transactions')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      return jsonResponse(400, { error: error.message });
    }

    return jsonResponse(200, { status: 'ok', id: data?.id, parsed });
  } catch (e) {
    return jsonResponse(400, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
