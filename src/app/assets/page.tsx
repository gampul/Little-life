'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { getSupabase } from '../../lib/supabase';
import { AssetSummary } from './components/AssetSummary';
import { AssetList, AssetItem, Transaction, Category, CategoryMapping } from './components/AssetList';
import { DebtList } from './components/DebtList';
import { APP_HORIZONTAL_CONTAINER } from '../components/layout';

interface AssetSummaryData {
  total_assets: number;
  total_liabilities: number;
  net_worth: number;
  asset_count: number;
  liability_count: number;
}

export default function AssetsPage() {
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'assets' | 'debts'>('all');
  
  // 요약 데이터
  const [summary, setSummary] = useState<AssetSummaryData>({
    total_assets: 0,
    total_liabilities: 0,
    net_worth: 0,
    asset_count: 0,
    liability_count: 0,
  });
  
  // 자산/부채 목록
  const [assetItems, setAssetItems] = useState<AssetItem[]>([]);
  
  // 거래내역
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // 카테고리 데이터
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);

  // 사용자 인증 확인
  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('세션 오류:', error);
        setUserId(null);
      } else if (session) {
        setUserId(session.user?.id ?? null);
      }
    });
  }, [supabase]);

  // 자산/부채 데이터 로드
  const loadAssetData = useCallback(async () => {
    if (!supabase || !userId) return;
    
    setIsLoading(true);
    
    try {
      // 1. 요약 데이터 로드
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_asset_summary', {
        p_user_id: userId,
      });
      
      if (summaryError) {
        console.log('요약 로드 오류:', summaryError.message);
        console.log('Supabase에서 004_create_asset_functions.sql 마이그레이션을 실행해주세요.');
      } else if (summaryData && summaryData.length > 0) {
        setSummary({
          total_assets: summaryData[0].total_assets || 0,
          total_liabilities: summaryData[0].total_liabilities || 0,
          net_worth: summaryData[0].net_worth || 0,
          asset_count: summaryData[0].asset_count || 0,
          liability_count: summaryData[0].liability_count || 0,
        });
      }
      
      // 2. 자산별 잔액 로드
      const { data: balancesData, error: balancesError } = await supabase.rpc('get_asset_balances', {
        p_user_id: userId,
      });
      
      if (balancesError) {
        console.log('잔액 로드 오류:', balancesError.message);
      } else if (balancesData) {
        setAssetItems(balancesData);
      }
      
      // 3. 거래내역 로드 (전체 - 페이지네이션)
      let allTransactions: Transaction[] = [];
      let hasMore = true;
      let page = 0;
      const PAGE_SIZE = 1000;
      
      while (hasMore) {
        const { data: txData, error: txError } = await supabase
          .from('transactions')
          .select('id, date, transaction_type, category, amount, memo, asset, transfer_asset')
          .eq('user_id', userId)
          .order('date', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        
        if (txError) {
          console.log('거래내역 로드 오류:', txError.message);
          hasMore = false;
        } else if (txData && txData.length > 0) {
          allTransactions = [...allTransactions, ...txData];
          hasMore = txData.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      console.log('전체 거래내역 로드됨:', allTransactions.length, '개');
      setTransactions(allTransactions);
      
      // 4. 카테고리 로드
      const { data: catData, error: catError } = await supabase
        .from('asset_categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      
      if (catError) {
        console.log('카테고리 로드 오류:', catError.message);
      } else if (catData) {
        setCategories(catData);
      }
      
      // 5. 매핑 로드
      const { data: mapData, error: mapError } = await supabase
        .from('asset_category_mappings')
        .select('*')
        .eq('user_id', userId);
      
      if (mapError) {
        console.log('매핑 로드 오류:', mapError.message);
      } else if (mapData) {
        setMappings(mapData);
      }
    } catch (err) {
      console.log('데이터 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId]);

  // 데이터 로드
  useEffect(() => {
    if (userId) {
      loadAssetData();
    }
  }, [userId, loadAssetData]);


  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        <GlobalNav />
        
        <main className={`${APP_HORIZONTAL_CONTAINER} pt-4 sm:pt-6`}>
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              자산 현황
            </h1>
          </div>
          
          {/* 요약 대시보드 */}
          <AssetSummary
            totalAssets={summary.total_assets}
            totalLiabilities={summary.total_liabilities}
            netWorth={summary.net_worth}
            isLoading={isLoading}
          />
          
          {/* 탭 메뉴 */}
          <div className="flex gap-2 mt-6 mb-4">
            {[
              { key: 'all', label: '전체' },
              { key: 'assets', label: `자산 (${summary.asset_count})` },
              { key: 'debts', label: `부채 (${summary.liability_count})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                  activeTab === tab.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* 자산 목록 */}
          {(activeTab === 'all' || activeTab === 'assets') && (
            <div className="mb-6">
              {activeTab === 'all' && (
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="text-blue-500">📈</span> 자산
                </h2>
              )}
              <AssetList
                assets={assetItems}
                transactions={transactions}
                categories={categories}
                mappings={mappings}
                isLoading={isLoading}
              />
            </div>
          )}
          
          {/* 부채 목록 */}
          {(activeTab === 'all' || activeTab === 'debts') && (
            <div className="mb-6">
              {activeTab === 'all' && (
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="text-red-500">📉</span> 부채
                </h2>
              )}
              <DebtList
                assets={assetItems}
                transactions={transactions}
                categories={categories}
                mappings={mappings}
                isLoading={isLoading}
              />
            </div>
          )}
          
        </main>
        
        <FooterNav />
      </div>
    </AuthGuard>
  );
}
