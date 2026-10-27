'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

/** MacroDroid 가 보낼 본문 (매직 텍스트는 MacroDroid 안에서 [ ] 형식으로 치환됨) */
const BODY_TEMPLATE = '{"title":"[not_title]","text":"[notification]"}';

interface TokenRow {
  id: string;
  created_at: string;
  last_used_at: string | null;
  use_count: number;
  /** 마지막 거절·테스트 기록 (card-ingest 가 남김) */
  last_error?: string | null;
  last_error_at?: string | null;
}

/** 서버가 남긴 마지막 기록을 사람이 읽을 문장으로 */
const describeLastEvent = (t: TokenRow): { text: string; tone: 'ok' | 'warn' } | null => {
  if (!t.last_error || !t.last_error_at) return null;
  const when = fmtTime(t.last_error_at);
  if (t.last_error.startsWith('test_run_ok')) {
    return { text: `${when} 동작 테스트 성공 — 연결 정상. 실제 카드 문자가 오면 아래 목록에 들어와요.`, tone: 'ok' };
  }
  if (t.last_error.startsWith('unfilled_magic_text')) {
    return { text: `${when} 알림 내용 대신 변수 이름이 그대로 왔어요. 본문 변수를 … 버튼으로 다시 넣어 주세요.`, tone: 'warn' };
  }
  if (t.last_error.startsWith('empty_text')) {
    return { text: `${when} 알림 본문이 비어서 왔어요. 본문 설정을 확인해 주세요.`, tone: 'warn' };
  }
  return { text: `${when} ${t.last_error}`, tone: 'warn' };
};

interface RecentRow {
  id: string;
  created_at: string;
  status: string;
  amount: number | null;
  sender: string | null;
  item_name: string | null;
  raw_sms: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '확인 대기',
  confirmed: '가계부 등록',
  dismissed: '숨김',
};

const fmtTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

/** 브라우저에서 토큰 생성 → SHA-256 해시만 저장 (원문은 화면에 한 번만 표시) */
const makeToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `ll_${b64}`;
};
const sha256Hex = async (text: string) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

