// Edge Function: card-ingest — 휴대폰(MacroDroid)이 보낸 카드 결제 알림을 받아 가계부 대기 목록에 넣는다.
//
// 요청 (verify_jwt=false, 아래에서 직접 인증)
//   POST /functions/v1/card-ingest
//   헤더: x-ingest-token: <설정 화면에서 발급한 토큰>, Content-Type: application/json
//   본문: { "title": "[not_title]", "text": "[notification]", "app": "<알림 앱 이름, 선택>" }
//         (sms-parser 시절 이름 sender / message / not_title / not_text / notification 도 받음)
//
// 처리
//   - 토큰은 SHA-256 해시로 ingest_tokens 에서 찾음 (원문 저장 안 함)
//   - 같은 사용자·같은 본문이 10분 안에 또 오면 중복으로 무시, 1시간 120건 초과 시 429
//   - 금액이 없는 알림(광고·공지 등)은 status='dismissed' 로만 보관 (팝업 없음, 파서 개선 참고용)
//   - 파싱 로직은 sms-parser 에서 가져옴 (2단계에서 우리·KB 실제 알림으로 보강 예정)
import { createClient } from 'npm:@supabase/supabase-js@2';

type Json = Record<string, unknown>;

interface RequestBody {
  title?: string;
  text?: string;
  app?: string;
  received_at?: string;
  // 예전 이름들
  sender?: string;
  message?: string;
  not_title?: string;
  not_text?: string;
  notification?: string;
  not_timestamp?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-ingest-token, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: Json) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parseIncomingBody(raw: string): RequestBody {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as RequestBody;
  } catch {
    // MacroDroid 는 매직 텍스트를 JSON 이스케이프 없이 끼워 넣는다 → 카드 문자의 줄바꿈 때문에 JSON 이 깨짐
    if (raw.trim().startsWith('{')) {
      try {
        const repaired = raw.replace(/\r\n|\r|\n/g, '\\n').replace(/\t/g, '\\t');
        const parsed = JSON.parse(repaired);
        if (parsed && typeof parsed === 'object') return parsed as RequestBody;
      } catch {
        // 따옴표까지 섞인 경우 → 아래 폼/원문 처리로
      }
    }
  }
  const params = new URLSearchParams(raw);
  if ([...params.keys()].length > 0 && (params.has('text') || params.has('message') || params.has('title'))) {
    return Object.fromEntries(params.entries()) as RequestBody;
  }
  return raw.trim() ? { text: raw } : {};
}

/** MacroDroid 변수가 치환되지 않고 그대로 온 경우 (예: "[notification]", "{not_text}") */
const isUnfilledMagicText = (s: string) => /^\s*[\[{][a-z_]+[\]}]\s*$/i.test(s);

// ─── Amount Parsing ─────────────────────────────────────
// 금액 파싱: "N,NNN원" 패턴을 우선 매칭, 날짜/시간 숫자 제외
function parseAmount(message: string): number | null {
  // 1) "N,NNN원" or "N원" 형태를 모두 수집
  const wonMatches = [...message.matchAll(/([0-9][0-9,]*)\s*원/g)];
  if (wonMatches.length > 0) {
    // 누적 사용액·잔액·한도처럼 결제 금액이 아닌 숫자는 건너뛰고, 처음 나오는 금액을 쓴다
    // (예전에는 가장 큰 금액을 골라 "누적1,234,567원" 이 결제 금액으로 잡힐 수 있었음)
    for (const m of wonMatches) {
      const before = message.slice(Math.max(0, (m.index ?? 0) - 6), m.index ?? 0);
      if (/누적|잔액|한도|잔여|이용가능|사용가능/.test(before)) continue;
      const n = Number(m[1].replace(/,/g, ''));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
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
  // 본문에 날짜가 없으면 받은 시각의 한국 날짜 (UTC 로 자르면 0~9시 결제가 전날이 됨)
  const t = receivedAt ? new Date(receivedAt) : new Date();
  const base = Number.isNaN(t.getTime()) ? new Date() : t;
  return new Date(base.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
  // 공통: 줄 분리
  const lines = message.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  // 1) Labeled fields: "종목명 : TIGER ...", "가맹점 : ...", "적요 : ..."
  const labeled =
    message.match(/종목명\s*[:\-]\s*([^\n\r]+)/) ||
    message.match(/가맹점\s*[:\-]\s*([^\n\r]+)/) ||
    message.match(/적요\s*[:\-]\s*([^\n\r]+)/);
  if (labeled) {
    const name = labeled[1].replace(/^▶\s*/, '').trim();
    if (name.length > 0) return name;
  }

  // 2) Multi-line card format:
  //    "04/06 08:59"  ← 이 줄의 바로 다음 줄이 가맹점명
  //    "세븐일레븐롯데월드타워1호점"
  const isMetaLine = (l: string) =>
    /원(\s*(일시불|할부.*))?$/.test(l) || /^(일시불|\d+개월)/.test(l) || /누적|잔액|한도/.test(l) || /님$/.test(l);
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}$/.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        if (!isMetaLine(lines[j])) return lines[j];
      }
    }
  }

  // 3) Inline card approval format: "MM/DD HH:MM 가맹점명 N,NNN원"
  const afterTime = message.match(/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s+(.+?)\s+[0-9,]+원/);
  if (afterTime) return afterTime[1].trim();

  // 4) "HH:MM 가맹점명 N,NNN원"
  const afterTime2 = message.match(/\d{1,2}:\d{2}\s+(.+?)\s+[0-9,]+원/);
  if (afterTime2) return afterTime2[1].trim();

  // 5) Text between 원 and 승인/결제
  const between = message.match(/원\s+(.+?)\s+(?:승인|결제)/);
  if (between) return between[1].trim();

  // 6) Fallback for approval messages: 마지막 의미 있는 줄 (헤더·금액·날짜·이름·카드승인 줄 제외)
  if (/승인|결제/.test(message)) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (
        /^\[.*\]$/.test(l) ||                          // [Web발신]
        /원$/.test(l) ||                               // 금액 줄
        /^\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}$/.test(l) || // 날짜시간 줄
        /님$/.test(l) ||                               // 고객명 줄
        /카드.*승인|카드.*체크/.test(l)                 // 카드승인 안내 줄
      ) continue;
      return l;
    }
  }

  return null;
}

