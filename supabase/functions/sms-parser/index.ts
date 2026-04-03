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

function parseAmount(str: string | undefined | null): number | null {
  if (!str) return null;
  const m = str.match(/([0-9][0-9,]*)\s*원?|([0-9][0-9,]*)/);
  if (!m) return null;
  const raw = (m[1] ?? m[2] ?? '').replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseAmountBeforeTax(message: string): number | null {
  // e.g. "배당입금 : 185,039 (세전) / 172,209 (세후)"
  const m = message.match(/([0-9][0-9,]*)\s*\(세전\)/);
  if (!m) return null;
  const raw = m[1].replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseTransactionDate(message: string, receivedAt?: string): string | null {
  // Match YYYY-MM-DD or MM/DD (or M/D, with optional leading zeros)
  const full = message.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (full) {
    const y = full[1];
    const m = full[2].padStart(2, '0');
    const d = full[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const md = message.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (md) {
    const now = receivedAt ? new Date(receivedAt) : new Date();
    const y = now.getFullYear().toString();
    const m = md[1].padStart(2, '0');
    const d = md[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return receivedAt ? new Date(receivedAt).toISOString().slice(0, 10) : null;
}

function parseAccountNumber(message: string): string | null {
  // Masked patterns like 52**-**44 or 123-45-6789-00
  const m = message.match(/\b[\d\*]{2,4}-[\d\*]{2,4}(?:-[\d\*]{2,6})*\b/);
  return m ? m[0] : null;
}

function parseItemName(message: string): string | null {
  // Try labeled fields first
  const labeled =
    message.match(/종목명\s*:\s*([^\n\r]+)/) ||
    message.match(/가맹점\s*:\s*([^\n\r]+)/);
  if (labeled) {
    return labeled[1].trim();
  }
  // Fallback: extract text after time or date for card approvals like "04/02 14:23 스타벅스 5,500원 승인"
  const afterTime = message.match(/\b\d{1,2}:\d{2}\s+([^\n\r]+?)\s+[0-9,]+원/);
  if (afterTime) return afterTime[1].trim();
  return null;
}

function parseSenderName(senderHeader: string | undefined, message: string): string | null {
  if (senderHeader && senderHeader.trim()) return senderHeader.trim();
  const bracket = message.match(/\[([^\]]+)\]/);
  return bracket ? bracket[1].trim() : null;
}

function inferCategory(message: string): string | null {
  const s = message.toLowerCase();
  if (s.includes('배당') || s.includes('배당금')) return '배당금';
  if (s.includes('이체')) return '이체';
  if (s.includes('결제') || s.includes('승인')) return '생활비';
  if (s.includes('입금')) return '수입';
  if (s.includes('출금')) return '지출';
  return null;
}

function inferTransactionType(message: string): 'income' | 'expense' | 'transfer' | null {
  const s = message.toLowerCase();
  if (s.includes('이체')) return 'transfer';
  if (s.includes('입금') || s.includes('배당')) return 'income';
  if (s.includes('출금') || s.includes('결제') || s.includes('승인')) return 'expense';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Basic auth presence (we do not verify anon key value here)
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
    // Prefer explicit "세후" amount if present; otherwise first numeric
    let amount: number | null = null;
    const afterTax = message.match(/([0-9][0-9,]*)\s*\(세후\)/);
    if (afterTax) {
      amount = Number(afterTax[1].replace(/,/g, ''));
    } else {
      amount = parseAmount(message);
    }

    const transactionDate = parseTransactionDate(message, receivedAt ?? undefined);
    const accountNumber = parseAccountNumber(message);
    const itemName = parseItemName(message);
    const category = inferCategory(message);
    const txType = inferTransactionType(message);

    const parsed: Json = {
      received_at: receivedAt || null,
      detected_amount: amount,
      detected_amount_before_tax: amountBeforeTax,
      detected_date: transactionDate,
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
      transaction_time: null as string | null,
      account_number: accountNumber,
      item_name: itemName,
      transaction_type: txType,
      category: category,
      memo: null as string | null,
      // status defaults to 'pending' via DB
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

    return jsonResponse(200, { status: 'ok', id: data?.id });
  } catch (e) {
    return jsonResponse(400, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