function CopyRow({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 pt-1 text-[11px] text-gray-500 dark:text-gray-400">{label}</span>
      <code
        className={`flex-1 min-w-0 break-all rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-1 text-[11px] text-gray-800 dark:text-gray-100 ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* 복사 실패 시 길게 눌러 선택 */
          }
        }}
        className="shrink-0 px-2 py-1 text-[11px] rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {copied ? '복사됨' : '복사'}
      </button>
    </div>
  );
}

/** 설정 > 카드 알림 연동: MacroDroid 로 보내는 카드 결제 알림을 가계부 대기 목록으로 */
export default function CardIngestSettings() {
  const supabase = getSupabase();
  const endpoint = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/card-ingest`;
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from('ingest_tokens').select('id, created_at, last_used_at, use_count, last_error, last_error_at').order('created_at', { ascending: false }),
      supabase
        .from('pending_transactions')
        .select('id, created_at, status, amount, sender, item_name, raw_sms')
        .eq('parsed_data->>source', 'macrodroid')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);
    setTokens((t as TokenRow[]) ?? []);
    setRecent((r as RecentRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const issue = async () => {
    if (!supabase) return;
    if (tokens.length > 0 && !window.confirm('새 토큰을 발급하면 기존 토큰은 바로 사용할 수 없게 됩니다. MacroDroid 의 토큰도 바꿔야 해요. 계속할까요?')) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('로그인이 필요해요.');
      if (tokens.length > 0) {
        const { error: delErr } = await supabase.from('ingest_tokens').delete().in('id', tokens.map((t) => t.id));
        if (delErr) throw delErr;
      }
      const token = makeToken();
      const { error } = await supabase
        .from('ingest_tokens')
        .insert({ user_id: auth.user.id, token_hash: await sha256Hex(token), label: 'MacroDroid' });
      if (error) throw error;
      setNewToken(token);
      setNote('');
      await load();
    } catch (err) {
      setNote(`❌ 발급 실패: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!supabase || tokens.length === 0) return;
    if (!window.confirm('연동을 끊을까요? MacroDroid 에서 보내는 알림을 더 이상 받지 않아요.')) return;
    setBusy(true);
    const { error } = await supabase.from('ingest_tokens').delete().in('id', tokens.map((t) => t.id));
    setBusy(false);
    if (error) setNote(`❌ ${error.message}`);
    else {
      setNewToken(null);
      setNote('연동을 끊었어요.');
      await load();
    }
  };

  const active = tokens[0];

  return (
    <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">카드 알림 연동</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {open ? '닫기' : '설정'}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        휴대폰(MacroDroid)이 카드 결제 알림을 보내면 가계부 확인 대기 목록에 들어가고, Daily 화면에 등록 팝업이 떠요.
      </p>

      {open && (
        <div className="mt-3 space-y-3">
          {/* 토큰 상태 */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-[rgb(254,252,247)] dark:bg-gray-800">
            {active ? (
              <p className="text-xs text-gray-700 dark:text-gray-200">
                <span className="text-green-600 dark:text-green-400">● 연동 중</span> · 발급 {fmtTime(active.created_at)} · 최근 수신{' '}
                {fmtTime(active.last_used_at)} · {active.use_count}건
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">아직 발급한 토큰이 없어요.</p>
            )}
            {active &&
              (() => {
                const ev = describeLastEvent(active);
                if (!ev) return null;
                return (
                  <p className={`mt-1 text-[11px] ${ev.tone === 'ok' ? 'text-green-700 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {ev.text}
                  </p>
                );
              })()}
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={issue}
                disabled={busy}
                className="px-3 py-1.5 text-xs rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 disabled:opacity-50"
              >
                {active ? '토큰 새로 발급' : '토큰 발급'}
              </button>
              {active && (
                <button
                  type="button"
                  onClick={revoke}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-600 dark:text-red-400 disabled:opacity-50"
                >
                  연동 끊기
                </button>
              )}
            </div>
          </div>

          {/* MacroDroid 에 넣을 값 */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-100">MacroDroid [HTTP 요청]에 넣을 값</p>
            <CopyRow label="주소" value={endpoint} />
            <CopyRow label="방식" value="POST" />
            <CopyRow label="헤더 이름" value="x-ingest-token" />
            {newToken ? (
              <>
                <CopyRow label="헤더 값" value={newToken} />
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  ⚠️ 토큰은 지금 한 번만 보여요. 복사해서 MacroDroid 에 넣어 두세요. 잃어버리면 새로 발급하면 돼요.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 pl-16">
                헤더 값(토큰)은 발급할 때 한 번만 보여요. 필요하면 [토큰 새로 발급]을 눌러 주세요.
              </p>
            )}
            <CopyRow label="본문 형식" value="application/json" />
            <CopyRow label="본문" value={BODY_TEMPLATE} />
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              본문의 [not_title]·[notification] 은 직접 타이핑하기보다 MacroDroid 의 매직 텍스트(…) 버튼에서 &lsquo;알림 제목&rsquo;·&lsquo;알림 텍스트&rsquo;를
              골라 넣으면 정확해요.
            </p>
          </div>

          {/* 최근 수신 */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-800 dark:text-gray-100">최근 받은 알림</p>
              <button type="button" onClick={load} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">
                새로고침
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">아직 받은 알림이 없어요.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {recent.map((r) => (
                  <li key={r.id} className="text-[11px] text-gray-700 dark:text-gray-200">
                    <span className="text-gray-400">{fmtTime(r.created_at)}</span> ·{' '}
                    <span className="font-medium">{STATUS_LABEL[r.status] ?? r.status}</span>
                    {r.amount != null && <> · {Number(r.amount).toLocaleString('ko-KR')}원</>}
                    {r.item_name && <> · {r.item_name}</>}
                    {!r.amount && <span className="block text-gray-400 truncate">{r.raw_sms.replace(/\s+/g, ' ')}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {note && <p className="text-xs text-gray-700 dark:text-gray-200">{note}</p>}
        </div>
      )}
    </div>
  );
}