/** 본문에서 카드사 이름 (우리카드(4025)체크승인 → 우리카드, KB국민카드1234승인 → KB국민카드) */
function detectCardIssuer(message: string): string | null {
  if (/KB\s*국민|국민카드|KB카드/i.test(message)) return 'KB국민카드';
  const m = message.match(/(우리|신한|삼성|현대|롯데|하나|BC|비씨|NH|농협|씨티|카카오뱅크|토스뱅크)\s*카드/i);
  if (m) return m[1].toUpperCase() === 'BC' || m[1] === '비씨' ? 'BC카드' : m[1] === '농협' ? 'NH카드' : `${m[1]}카드`;
  return null;
}

function parseSenderName(senderHeader: string | undefined, message: string): string | null {
  const senderTrimmed = (senderHeader ?? '').trim();

  // 0) 카드 승인 문자는 발신번호(1588-…)나 [Web발신] 대신 본문의 카드사 이름을 쓴다 → 결제수단 자동 선택
  const issuer = detectCardIssuer(message);
  if (issuer) return issuer;

  // 1) Prefer explicit institution name in [brackets] for Kakao notifications.
  //    Example:
  //    senderHeader="카카오톡", message="[키움] ... " => sender="키움"
  const bracket = message.match(/\[([^\]]+)\]/);
  const bracketSender = bracket?.[1]?.trim() ?? '';
  if (senderTrimmed) {
    if (
      /카카오|kakao|알림톡|web발신|웹발신|notification/i.test(senderTrimmed) &&
      bracketSender &&
      !/web발신|웹발신/i.test(bracketSender)
    ) {
      return bracketSender;
    }

    // 카드 승인 문구라면 "우리카드" 같은 발신 기관을 메시지에서 추출
    if (/web발신|웹발신|notification/i.test(senderTrimmed)) {
      const cardIssuer = message.match(/([^\s(\n\r]+카드)/);
      if (cardIssuer) return cardIssuer[1];
    }

    // 2) 일반 SMS면 sender 헤더 우선
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
  if (/취소/.test(s) && /승인|결제/.test(s)) return '환불';
  // 키워드 기반 카테고리 추론 (우선순위 순)
  if (/배당/.test(s)) return '배당금';
  if (/급여|월급/.test(s)) return '급여';
  if (/이자/.test(s)) return '이자';
  if (/이체/.test(s)) return '이체';
  if (/택시|버스|지하철|교통/.test(s)) return '교통';
  if (/편의점|마트|슈퍼|세븐일레븐|GS25|CU|이마트24/i.test(s)) return '생활비';
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
  // 승인취소·결제취소는 돈이 돌아오는 것 → 수입(환불)으로 두고 팝업에서 확인
  if (/취소/.test(s) && /승인|결제/.test(s)) return 'income';
  if (/이체/.test(s)) return 'transfer';
  if (/입금|배당|급여|월급|이자/.test(s)) return 'income';
  if (/출금|결제|승인|인출/.test(s)) return 'expense';
  return null;
}

// ─── Main Handler ───────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const token = (req.headers.get('x-ingest-token') || '').trim();
  if (token.length < 20) return json(401, { error: 'x-ingest-token 헤더가 없거나 올바르지 않습니다' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const tokenHash = await sha256Hex(token);
  const { data: tok } = await admin
    .from('ingest_tokens')
    .select('id, user_id, use_count')
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (!tok) return json(401, { error: '등록되지 않은 토큰입니다. 설정에서 새로 발급해 주세요.' });
  const userId = tok.user_id as string;

  const raw = await req.text().catch(() => '');
  const body = parseIncomingBody(raw);
  const title = String(body.title ?? body.not_title ?? body.sender ?? '').trim();
  const message = String(body.text ?? body.notification ?? body.not_text ?? body.message ?? '').trim();
  const app = String(body.app ?? '').trim();
  const receivedAt = String(body.received_at ?? body.not_timestamp ?? '').trim() || new Date().toISOString();

  // 거절 이유를 진단용으로 남김 (알림 본문 내용은 남기지 않음 — 길이와 치환 안 된 변수 이름만)
  const reject = async (reason: string, detail: Json, error: string) => {
    console.log(JSON.stringify({ reject: reason, ...detail }));
    await admin
      .from('ingest_tokens')
      .update({ last_error: `${reason} ${JSON.stringify(detail)}`.slice(0, 300), last_error_at: new Date().toISOString() })
      .eq('id', tok.id);
    return json(400, { error });
  };
  const shape = { raw_len: raw.length, title_len: title.length, text_len: message.length, keys: Object.keys(body).slice(0, 8) };
  // MacroDroid [동작 테스트]는 실제 알림이 없어 변수가 비거나 글자 그대로 온다 → 연결 확인으로 보고 200
  // (예전에는 400 을 돌려줘 설정이 틀린 것처럼 보였음). 저장은 하지 않음.
  const looksLikeTestRun =
    (!message || isUnfilledMagicText(message)) && (!title || isUnfilledMagicText(title));
  if (looksLikeTestRun) {
    console.log(JSON.stringify({ test_run: true, ...shape }));
    await admin
      .from('ingest_tokens')
      .update({ last_error: 'test_run_ok (연결 정상, 실제 알림 대기 중)', last_error_at: new Date().toISOString() })
      .eq('id', tok.id);
    return json(200, { status: 'test_ok', message: '연결 정상. 실제 알림이 오면 가계부 대기 목록에 들어갑니다.' });
  }
  if (!message) return await reject('empty_text', shape, 'text(알림 본문)가 비어 있습니다');
  if (isUnfilledMagicText(message)) {
    return await reject(
      'unfilled_magic_text',
      { ...shape, text: message.slice(0, 40), title: isUnfilledMagicText(title) ? title.slice(0, 40) : undefined },
      `알림 본문 대신 "${message}" 가 그대로 왔습니다. MacroDroid 매직 텍스트를 다시 넣어 주세요.`
    );
  }

  // 1시간 120건 제한
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from('pending_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', hourAgo);
  if ((recentCount ?? 0) >= 120) return json(429, { error: '요청이 너무 많습니다' });

  // 10분 내 같은 본문 → 중복
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: dup } = await admin
    .from('pending_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('raw_sms', message)
    .gte('created_at', tenMinAgo)
    .limit(1);

  await admin
    .from('ingest_tokens')
    .update({ last_used_at: new Date().toISOString(), use_count: (tok.use_count ?? 0) + 1, last_error: null, last_error_at: null })
    .eq('id', tok.id);

  if (dup && dup.length > 0) return json(200, { status: 'duplicate', id: dup[0].id });

  const sender = parseSenderName(title, message);
  const amountBeforeTax = parseAmountBeforeTax(message);
  const amount = parseAfterTaxAmount(message) ?? parseAmount(message);
  const transactionDate = parseTransactionDate(message, receivedAt);
  const transactionTime = parseTransactionTime(message);
  const accountNumber = parseAccountNumber(message);
  const itemName = parseItemName(message);
  const category = inferCategory(message);
  const txType = inferTransactionType(message);

  const parsed: Json = {
    source: 'macrodroid',
    source_app: app || null,
    raw_title: title || null,
    received_at: receivedAt,
    detected_amount: amount,
    detected_amount_before_tax: amountBeforeTax,
    detected_date: transactionDate,
    detected_time: transactionTime,
    detected_account_number: accountNumber,
    detected_item_name: itemName,
    inferred_category: category,
    inferred_transaction_type: txType,
  };

  // 금액이 없으면 결제 알림이 아닌 것으로 보고 팝업 없이 보관만
  const status = amount ? 'pending' : 'dismissed';
  if (!amount) parsed.skip_reason = 'no_amount';

  const { data, error } = await admin
    .from('pending_transactions')
    .insert({
      user_id: userId,
      raw_sms: message,
      sender: sender ?? '',
      amount,
      amount_before_tax: amountBeforeTax,
      transaction_date: transactionDate,
      transaction_time: transactionTime,
      account_number: accountNumber,
      item_name: itemName,
      transaction_type: txType,
      category,
      memo: null,
      status,
      parsed_data: parsed,
    })
    .select('id')
    .single();

  if (error) return json(500, { error: error.message });
  return json(200, { status: status === 'pending' ? 'ok' : 'stored_without_amount', id: data?.id, parsed });
});
