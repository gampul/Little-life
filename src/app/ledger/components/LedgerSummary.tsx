'use client';

interface LedgerSummaryProps {
  netCashPosition: number;
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  isLoading: boolean;
}

export function LedgerSummary({
  netCashPosition,
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      {/* 현재 자산 */}
      <div className="mb-4">
        <p style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400 mb-1">
          현재 자산
        </p>
        <p 
          style={{ fontSize: '28px' }} 
          className={`font-bold ${netCashPosition >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}
        >
          {netCashPosition >= 0 ? '+' : ''}{formatAmount(netCashPosition)}원
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

        {/* 총 이체지출 */}
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
          <p style={{ fontSize: '12px' }} className="text-gray-500 dark:text-gray-400 mb-1">
            이체지출
          </p>
          <p style={{ fontSize: '14px' }} className="font-bold text-orange-600 dark:text-orange-400">
            -{formatAmount(totalTransfer)}
          </p>
        </div>
      </div>
    </div>
  );
}
