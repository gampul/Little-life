'use client';

import { useState } from 'react';

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
  onAssetFilter?: (asset: string | null) => void;
  filterAsset?: string | null;
}

export function TransactionList({ transactions, isLoading, onDelete, onAssetFilter, filterAsset: externalFilterAsset }: TransactionListProps) {
  const [internalFilterAsset, setInternalFilterAsset] = useState<string | null>(null);
  
  // 외부 필터가 있으면 외부 사용, 없으면 내부 사용
  const filterAsset = onAssetFilter ? externalFilterAsset : internalFilterAsset;
  
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };
  
  // 외부 필터가 있으면 이미 필터된 데이터가 넘어옴
  const filteredTransactions = onAssetFilter 
    ? transactions 
    : (filterAsset ? transactions.filter(tx => tx.asset === filterAsset || tx.transfer_asset === filterAsset) : transactions);
  
  const handleAssetClick = (asset: string) => {
    const newFilter = filterAsset === asset ? null : asset;
    
    if (onAssetFilter) {
      onAssetFilter(newFilter); // 외부로 전달 (서버 필터링)
    } else {
      setInternalFilterAsset(newFilter); // 내부 필터링
    }
  };
  
  const handleClearFilter = () => {
    if (onAssetFilter) {
      onAssetFilter(null);
    } else {
      setInternalFilterAsset(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear().toString().slice(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const getTypeStyle = (type: string, isTransfer: boolean) => {
    if (isTransfer || type === '자산이체') {
      return {
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        prefix: '',
      };
    }
    switch (type) {
      case '수입':
        return {
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          prefix: '',
        };
      case '지출':
        return {
          color: 'text-red-600 dark:text-red-400',
          bg: 'bg-red-50 dark:bg-red-900/20',
          prefix: '',
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

  if (filteredTransactions.length === 0 && !filterAsset) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-gray-500">
        <p className="text-base">거래 내역이 없습니다</p>
        <p className="text-sm mt-1">CSV 파일을 업로드하거나 거래를 추가해보세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 필터 표시 */}
      {filterAsset && (
        <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg mb-2">
          <span className="text-sm text-blue-700 dark:text-blue-300">
            🔍 <strong>{filterAsset}</strong> 거래 ({filteredTransactions.length}건)
          </span>
          <button
            onClick={handleClearFilter}
            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-700"
          >
            필터 해제
          </button>
        </div>
      )}
      
      {filteredTransactions.map((tx) => {
        const style = getTypeStyle(tx.transaction_type, tx.is_transfer);
        
        return (
          <div
            key={tx.id}
            className="p-3 border-b border-white dark:border-gray-600"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(tx.date)}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white truncate" style={{ fontSize: '12px' }}>
                    {tx.category}
                  </span>
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
                  {tx.memo && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[80px]">
                      {tx.memo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    <span 
                      onClick={() => handleAssetClick(tx.asset)}
                      className={`cursor-pointer hover:underline ${filterAsset === tx.asset ? 'text-blue-500 font-medium' : ''}`}
                    >
                      {tx.asset}
                    </span>
                    {tx.is_transfer && tx.transfer_asset && (
                      <span style={{ fontSize: '10px' }}>
                        {' → '}
                        <span 
                          onClick={() => handleAssetClick(tx.transfer_asset!)}
                          className={`cursor-pointer hover:underline ${filterAsset === tx.transfer_asset ? 'text-blue-500 font-medium' : ''}`}
                        >
                          {tx.transfer_asset}
                        </span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${style.color}`} style={{ fontSize: '13px' }}>
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
