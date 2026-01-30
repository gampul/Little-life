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
  type: 'income' | 'expense' | 'transfer';
  asset: string;
  category: string;
  description?: string;
}

const ASSET_OPTIONS = [
  '현금',
  '신한은행',
  '국민은행',
  '우리은행',
  '카카오뱅크',
  '토스뱅크',
  '신용카드',
  '체크카드',
];

const CATEGORY_OPTIONS: Record<string, string[]> = {
  income: ['급여', '부수입', '이자', '환급', '기타수입'],
  expense: ['식비', '교통', '쇼핑', '생활', '의료', '문화', '교육', '기타지출'],
  transfer: ['저축', '투자', '대출상환', '보험', '기타이체'],
};

export function TransactionForm({ isOpen, onClose, onSubmit }: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionData>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    type: 'expense',
    asset: '현금',
    category: '식비',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTypeChange = (type: 'income' | 'expense' | 'transfer') => {
    setFormData({
      ...formData,
      type,
      category: CATEGORY_OPTIONS[type][0],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.amount <= 0) {
      setError('금액을 입력해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // 폼 초기화
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        type: 'expense',
        asset: '현금',
        category: '식비',
        description: '',
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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="w-full max-w-[412px] bg-white dark:bg-gray-800 rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <p style={{ fontSize: '16px' }} className="font-bold text-gray-900 dark:text-white">
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
          {/* 타입 선택 */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2">
              {(['income', 'expense', 'transfer'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  style={{ fontSize: '14px' }}
                  className={`py-2 rounded-lg font-medium transition-colors ${
                    formData.type === type
                      ? type === 'income'
                        ? 'bg-green-600 text-white'
                        : type === 'expense'
                        ? 'bg-red-600 text-white'
                        : 'bg-orange-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type === 'income' ? '수입' : type === 'expense' ? '소비 지출' : '이체지출'}
                </button>
              ))}
            </div>
          </div>

          {/* 금액 */}
          <div className="mb-3">
            <label style={{ fontSize: '14px' }} className="text-gray-700 dark:text-gray-300 mb-1 block">
              금액
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                placeholder="0"
                style={{ fontSize: '16px' }}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400">원</span>
            </div>
          </div>

          {/* 날짜 */}
          <div className="mb-3">
            <label style={{ fontSize: '14px' }} className="text-gray-700 dark:text-gray-300 mb-1 block">
              날짜
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              style={{ fontSize: '16px' }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 자산 */}
          <div className="mb-3">
            <label style={{ fontSize: '14px' }} className="text-gray-700 dark:text-gray-300 mb-1 block">
              자산
            </label>
            <select
              value={formData.asset}
              onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
              style={{ fontSize: '16px' }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ASSET_OPTIONS.map((asset) => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>
          </div>

          {/* 카테고리 */}
          <div className="mb-3">
            <label style={{ fontSize: '14px' }} className="text-gray-700 dark:text-gray-300 mb-1 block">
              분류
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              style={{ fontSize: '16px' }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORY_OPTIONS[formData.type].map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 메모 */}
          <div className="mb-4">
            <label style={{ fontSize: '14px' }} className="text-gray-700 dark:text-gray-300 mb-1 block">
              메모 (선택)
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="메모를 입력하세요"
              style={{ fontSize: '16px' }}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p style={{ fontSize: '14px' }} className="text-red-500 mb-3">{error}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              style={{ fontSize: '16px' }}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ fontSize: '16px' }}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
