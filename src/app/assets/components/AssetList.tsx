'use client';

import { useState } from 'react';

export interface AssetItem {
  asset_name: string;
  balance: number;
  income: number;
  expense: number;
  transfer_out: number;
  transfer_in: number;
  is_debt: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  transaction_type: string;
  category: string;
  amount: number;
  memo: string;
  asset: string;
  transfer_asset: string | null;
}

export interface Category {
  id: string;
  name: string;
  type: 'asset' | 'debt';
  sort_order: number;
}

export interface CategoryMapping {
  id: string;
  asset_name: string;
  category_id: string | null;
}

interface AssetListProps {
  assets: AssetItem[];
  transactions: Transaction[];
  categories: Category[];
  mappings: CategoryMapping[];
  isLoading: boolean;
}

// 원형 프로그레스 링 컴포넌트
function CircularProgress({ percentage, color }: { percentage: number; color: string }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-10 h-10 flex-shrink-0">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-300"
        />
      </svg>
      <span 
        className="absolute inset-0 flex items-center justify-center text-[10px] font-medium"
        style={{ color }}
      >
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

export function AssetList({ assets, transactions, categories, mappings, isLoading }: AssetListProps) {
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}/${mm}/${dd}`;
  };

  // 자산만 필터링 (부채 제외, 잔액 양수)
  const assetItems = assets.filter(item => !item.is_debt && item.balance > 0);
  const totalAssets = assetItems.reduce((sum, item) => sum + item.balance, 0);

  // 카테고리별 자산 그룹화
  const assetCategories = categories.filter(c => c.type === 'asset').sort((a, b) => a.sort_order - b.sort_order);
  
  const getCategoryForAsset = (assetName: string): string | null => {
    const mapping = mappings.find(m => m.asset_name === assetName);
    if (!mapping?.category_id) return null;
    
    // 카테고리가 실제로 존재하는지 확인
    const categoryExists = categories.some(c => c.id === mapping.category_id);
    return categoryExists ? mapping.category_id : null;
  };

  const getAssetsInCategory = (categoryId: string | null) => {
    return assetItems.filter(item => getCategoryForAsset(item.asset_name) === categoryId);
  };

  // 미분류 자산
  const uncategorizedAssets = getAssetsInCategory(null);
  

  // 특정 자산의 거래내역 가져오기 (과거부터 현재까지)
  const getAssetTransactions = (assetName: string) => {
    const normalizedName = assetName.trim();
    return transactions
      .filter(tx => 
        tx.asset?.trim() === normalizedName || 
        tx.transfer_asset?.trim() === normalizedName
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const toggleExpand = (assetName: string) => {
    setExpandedAsset(expandedAsset === assetName ? null : assetName);
  };

  const toggleCategory = (categoryId: string) => {
    const newCollapsed = new Set(collapsedCategories);
    if (newCollapsed.has(categoryId)) {
      newCollapsed.delete(categoryId);
    } else {
      newCollapsed.add(categoryId);
    }
    setCollapsedCategories(newCollapsed);
  };

  // 자산 아이템 렌더링
  const renderAssetItem = (item: AssetItem) => {
    const percentage = totalAssets > 0 ? (item.balance / totalAssets) * 100 : 0;
    const isExpanded = expandedAsset === item.asset_name;
    const assetTx = isExpanded ? getAssetTransactions(item.asset_name) : [];

    return (
      <div key={item.asset_name}>
        <div
          className="px-4 py-1 border-b border-white dark:border-gray-600 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/30"
          onClick={() => toggleExpand(item.asset_name)}
        >
          <div className="flex items-center gap-3">
            <CircularProgress percentage={percentage} color="#2563EB" />
            <p 
              className="font-medium text-gray-900 dark:text-white flex-1 truncate"
              style={{ fontSize: '12px' }}
            >
              {item.asset_name}
            </p>
            <p 
              className="font-bold text-blue-700 dark:text-blue-300 flex-shrink-0"
              style={{ fontSize: '12px' }}
            >
              {formatAmount(item.balance)}원
            </p>
          </div>
        </div>
        
        {/* 거래내역 드롭다운 */}
        {isExpanded && (
          <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            {assetTx.length > 0 ? (
              <div className="max-h-60 overflow-y-auto">
                {assetTx.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="border-b border-gray-100 dark:border-gray-800 last:border-b-0 flex items-center justify-between"
                    style={{ padding: '2px 12px' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 dark:text-gray-500 text-xs">{formatDate(tx.date)}</span>
                        <span 
                          className={`rounded ${
                            tx.transaction_type === '수입' 
                              ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400' 
                              : tx.transaction_type === '지출'
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}
                          style={{ fontSize: '10px', padding: '1px 5px' }}
                        >
                          {tx.transaction_type}
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-xs truncate mt-0.5">
                        {tx.transaction_type === '자산이체' ? (
                          <>
                            {tx.asset?.trim() === item.asset_name.trim() 
                              ? `→ ${tx.transfer_asset}` 
                              : `← ${tx.asset}`}
                            {tx.memo && ` - ${tx.memo}`}
                          </>
                        ) : (
                          tx.memo || tx.category
                        )}
                      </p>
                    </div>
                    <p 
                      className={`font-medium flex-shrink-0 ml-2 text-xs ${
                        tx.transaction_type === '수입' 
                          ? 'text-blue-700 dark:text-blue-300' 
                          : tx.transaction_type === '지출'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-blue-700 dark:text-blue-300'
                      }`}
                    >
                      {tx.transaction_type === '수입' ? '+' : tx.transaction_type === '지출' ? '-' : ''}
                      {formatAmount(tx.amount)}원
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-3 text-gray-400 dark:text-gray-500 text-xs text-center">
                거래내역이 없습니다
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-4 py-1 border-b border-gray-200 dark:border-gray-700 last:border-b-0 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 ml-auto"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (assetItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p style={{ fontSize: '12px' }}>자산이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 카테고리별 그룹 */}
      {assetCategories.map((category) => {
        const categoryAssets = getAssetsInCategory(category.id);
        if (categoryAssets.length === 0) return null;

        const categoryTotal = categoryAssets.reduce((sum, item) => sum + item.balance, 0);
        const isCollapsed = collapsedCategories.has(category.id);

        return (
          <div key={category.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* 카테고리 헤더 */}
            <div
              className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 cursor-pointer flex items-center justify-between"
              onClick={() => toggleCategory(category.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isCollapsed ? '▶' : '▼'}
                </span>
                <span className="font-medium text-blue-700 dark:text-blue-300" style={{ fontSize: '12px' }}>
                  {category.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({categoryAssets.length}개)
                </span>
              </div>
              <span className="font-bold text-blue-700 dark:text-blue-300" style={{ fontSize: '12px' }}>
                {formatAmount(categoryTotal)}원
              </span>
            </div>

            {/* 카테고리 자산 목록 */}
            {!isCollapsed && categoryAssets.map(renderAssetItem)}
          </div>
        );
      })}

      {/* 미분류 자산 */}
      {uncategorizedAssets.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {assetCategories.length > 0 && (
            <div
              className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 cursor-pointer flex items-center justify-between"
              onClick={() => toggleCategory('uncategorized')}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {collapsedCategories.has('uncategorized') ? '▶' : '▼'}
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300" style={{ fontSize: '12px' }}>
                  미분류
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({uncategorizedAssets.length}개)
                </span>
              </div>
              <span className="font-bold text-blue-700 dark:text-blue-300" style={{ fontSize: '12px' }}>
                {formatAmount(uncategorizedAssets.reduce((sum, item) => sum + item.balance, 0))}원
              </span>
            </div>
          )}

          {!collapsedCategories.has('uncategorized') && uncategorizedAssets.map(renderAssetItem)}
        </div>
      )}
      
      {/* 합계 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-blue-200 dark:border-blue-700">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <p className="font-medium text-blue-700 dark:text-blue-300" style={{ fontSize: '12px' }}>
              자산 합계 ({assetItems.length}개)
            </p>
            <p className="font-bold text-blue-700 dark:text-blue-300" style={{ fontSize: '12px' }}>
              {formatAmount(totalAssets)}원
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
