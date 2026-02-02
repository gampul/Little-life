'use client';

import { useState } from 'react';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionData) => Promise<void>;
}

export interface TransactionData {
  date: string;
  amount: number;
  transaction_type: '수입' | '지출' | '자산이체';
  is_transfer: boolean;
  asset: string;
  transfer_asset?: string;
  category: string;
  sub_category?: string;
  memo?: string;
}

const ASSET_OPTIONS = [
  '현금',
  '우리은행',
  '신한은행',
  '국민은행',
  '카카오뱅크',
  '토스뱅크',
  '신용카드',
  '체크카드',
  'CMA',
  '증권계좌',
];

const CATEGORY_OPTIONS: Record<string, string[]> = {
  '수입': ['근로소득', '사업소득', '금융소득', '기타소득'],
  '지출': ['식비', '교통', '쇼핑', '생활', '의료', '문화', '교육', '주거', '통신', '기타지출'],
  '자산이체': ['자산이체'],
};

export function TransactionForm({ isOpen, onClose, onSubmit }: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionData>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    transaction_type: '지출',
    is_transfer: false,
    asset: '현금',
    category: '식비',
    sub_category: '',
    memo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (type: '수입' | '지출' | '자산이체') => {
    const isTransfer = type === '자산이체';
    setFormData({
      ...formData,
      transaction_type: type,
      is_transfer: isTransfer,
      category: isTransfer ? '자산이체' : CATEGORY_OPTIONS[type][0],
      transfer_asset: isTransfer ? formData.transfer_asset : undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.amount <= 0) {
      setError('금액을 입력해주세요');
      return;
    }

    if (formData.transaction_type === '자산이체' && !formData.transfer_asset) {
      setError('이체 대상 자산을 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // 폼 초기화
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        transaction_type: '지출',
        is_transfer: false,
        asset: '현금',
        category: '식비',
        sub_category: '',
        memo: '',
      });
      onClose();
    } catch (err) {
      setError('저장 중 오류가 발생했습니다');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isTransfer = formData.transaction_type === '자산이체';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="w-full max-w-[412px] bg-white dark:bg-gray-800 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            거래 추가
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 거래 유형 선택 */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2">
              {(['수입', '지출', '자산이체'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    formData.transaction_type === type
                      ? type === '수입'
                        ? 'bg-green-600 text-white shadow-md'
                        : type === '지출'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 금액 */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              금액
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="flex-1 px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-base text-gray-500 dark:text-gray-400">원</span>
            </div>
          </div>

          {/* 날짜 */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              날짜
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 자산 */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              {isTransfer ? '출금 자산' : '자산'}
            </label>
            <select
              value={formData.asset}
              onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
              className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSET_OPTIONS.map((asset) => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>
          </div>

          {/* 이체 대상 자산 (자산이체일 때만) */}
          {isTransfer && (
            <div className="mb-3">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                입금 자산
              </label>
              <select
                value={formData.transfer_asset || ''}
                onChange={(e) => setFormData({ ...formData, transfer_asset: e.target.value })}
                className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {ASSET_OPTIONS.filter(a => a !== formData.asset).map((asset) => (
                  <option key={asset} value={asset}>{asset}</option>
                ))}
              </select>
            </div>
          )}

          {/* 분류 (자산이체가 아닐 때만) */}
          {!isTransfer && (
            <div className="mb-3">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                분류
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                {CATEGORY_OPTIONS[formData.transaction_type].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {/* 메모 */}
          <div className="mb-4">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              메모 (선택)
            </label>
            <input
              type="text"
              value={formData.memo || ''}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="메모를 입력하세요"
              className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 text-base bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
