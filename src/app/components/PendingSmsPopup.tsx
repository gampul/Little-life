'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PendingTransaction, TransactionType } from '../../types/pending_transaction';

interface PendingSmsPopupProps {
  item: PendingTransaction;
  onConfirm: (id: string, updates: {
    transaction_type: TransactionType;
    category: string;
    memo: string;
    amount: number;
  }) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

const CATEGORY_OPTIONS = ['배당금', '급여', '식비', '교통', '쇼핑', '의료', '이체', '기타'];

export function PendingSmsPopup({ item, onConfirm, onDismiss }: PendingSmsPopupProps) {
  const [type, setType] = useState<TransactionType | null>(item.transaction_type ?? null);
  const [category, setCategory] = useState<string>(item.category ?? '');
  const [memo, setMemo] = useState<string>(item.item_name ?? '');
  const [amount, setAmount] = useState<number>(() => (item.amount ?? 0));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setType(item.transaction_type ?? null);
    setCategory(item.category ?? '');
    setMemo(item.item_name ?? '');
    setAmount(item.amount ?? 0);
  }, [item]);

  const headerSender = item.sender ?? '알 수 없음';
  const headerDate = item.transaction_date ?? '';
  const amountText = useMemo(() => {
    const aft = item.amount !== null ? new Intl.NumberFormat('ko-KR').format(item.amount) + '원 (세후)' : null;
    const bef = item.amount_before_tax !== null ? new Intl.NumberFormat('ko-KR').format(item.amount_before_tax) + '원 (세전)' : null;
    return [aft, bef].filter(Boolean).join(' / ');
  }, [item.amount, item.amount_before_tax]);

  const handleSubmit = async () => {
    if (!type) return;
    setLoading(true);
    try {
      await onConfirm(item.id, {
        transaction_type: type,
        category: category || '기타',
        memo,
        amount: Number.isFinite(amount) ? amount : 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await onDismiss(item.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[412px] w-full px-4 pb-6">
        <div className="rounded-t-2xl border border-b-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {headerSender}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{headerDate}</div>
          </div>

          {/* 금액 */}
          <div className="mt-2 text-lg font-bold text-gray-900 dark:text-white">
            {amountText || '금액 정보 없음'}
          </div>

          {/* 항목명 */}
          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            {item.item_name || item.account_number || '항목 정보 없음'}
          </div>

          {/* 거래 유형 선택 */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { key: 'income', label: '💰 수입' },
              { key: 'expense', label: '💸 지출' },
              { key: 'transfer', label: '🔄 이체' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setType(key as TransactionType)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  type === key
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 ring-2 ring-blue-300'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 카테고리 + 금액 + 메모 */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="col-span-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 outline-none"
            >
              <option value="">카테고리</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(e) => setAmount(parseInt(e.target.value || '0', 10))}
              className="col-span-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 outline-none"
              placeholder="금액"
            />
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="col-span-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 outline-none"
              placeholder="메모"
            />
          </div>

          {/* 하단 버튼 */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={handleDismiss}
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              무시
            </button>
            <button
              onClick={handleSubmit}
              disabled={!type || loading}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-colors"
            >
              등록하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

