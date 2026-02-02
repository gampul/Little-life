'use client';

interface AssetSummaryProps {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  isLoading: boolean;
}

export function AssetSummary({
  totalAssets,
  totalLiabilities,
  netWorth,
  isLoading,
}: AssetSummaryProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-3 animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12 mb-2"></div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 자산 / 부채 / 순자산 - 3열 병렬 배치 */}
      <div className="grid grid-cols-3 gap-2">
        {/* 총자산 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">총자산</p>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400 break-all">
            {formatAmount(totalAssets)}
          </p>
        </div>

        {/* 총부채 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">총부채</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400 break-all">
            {formatAmount(totalLiabilities)}
          </p>
        </div>

        {/* 순자산 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-3">
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">순자산</p>
          <p className="text-sm font-bold text-gray-900 dark:text-white break-all">
            {formatAmount(netWorth)}
          </p>
        </div>
      </div>

    </div>
  );
}
