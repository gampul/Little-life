'use client';

interface LedgerSummaryProps {
  // 정준 순자산 (Canonical)
  currentNetAsset: number;
  // 현금 흐름 (Cash Flow)
  cashFlowDelta: number;
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  isLoading: boolean;
}

export function LedgerSummary({
  currentNetAsset,
  cashFlowDelta,
  totalIncome,
  totalExpense,
  totalTransfer,
  isLoading,
}: LedgerSummaryProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4">
          <div className="animate-pulse">
            <div className="h-8 bg-white/20 rounded w-1/2"></div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 현재 순자산 (Canonical - Single Source of Truth) */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
        <p style={{ fontSize: '12px' }} className="text-emerald-100 mb-1">
          현재 순자산
        </p>
        <p style={{ fontSize: '28px' }} className="font-bold">
          {formatAmount(currentNetAsset)}원
        </p>
        <p style={{ fontSize: '11px' }} className="text-emerald-100 mt-1">
          수입 - 지출 (이체 제외)
        </p>
      </div>

      {/* 현금 흐름 및 세부내역 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        {/* 현금 흐름 */}
        <div className="mb-4">
          <p style={{ fontSize: '14px' }} className="text-gray-500 dark:text-gray-400 mb-1">
            현금 흐름 (이체 포함)
          </p>
          <p 
            style={{ fontSize: '22px' }} 
            className={`font-bold ${cashFlowDelta >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {cashFlowDelta >= 0 ? '+' : ''}{formatAmount(cashFlowDelta)}원
          </p>
        </div>

        {/* 수입/지출/이체 요약 */}
        <div className="grid grid-cols-3 gap-2">
          {/* 총 수입 */}
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
            <p style={{ fontSize: '12px' }} className="text-gray-500 dark:text-gray-400 mb-1">
              수입
            </p>
            <p style={{ fontSize: '14px' }} className="font-bold text-green-600 dark:text-green-400">
              +{formatAmount(totalIncome)}
            </p>
          </div>

          {/* 총 소비 지출 */}
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
            <p style={{ fontSize: '12px' }} className="text-gray-500 dark:text-gray-400 mb-1">
              소비 지출
            </p>
            <p style={{ fontSize: '14px' }} className="font-bold text-red-600 dark:text-red-400">
              -{formatAmount(totalExpense)}
            </p>
          </div>

          {/* 총 이체 */}
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
            <p style={{ fontSize: '12px' }} className="text-gray-500 dark:text-gray-400 mb-1">
              이체
            </p>
            <p style={{ fontSize: '14px' }} className="font-bold text-orange-600 dark:text-orange-400">
              -{formatAmount(totalTransfer)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
