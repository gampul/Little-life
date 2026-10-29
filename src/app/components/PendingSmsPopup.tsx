'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconCreditCard, IconX } from '@tabler/icons-react';
import { getSupabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import type { PendingTransaction, TransactionType } from '../../types/pending_transaction';

interface PendingSmsPopupProps {
  item: PendingTransaction;
  onConfirm: (id: string, updates: {
    transaction_type: TransactionType;
    category: string;
    asset: string;
    memo: string;
    amount: number;
  }) => Promise<void>;
  onTempSave: (id: string, updates: {
    transaction_type: TransactionType | null;
    asset: string;
    /** 사용처(가맹점) */
    item_name: string;
    /** 사용자가 덧붙인 메모만 (사용처 제외) */
    memo: string;
    amount: number;
  }) => Promise<void>;
  onSkip: (id: string) => void;
  onDismiss: (id: string) => Promise<void>;
  /** 이 건을 포함해 남은 확인 대기 건수 */
  remaining?: number;
}

interface AssetBalance {
  asset_name: string;
  balance: number;
  is_debt: boolean;
}

const TYPES: { key: TransactionType; label: string; active: string }[] = [
  { key: 'expense', label: '지출', active: 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm' },
  { key: 'income', label: '수입', active: 'bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm' },
  { key: 'transfer', label: '이체', active: 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' },
];

const won = (n: number) => new Intl.NumberFormat('ko-KR').format(n);

/** 저장된 memo 에서 사용자가 덧붙인 메모만 꺼냄 (카드 수신 시 memo = 가맹점명으로 들어옴) */
function splitNote(item: PendingTransaction): string {
  const memo = (item.memo ?? '').trim();
  const place = (item.item_name ?? '').trim();
  if (!memo || memo === place) return '';
  if (place && memo.startsWith(place + ' · ')) return memo.slice(place.length + 3);
  return memo;
}

/** 가계부에 들어갈 메모 = 사용처 · 메모 */
export function composeMemo(place: string, note: string): string {
  return [place.trim(), note.trim()].filter(Boolean).join(' · ');
}

const inputCls =
  'w-full rounded-xl bg-gray-50 dark:bg-gray-800 border border-transparent px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-blue-400 dark:focus:border-blue-600 transition';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

export function PendingSmsPopup({ item, onConfirm, onTempSave, onSkip, onDismiss, remaining = 1 }: PendingSmsPopupProps) {
  const { user: authUser } = useAuth();
  const [type, setType] = useState<TransactionType | null>(item.transaction_type ?? null);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [place, setPlace] = useState<string>(item.item_name ?? '');
  const [note, setNote] = useState<string>(() => splitNote(item));
  const [amount, setAmount] = useState<number>(() => Number(item.amount ?? 0));
  const [loading, setLoading] = useState(false);
  const [showRawSms, setShowRawSms] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const [assetList, setAssetList] = useState<AssetBalance[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    if (assetsLoaded) return;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) { setAssetsLoaded(true); return; }
      const user = authUser;
      if (!user) return; // 로그인 확인되면 다시 시도
      const { data, error } = await supabase.rpc('get_asset_balances', { p_user_id: user.id });
      if (!error && data) setAssetList(data);
      setAssetsLoaded(true);
    };
    load();
  }, [assetsLoaded, authUser]);

  const assets = useMemo(() => assetList.filter((a) => !a.is_debt), [assetList]);
  const debts = useMemo(() => assetList.filter((a) => a.is_debt), [assetList]);

  // 다른 건으로 넘어갈 때만 초기화
  useEffect(() => {
    setType(item.transaction_type ?? null);
    setPlace(item.item_name ?? '');
    setNote(splitNote(item));
    setAmount(Number(item.amount ?? 0));
    setShowRawSms(false);
    setSelectedAsset('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // 발신자(카드사)로 결제수단 자동 선택
  useEffect(() => {
    if (!assetsLoaded || assetList.length === 0 || selectedAsset) return;
    const sender = item.sender ?? '';
    const match = assetList.find((a) => sender.includes(a.asset_name) || a.asset_name.includes(sender));
    if (match) setSelectedAsset(match.asset_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsLoaded, assetList, item.id, item.sender]);

  // 메모 칸 자동 높이
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [note]);

  const dateTimeDisplay = useMemo(() => {
    const d = item.transaction_date ? item.transaction_date.slice(5).replace('-', '/') : '';
    const t = item.transaction_time ? item.transaction_time.slice(0, 5) : '';
    return [d, t].filter(Boolean).join(' ');
  }, [item.transaction_date, item.transaction_time]);

  const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const memo = composeMemo(place, note);

  const handleSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!type) { alert('거래 유형을 선택해주세요.'); return; }
    if (safeAmount <= 0) { alert('금액을 1원 이상 입력해주세요.'); return; }
    setLoading(true);
    try {
      await onConfirm(item.id, {
        transaction_type: type,
        category: item.category || '기타',
        asset: selectedAsset || item.sender || 'SMS',
        memo,
        amount: safeAmount,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTempSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await onTempSave(item.id, {
        transaction_type: type,
        asset: selectedAsset || item.sender || 'SMS',
        item_name: place.trim(),
        memo: note.trim(),
        amount: safeAmount,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSkip(item.id);
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('이 알림을 삭제할까요?')) return;
    setLoading(true);
    try {
      await onDismiss(item.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center" style={{ pointerEvents: 'auto' }}>
      {/* 배경 누르면 나중에 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={handleSkip} />

      <div
        className="relative w-full max-w-[400px] px-3 pb-3 sm:pb-0 animate-[popIn_0.22s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-3xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden max-h-[88vh] overflow-y-auto">
          {/* 헤더 */}
          <div className="flex items-center gap-2 px-5 pt-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <IconCreditCard size={16} stroke={1.8} aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.sender || '알 수 없는 발신자'}</span>
            {dateTimeDisplay && (
              <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{dateTimeDisplay}</span>
            )}
            <span className="ml-auto flex items-center gap-1">
              {remaining > 1 && (
                <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                  남은 {remaining}건
                </span>
              )}
              <button
                type="button"
                onClick={handleSkip}
                className="-mr-2 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="나중에 보기"
                title="나중에"
              >
                <IconX size={18} stroke={1.8} />
              </button>
            </span>
          </div>

          {/* 금액 + 사용처 */}
          <div className="px-5 pt-3 pb-4">
            <div className="text-[28px] font-bold leading-tight tracking-tight text-gray-900 dark:text-white tabular-nums">
              {item.amount !== null ? `${won(Number(item.amount))}원` : '금액 정보 없음'}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="truncate">{place.trim() || item.item_name || '사용처 정보 없음'}</span>
              {item.raw_sms && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setShowRawSms((v) => !v); }}
                  className="shrink-0 inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-expanded={showRawSms}
                >
                  원문
                  <IconChevronDown size={13} className={`transition-transform ${showRawSms ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {item.amount_before_tax !== null && item.amount_before_tax !== item.amount && (
              <div className="mt-0.5 text-xs text-gray-400">세전 {won(Number(item.amount_before_tax))}원</div>
            )}
            {showRawSms && (
              <div className="mt-2 rounded-xl bg-gray-50 dark:bg-gray-800 p-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-all">
                {item.raw_sms}
              </div>
            )}
          </div>

          <div className="space-y-3 px-5 pb-4">
            {/* 거래 유형 */}
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="radiogroup" aria-label="거래 유형">
              {TYPES.map(({ key, label, active }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={type === key}
                  onClick={(e) => { e.stopPropagation(); setType(key); }}
                  className={`rounded-lg py-2 text-sm font-semibold transition ${
                    type === key ? active : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="결제수단">
                <div className="relative">
                  <select
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    className={`${inputCls} appearance-none pr-8`}
                  >
                    <option value="">{assetsLoaded ? item.sender || '선택' : '불러오는 중…'}</option>
                    {assets.length > 0 && (
                      <optgroup label="자산">
                        {assets.map((a) => <option key={a.asset_name} value={a.asset_name}>{a.asset_name}</option>)}
                      </optgroup>
                    )}
                    {debts.length > 0 && (
                      <optgroup label="부채">
                        {debts.map((a) => <option key={a.asset_name} value={a.asset_name}>{a.asset_name}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <IconChevronDown size={16} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </Field>
              <Field label="금액">
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={Number.isFinite(amount) ? amount : 0}
                    onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
                    className={`${inputCls} pr-8 font-semibold tabular-nums`}
                    placeholder="0"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                </div>
              </Field>
            </div>

            <Field label="사용처">
              <input
                type="text"
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                className={inputCls}
                placeholder="어디에서 썼나요"
              />
            </Field>

            <Field label="메모">
              <textarea
                ref={noteRef}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${inputCls} resize-none leading-relaxed`}
                placeholder="메모 추가 (예: 팀 점심, 선물)"
              />
            </Field>
          </div>

          {/* 버튼 */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 pt-3 pb-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!type || loading}
              className="w-full rounded-xl bg-blue-600 py-3 text-[15px] font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800"
            >
              {loading ? '처리 중…' : '가계부에 등록'}
            </button>
            <div className="mt-1.5 grid grid-cols-3 text-sm font-medium">
              <button
                type="button"
                onClick={handleTempSave}
                disabled={loading}
                className="rounded-lg py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                임시저장
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="rounded-lg py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={loading}
                className="rounded-lg py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: translateY(12px) scale(0.98); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
