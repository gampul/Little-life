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

interface Transaction {
  id: string;
  date: string;
  asset: string;
  category: string;
  description?: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer' | 'opening_balance';
}

interface AssetSummary {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

interface CanonicalNetAsset {
  total_income: number;
  total_expense: number;
  current_net_asset: number;
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
  
  // 정준 순자산 (Canonical Net Asset)
  const [canonicalNetAsset, setCanonicalNetAsset] = useState<CanonicalNetAsset | null>(null);
  
  // 드롭다운 상태
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [assetTransactions, setAssetTransactions] = useState<Record<string, Transaction[]>>({});
  const [loadingTransactions, setLoadingTransactions] = useState<string | null>(null);
  
  // 초기 잔액 설정 모달 상태
  const [editingAsset, setEditingAsset] = useState<AssetBalance | null>(null);
  const [realBalanceInput, setRealBalanceInput] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

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
      // Load asset balances
      const { data: balanceData, error: balanceError } = await supabase.rpc('get_user_asset_balances', {
        p_user_id: userId,
      });
      
      if (balanceError) {
        console.log('자산 로드 오류:', balanceError.message);
        setAssets([]);
      } else if (balanceData) {
        setAssets(balanceData);
      }
      
      // Load summary from server (no client calculation)
      const { data: summaryData, error: summaryError } = await supabase.rpc('get_user_asset_summary', {
        p_user_id: userId,
      });
      
