'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
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
    memo: string;
    amount: number;
  }) => Promise<void>;
  onSkip: (id: string) => void;
  onDismiss: (id: string) => Promise<void>;
}

interface AssetBalance {
  asset_name: string;
  balance: number;
  is_debt: boolean;
}

const TYPE_CONFIG = [
  { key: 'income' as TransactionType, label: '수입', emoji: '💰', color: 'green' },
  { key: 'expense' as TransactionType, label: '지출', emoji: '💸', color: 'red' },
  { key: 'transfer' as TransactionType, label: '이체', emoji: '🔄', color: 'blue' },
];

export function PendingSmsPopup({ item, onConfirm, onTempSave, onSkip, onDismiss }: PendingSmsPopupProps) {
  // memo 초기값: 임시저장된 memo > item_name > ''
  const initialMemo = item.memo ?? item.item_name ?? '';
  const [type, setType] = useState<TransactionType | null>(item.transaction_type ?? null);
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [memo, setMemo] = useState<string>(initialMemo);
  const [amount, setAmount] = useState<number>(() => (item.amount ?? 0));
  const [loading, setLoading] = useState(false);
  const [showRawSms, setShowRawSms] = useState(false);

  // 자산/부채 목록 로딩
  const [assetList, setAssetList] = useState<AssetBalance[]>([]);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // 자산/부채 로드 (최초 1회)
  useEffect(() => {
    if (assetsLoaded) return;
    const load = async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_asset_balances', {
        p_user_id: user.id,
      });
      if (!error && data) {
        setAssetList(data);
      }
      setAssetsLoaded(true);
    };
    load();
  }, [assetsLoaded]);

  // 자산 / 부채 분리
  const assets = useMemo(() => assetList.filter((a) => !a.is_debt), [assetList]);
  const debts = useMemo(() => assetList.filter((a) => a.is_debt), [assetList]);

  // item 변경 시 초기화 (다른 아이템으로 전환될 때만)
  useEffect(() => {
    setType(item.transaction_type ?? null);
    // 임시저장된 memo가 있으면 그것을, 없으면 item_name 사용
    setMemo(item.memo ?? item.item_name ?? '');
    setAmount(item.amount ?? 0);
    setShowRawSms(false);
    setSelectedAsset('');
  }, [item.id]); // item.id 기준으로만 트리거 (같은 아이템이면 리셋 안 됨)

  // 자산 로드 후 sender 기반 자동 매칭
  useEffect(() => {
    if (!assetsLoaded || assetList.length === 0) return;
    if (selectedAsset) return;

    const sender = item.sender ?? '';
    const match = assetList.find(
      (a) => sender.includes(a.asset_name) || a.asset_name.includes(sender)
    );
    if (match) {
      setSelectedAsset(match.asset_name);
    }
  }, [assetsLoaded, assetList, item.id, item.sender]);

  // 금액 표시 텍스트
  const amountDisplay = useMemo(() => {
    if (item.amount === null && item.amount_before_tax === null) return null;
    const parts: string[] = [];
    if (item.amount !== null) {
      parts.push(new Intl.NumberFormat('ko-KR').format(item.amount) + '원');
    }
    if (item.amount_before_tax !== null && item.amount_before_tax !== item.amount) {
      parts.push('세전 ' + new Intl.NumberFormat('ko-KR').format(item.amount_before_tax) + '원');
    }
    return parts.join(' / ');
  }, [item.amount, item.amount_before_tax]);

  const senderDisplay = item.sender || '알 수 없는 발신자';

  const dateTimeDisplay = useMemo(() => {
    const parts: string[] = [];
    if (item.transaction_date) parts.push(item.transaction_date);
    if (item.transaction_time) parts.push(item.transaction_time.slice(0, 5));
    return parts.join(' ') || '';
  }, [item.transaction_date, item.transaction_time]);

  const handleSubmit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔵 [등록] 버튼 클릭됨, type:', type, 'amount:', amount);
    if (!type) {
      alert('거래 유형을 선택해주세요.');
      return;
    }
    const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    if (safeAmount <= 0) {
      alert('금액을 1원 이상 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(item.id, {
        transaction_type: type,
        category: item.category || '기타',
        asset: selectedAsset || item.sender || 'SMS',
        memo,
        amount: safeAmount,
      });
      console.log('✅ [등록] 완료');
    } catch (e) {
      console.error('❌ [등록] 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTempSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🟡 [임시저장] 버튼 클릭됨');
    setLoading(true);
    try {
      await onTempSave(item.id, {
        transaction_type: type,
        asset: selectedAsset || item.sender || 'SMS',
        memo,
        amount: Number.isFinite(amount) ? amount : 0,
      });
      console.log('✅ [임시저장] 완료');
    } catch (e) {
      console.error('❌ [임시저장] 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('⏭️ [나중에] 버튼 클릭됨');
    onSkip(item.id);
  };

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('🔴 [삭제] 버튼 클릭됨');
    if (!window.confirm('이 항목을 삭제하시겠습니까?')) return;
    setLoading(true);
    try {
      await onDismiss(item.id);
      console.log('✅ [삭제] 완료');
    } catch (e) {
      console.error('❌ [삭제] 오류:', e);
    } finally {
      setLoading(false);
    }
  };

  const getTypeButtonStyle = (key: TransactionType, color: string) => {
    const isActive = type === key;
    const colorMap: Record<string, string> = {
      green: isActive
        ? 'bg-green-50 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 ring-2 ring-green-300 dark:ring-green-700'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
      red: isActive
        ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 ring-2 ring-red-300 dark:ring-red-700'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
      blue: isActive
        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 ring-2 ring-blue-300 dark:ring-blue-700'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400',
    };
    return colorMap[color] ?? colorMap.blue;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ pointerEvents: 'auto' }}>
      {/* Backdrop — 배경 클릭 시 나중에 처리 */}
      <div
        className="absolute inset-0 bg-gray-500/70 dark:bg-gray-800/80 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); console.log('🟤 [배경] 클릭 → 나중에'); onSkip(item.id); }}
      />

      {/* Card — 카드 내부 클릭은 배경으로 전파되지 않음 */}
      <div
        className="relative mx-auto max-w-[400px] w-full px-4 animate-[popIn_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[85vh] overflow-y-auto">

          {/* ── 헤더: 발신자 + 날짜 ── */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <span className="text-lg">📩</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{senderDisplay}</span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{dateTimeDisplay}</span>
          </div>

          {/* ── 금액 대형 표시 ── */}
          <div className="px-5 pt-4">
            {amountDisplay ? (
              <div className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {amountDisplay}
              </div>
            ) : (
              <div className="text-lg font-semibold text-gray-400 dark:text-gray-500">
                금액 정보 없음
              </div>
            )}
          </div>

          {/* ── 항목명 / 계좌 ── */}
          <div className="px-5 pt-1 pb-3">
            {item.item_name && (
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {item.item_name}
              </div>
            )}
            {item.account_number && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                계좌 {item.account_number}
              </div>
            )}
            {!item.item_name && !item.account_number && (
              <div className="text-xs text-gray-400 dark:text-gray-500">상세 정보 없음</div>
            )}
          </div>

          {/* ── 원문 SMS 토글 ── */}
          <div className="px-5 pb-3">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowRawSms(!showRawSms); }}
              className="text-xs text-blue-500 dark:text-blue-400 hover:underline"
            >
              {showRawSms ? '원문 숨기기 ▲' : '원문 보기 ▼'}
            </button>
            {showRawSms && (
              <div className="mt-1.5 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap break-all border border-gray-100 dark:border-gray-700">
                {item.raw_sms}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800" />

          {/* ── 거래 유형 선택 ── */}
          <div className="px-5 pt-3 pb-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">거래 유형</div>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_CONFIG.map(({ key, label, emoji, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); console.log('거래유형 선택:', key); setType(key); }}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 ${getTypeButtonStyle(key, color)}`}
                >
                  <span className="mr-1">{emoji}</span>{label}
                </button>
              ))}
            </div>
          </div>

          {/* ── 결제수단 드롭다운 (자산/부채) ── */}
          <div className="px-5 pt-2 pb-2">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">결제수단</div>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 transition appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="">선택하세요</option>
              {assets.length > 0 && (
                <optgroup label="💰 자산">
                  {assets.map((a) => (
                    <option key={a.asset_name} value={a.asset_name}>
                      {a.asset_name}
                    </option>
                  ))}
                </optgroup>
              )}
              {debts.length > 0 && (
                <optgroup label="💳 부채">
                  {debts.map((a) => (
                    <option key={a.asset_name} value={a.asset_name}>
                      {a.asset_name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {!assetsLoaded && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">로딩 중...</div>
            )}
          </div>

          {/* ── 금액 + 메모 입력 ── */}
          <div className="px-5 pt-2 pb-3 grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">금액</label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  value={Number.isFinite(amount) ? amount : 0}
                  onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
                  className="w-full px-3 py-2 pr-8 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 transition"
                  placeholder="0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">메모</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 transition"
                placeholder="메모 입력"
              />
            </div>
          </div>

          {/* ── 하단 버튼 ── */}
          <div className="px-5 pb-4 pt-2 flex flex-col gap-2">
            {/* 1행: 임시저장 (전체 폭) */}
            <button
              type="button"
              onClick={handleTempSave}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-semibold border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors disabled:opacity-50"
            >
              💾 임시저장
            </button>
            {/* 2행: 나중에 / 삭제 / 등록 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                나중에
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 text-sm font-semibold border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50"
              >
                삭제
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!type || loading}
                className="flex-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 text-sm font-bold transition-colors shadow-lg shadow-blue-600/20 disabled:shadow-none"
              >
                {loading ? '처리 중...' : '등록하기'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes popIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
