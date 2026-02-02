'use client';

export interface Transaction {
  id: string;
  date: string;
  asset: string;
  category: string;
  sub_category?: string;
  transaction_type: '수입' | '지출' | '자산이체';
  is_transfer: boolean;
  transfer_asset?: string;
  amount: number;
  memo?: string;
  currency: string;
  source: 'csv' | 'app';
  import_batch_id?: string;
  created_at: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  isLoading: boolean;
  onDelete?: (id: string) => void;
}

export function TransactionList({ transactions, isLoading, onDelete }: TransactionListProps) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const getTypeStyle = (type: string, isTransfer: boolean) => {
    if (isTransfer || type === '자산이체') {
      return {
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        prefix: '↔',
      };
    }
    switch (type) {
      case '수입':
        return {
          color: 'text-green-600 dark:text-green-400',
          bg: 'bg-green-50 dark:bg-green-900/20',
          prefix: '+',
        };
      case '지출':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/20',
          prefix: '-',
        };
      default:
        return {
          color: 'text-gray-600 dark:text-gray-400',
          bg: 'bg-gray-50 dark:bg-gray-900/20',
          prefix: '',
        };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-3 animate-pulse">
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <p className="text-base">거래 내역이 없습니다</p>
        <p className="text-sm mt-1">CSV 파일을 업로드하거나 거래를 추가해보세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const style = getTypeStyle(tx.transaction_type, tx.is_transfer);
        
        return (
          <div
            key={tx.id}
            className={`bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 ${
              tx.is_transfer ? 'border-l-4 border-l-blue-400' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(tx.date)}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {tx.category}
                  </span>
                  {tx.memo && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[80px]">
                      {tx.memo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {tx.asset}
                    {tx.is_transfer && tx.transfer_asset && (
                      <span> → {tx.transfer_asset}</span>
                    )}
                  </p>
                  {tx.source === 'csv' && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                      CSV
                    </span>
                  )}
                  {tx.is_transfer && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                      이체
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-base font-bold ${style.color}`}>
                  {style.prefix}{formatAmount(tx.amount)}
                </span>
                {onDelete && (
                  <button
                    onClick={() => onDelete(tx.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