      if (summaryError) {
        console.log('요약 로드 오류:', summaryError.message);
        // Fallback: calculate from balances if RPC doesn't exist
        if (balanceData) {
          let totalAssets = 0;
          let totalLiabilities = 0;
          balanceData.forEach((asset: AssetBalance) => {
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
      } else if (summaryData && summaryData.length > 0) {
        setSummary({
          totalAssets: summaryData[0].total_assets_excl_loan || 0,
          totalLiabilities: summaryData[0].total_liabilities_abs || 0,
          netWorth: summaryData[0].net_worth || 0,
        });
      }
      
      // 정준 재무 요약 로드 (SINGLE SOURCE OF TRUTH)
      const { data: financialData, error: financialError } = await supabase.rpc('get_financial_summary', {
        p_user_id: userId,
      });
      
      if (financialError) {
        console.log('재무 요약 로드 오류:', financialError.message);
        console.log('Supabase에서 lock_financial_summary.sql 마이그레이션을 실행해주세요.');
      } else if (financialData && financialData.length > 0) {
        setCanonicalNetAsset({
          total_income: financialData[0].total_income || 0,
          total_expense: financialData[0].total_expense || 0,
          current_net_asset: financialData[0].current_net_asset || 0,
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
    return amount.toLocaleString();
  };

  const groupedAssets = assets.reduce((acc, asset) => {
    const type = asset.asset_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(asset);
    return acc;
  }, {} as Record<string, AssetBalance[]>);

  // 자산 클릭 시 거래내역 로드
  const handleAssetClick = async (assetId: string) => {
    // 이미 펼쳐진 자산이면 접기
    if (expandedAssetId === assetId) {
      setExpandedAssetId(null);
      return;
    }
    
    setExpandedAssetId(assetId);
    
    // 이미 로드된 거래내역이 있으면 재사용
    if (assetTransactions[assetId]) {
      return;
    }
    
    // 거래내역 로드
    if (!supabase || !userId) return;
    
    setLoadingTransactions(assetId);
    try {
      const { data, error } = await supabase
        .from('ledger_transactions')
        .select('id, date, asset, category, description, amount, type')
        .eq('user_id', userId)
        .eq('asset_id', assetId)
        .order('date', { ascending: false });
      
      if (error) {
        console.log('거래내역 로드 오류:', error.message);
      } else {
        setAssetTransactions(prev => ({
          ...prev,
          [assetId]: data || []
        }));
      }
    } catch (err) {
      console.log('거래내역 로드:', err);
    } finally {
      setLoadingTransactions(null);
    }
  };

  // 거래내역 날짜 포맷 (연도 포함)
  const formatTxDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = String(date.getFullYear()).slice(-2);
    return `${year}.${date.getMonth() + 1}.${date.getDate()}`;
  };

  // 거래 유형 색상
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income': return 'text-green-600 dark:text-green-400';
      case 'expense': return 'text-red-600 dark:text-red-400';
      case 'transfer': return 'text-orange-600 dark:text-orange-400';
      case 'opening_balance': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  // 초기 잔액 설정 모달 열기
  const openBalanceEditor = (asset: AssetBalance, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAsset(asset);
    setRealBalanceInput(asset.balance.toString());
  };

  // 초기 잔액 저장
  const saveRealBalance = async () => {
    if (!supabase || !userId || !editingAsset) return;
    
    const realBalance = parseInt(realBalanceInput.replace(/,/g, ''), 10);
    if (isNaN(realBalance)) {
      alert('올바른 금액을 입력해주세요');
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('set_asset_real_balance', {
        p_user_id: userId,
        p_asset_id: editingAsset.asset_id,
        p_real_balance: realBalance,
      });
      
      if (error) {
        console.log('초기 잔액 설정 오류:', error.message);
        alert('저장 중 오류가 발생했습니다: ' + error.message);
      } else {
        // 데이터 새로고침
        await loadAssetBalances();
        // 거래내역 캐시 초기화 (초기잔액 추가됨)
        setAssetTransactions(prev => {
          const updated = { ...prev };
          delete updated[editingAsset.asset_id];
          return updated;
        });
        setEditingAsset(null);
      }
    } catch (err) {
      console.log('초기 잔액 설정:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        <GlobalNav />
        
        <main className="max-w-[412px] mx-auto px-4 pt-20">
          {/* Canonical Net Asset Card */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 shadow-lg mb-4 text-white">
            <h2 style={{ fontSize: '14px' }} className="text-emerald-100 mb-1">
              현재 순자산
            </h2>
            
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-10 bg-white/20 rounded w-2/3"></div>
              </div>
            ) : (
              <>
                <p 
                  style={{ fontSize: '32px' }} 
                  className="font-bold"
                >
                  {formatAmount(canonicalNetAsset?.current_net_asset || 0)}원
                </p>
                <p style={{ fontSize: '11px' }} className="text-emerald-100 mt-2">
                  수입 {formatAmount(canonicalNetAsset?.total_income || 0)}원 - 지출 {formatAmount(canonicalNetAsset?.total_expense || 0)}원
                </p>
              </>
            )}
          </div>

          {/* Asset Summary Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm mb-4">
            <h2 style={{ fontSize: '14px' }} className="text-gray-500 dark:text-gray-400 mb-3">
              자산 배분 현황
            </h2>
            
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                  <p style={{ fontSize: '12px' }} className="text-blue-600 dark:text-blue-400">
                    배분된 자산
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
                      <div key={asset.asset_id}>
                        {/* 자산 항목 (클릭 가능) */}
                        <div 
                          onClick={() => handleAssetClick(asset.asset_id)}
                          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <p 
                            style={{ fontSize: '14px' }} 
                            className="text-gray-800 dark:text-gray-200 truncate flex-1 mr-3"
                          >
                            {asset.asset_name}
                          </p>
                          <div className="flex items-center gap-2">
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
                            <button
                              onClick={(e) => openBalanceEditor(asset, e)}
                              className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              title="실제 잔액 설정"
                            >
                              ✎
                            </button>
                          </div>
                        </div>
                        
                        {/* 드롭다운 거래내역 */}
                        {expandedAssetId === asset.asset_id && (
                          <div className="bg-gray-50 dark:bg-gray-700/30 px-4 py-2 border-t border-gray-100 dark:border-gray-700">
                            {loadingTransactions === asset.asset_id ? (
                              <div className="py-3 text-center">
                                <p style={{ fontSize: '12px' }} className="text-gray-400 dark:text-gray-500">
                                  불러오는 중...
                                </p>
                              </div>
                            ) : assetTransactions[asset.asset_id]?.length === 0 ? (
                              <div className="py-3 text-center">
                                <p style={{ fontSize: '12px' }} className="text-gray-400 dark:text-gray-500">
                                  거래내역이 없습니다
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2 py-1">
                                {assetTransactions[asset.asset_id]?.map((tx) => (
                                  <div 
                                    key={tx.id} 
                                    className="flex items-center justify-between py-1.5"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <span style={{ fontSize: '12px' }} className="text-gray-400 dark:text-gray-500">
                                        {formatTxDate(tx.date)}
                                      </span>
                                      <span style={{ fontSize: '13px' }} className="text-gray-700 dark:text-gray-300">
                                        {tx.category}
                                      </span>
                                      {tx.description && (
                                        <span style={{ fontSize: '11px' }} className="text-gray-400 dark:text-gray-500 truncate max-w-[80px]">
                                          {tx.description}
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '13px' }} className={`font-medium ${getTypeColor(tx.type)}`}>
                                      {(tx.type === 'income' || tx.type === 'opening_balance') ? '+' : '-'}{formatAmount(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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
                ✎ 버튼을 눌러 실제 잔액을 설정하면 초기 잔액이 자동 조정됩니다.
              </p>
            </div>
          )}
        </main>
        
        <FooterNav />
      </div>

      {/* 실제 잔액 설정 모달 */}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm">
            <h3 style={{ fontSize: '16px' }} className="font-bold text-gray-900 dark:text-white mb-2">
              실제 잔액 설정
            </h3>
            <p style={{ fontSize: '13px' }} className="text-gray-500 dark:text-gray-400 mb-4">
              {editingAsset.asset_name}
            </p>
            
            <div className="mb-4">
              <label style={{ fontSize: '12px' }} className="block text-gray-600 dark:text-gray-400 mb-1">
                현재 실제 잔액 (원)
              </label>
              <input
                type="text"
                value={realBalanceInput}
                onChange={(e) => setRealBalanceInput(e.target.value.replace(/[^0-9-]/g, ''))}
                placeholder="예: 200000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                style={{ fontSize: '16px' }}
              />
              <p style={{ fontSize: '11px' }} className="text-gray-400 dark:text-gray-500 mt-1">
                시스템이 초기 잔액을 자동으로 계산하여 설정합니다
              </p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setEditingAsset(null)}
                disabled={isSaving}
                style={{ fontSize: '14px' }}
                className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={saveRealBalance}
                disabled={isSaving}
                style={{ fontSize: '14px' }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
