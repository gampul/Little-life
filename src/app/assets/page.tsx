'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { getSupabase } from '../../lib/supabase';

interface AssetBalance {
  asset_id: string;
  asset_name: string;
  asset_type: string;
  balance: number;
}

interface AssetSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  bank: '은행',
  card: '카드',
  cash: '현금',
  loan: '대출',
  other: '기타',
};

const ASSET_TYPE_COLORS: Record<string, string> = {
  bank: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  card: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  cash: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  loan: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
};

export default function AssetsPage() {
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assets, setAssets] = useState<AssetBalance[]>([]);
  const [summary, setSummary] = useState<AssetSummary>({
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
  });

  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user?.id ?? null);
      }
    });
  }, [supabase]);

  const loadAssetBalances = useCallback(async () => {
    if (!supabase || !userId) return;
    
    try {
      const { data, error } = await supabase.rpc('get_user_asset_balances', {
        p_user_id: userId,
      });
      
      if (error) {
        console.log('자산 로드 오류:', error.message);
        setAssets([]);
      } else if (data) {
        setAssets(data);
        
        // Calculate summary
        let totalAssets = 0;
        let totalLiabilities = 0;
        
        data.forEach((asset: AssetBalance) => {
          if (asset.asset_type === 'loan') {
            totalLiabilities += Math.abs(asset.balance);
          } else {
            totalAssets += asset.balance;
          }
        });
        
        setSummary({
          totalAssets,
          totalLiabilities,
          netWorth: totalAssets - totalLiabilities,
        });
      }
    } catch (err) {
      console.log('자산 로드:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) {
      loadAssetBalances();
    }
  }, [userId, loadAssetBalances]);

  const formatAmount = (amount: number) => {
    const absAmount = Math.abs(amount);
    if (absAmount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억`;
    } else if (absAmount >= 10000) {
      return `${(amount / 10000).toFixed(0)}만`;
    }
    return amount.toLocaleString();
  };

  const groupedAssets = assets.reduce((acc, asset) => {
    const type = asset.asset_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(asset);
    return acc;
  }, {} as Record<string, AssetBalance[]>);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        <GlobalNav />
        
        <main className="max-w-[412px] mx-auto px-4 pt-20">
          {/* Summary Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm mb-4">
            <h2 style={{ fontSize: '14px' }} className="text-gray-500 dark:text-gray-400 mb-3">
              자산 현황
            </h2>
            
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <p style={{ fontSize: '12px' }} className="text-gray-500 dark:text-gray-400">
                    순자산
                  </p>
                  <p 
                    style={{ fontSize: '28px' }} 
                    className={`font-bold ${
                      summary.netWorth >= 0 
                        ? 'text-gray-900 dark:text-white' 
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {summary.netWorth >= 0 ? '+' : ''}{formatAmount(summary.netWorth)}원
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                    <p style={{ fontSize: '12px' }} className="text-blue-600 dark:text-blue-400">
                      총 자산
                    </p>
                    <p style={{ fontSize: '18px' }} className="font-semibold text-blue-700 dark:text-blue-300">
                      {formatAmount(summary.totalAssets)}원
                    </p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                    <p style={{ fontSize: '12px' }} className="text-red-600 dark:text-red-400">
                      총 부채
                    </p>
                    <p style={{ fontSize: '18px' }} className="font-semibold text-red-700 dark:text-red-300">
                      {formatAmount(summary.totalLiabilities)}원
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Asset List by Type */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse bg-white dark:bg-gray-800 rounded-xl p-4">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <p style={{ fontSize: '48px' }} className="mb-3">💰</p>
              <p style={{ fontSize: '16px' }} className="text-gray-500 dark:text-gray-400 mb-2">
                등록된 자산이 없습니다
              </p>
              <p style={{ fontSize: '14px' }} className="text-gray-400 dark:text-gray-500">
                거래를 추가하면 자산이 자동으로 생성됩니다
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedAssets).map(([type, typeAssets]) => (
                <div key={type} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <span 
                      style={{ fontSize: '12px' }}
                      className={`px-2 py-1 rounded-full ${ASSET_TYPE_COLORS[type] || ASSET_TYPE_COLORS.other}`}
                    >
                      {ASSET_TYPE_LABELS[type] || type}
                    </span>
                  </div>
                  
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {typeAssets.map((asset) => (
                      <div 
                        key={asset.asset_id} 
                        className="px-4 py-3 flex items-center justify-between"
                      >
                        <p 
                          style={{ fontSize: '14px' }} 
                          className="text-gray-800 dark:text-gray-200 truncate flex-1 mr-3"
                        >
                          {asset.asset_name}
                        </p>
                        <p 
                          style={{ fontSize: '14px' }} 
                          className={`font-medium whitespace-nowrap ${
                            asset.balance >= 0 
                              ? 'text-gray-900 dark:text-white' 
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {asset.balance >= 0 ? '' : '-'}{formatAmount(Math.abs(asset.balance))}원
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Info Notice */}
          {assets.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p style={{ fontSize: '12px' }} className="text-amber-700 dark:text-amber-300">
                자산 잔액은 거래 내역을 기반으로 자동 계산됩니다.
                초기 잔액은 0으로 가정합니다.
              </p>
            </div>
          )}
        </main>
        
        <FooterNav />
      </div>
    </AuthGuard>
  );
}
