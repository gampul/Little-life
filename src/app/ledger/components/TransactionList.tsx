'use client';

export interface Transaction {
  id: string;
  date: string;
  asset: string;
  category: string;
  sub_category?: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  currency: string;
  source: 'excel' | 'app';
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-green-600 dark:text-green-400';
      case 'expense':
        return 'text-red-600 dark:text-red-400';
      case 'transfer':
        return 'text-orange-600 dark:text-orange-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getTypePrefix = (type: string) => {
    return type === 'income' ? '+' : '-';
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 animate-pulse">
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
        <p style={{ fontSize: '16px' }}>거래 내역이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div
          key={tx.id}
          className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px' }} className="text-gray-500 dark:text-gray-400">
                  {formatDate(tx.date)}
                </span>
                <span style={{ fontSize: '14px' }} className="font-medium text-gray-900 dark:text-white">
                  {tx.category}
                </span>
                {tx.description && (
                  <span style={{ fontSize: '12px' }} className="text-gray-400 dark:text-gray-500 truncate max-w-[100px]">
                    {tx.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <p style={{ fontSize: '12px' }} className="text-gray-400 dark:text-gray-500">
                  {tx.asset}
                </p>
                {tx.source === 'excel' && (
                  <span style={{ fontSize: '10px' }} className="px-1 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded">
                    Excel
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: '16px' }} className={`font-bold ${getTypeColor(tx.type)}`}>
                {getTypePrefix(tx.type)}{formatAmount(tx.amount)}
              </span>
              {onDelete && (
                <button
                  onClick={() => onDelete(tx.id)}
                  className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
