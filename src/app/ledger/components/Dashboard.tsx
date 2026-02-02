'use client';

interface DashboardProps {
  totalIncome: number;
  totalExpense: number;
  netAsset: number;
  isLoading: boolean;
}

export function Dashboard({
  totalIncome,
  totalExpense,
  netAsset,
  isLoading,
}: DashboardProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {/* 순자산 스켈레톤 */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5">
          <div className="animate-pulse">
            <div className="h-4 bg-white/20 rounded w-24 mb-2"></div>
            <div className="h-10 bg-white/20 rounded w-48"></div>
          </div>
        </div>
        {/* 수입/지출 스켈레톤 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 순자산 변화 (메인 카드) */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
        <p className="text-emerald-100 text-sm mb-1">
          순자산 변화
        </p>
        <p className="text-3xl font-bold tracking-tight">
          {formatAmount(netAsset)}
          <span className="text-lg font-normal ml-1">원</span>
        </p>
        <p className="text-emerald-100 text-xs mt-2">
          = 총수입 - 총지출 (이체 제외)
        </p>
      </div>

      {/* 수입/지출 카드 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 총 수입 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
            총 수입
          </p>
          <p className="text-xl font-bold text-green-600 dark:text-green-400">
            +{formatAmount(totalIncome)}
          </p>
        </div>

        {/* 총 지출 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">
            총 지출
          </p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            -{formatAmount(totalExpense)}
          </p>
        </div>
      </div>

    </div>
  );
}
