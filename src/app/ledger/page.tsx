'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { getSupabase } from '../../lib/supabase';
import { Dashboard } from './components/Dashboard';
import { TransactionForm, TransactionData } from './components/TransactionForm';
import { TransactionList, Transaction } from './components/TransactionList';
import { TransactionFilters, FilterState } from './components/TransactionFilters';
import { ExcelUpload } from './components/ExcelUpload';

interface FinancialSummary {
  total_income: number;
  total_expense: number;
  net_asset: number;
}

export default function LedgerPage() {
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  
  // 재무 요약 데이터
  const [summary, setSummary] = useState<FinancialSummary>({
    total_income: 0,
    total_expense: 0,
    net_asset: 0,
  });
  
  // 거래 목록
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const PAGE_SIZE = 20;
  
  // 필터
  const [filters, setFilters] = useState<FilterState>({
    period: 'all',
    type: 'all',
  });

  // 사용자 인증 확인
  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('세션 오류:', error);
        setUserId(null);
        setAccessToken(null);
      } else if (session) {
        setUserId(session.user?.id ?? null);
        setAccessToken(session.access_token ?? null);
      }
    });
  }, [supabase]);

  // 재무 요약 로드
  const loadSummary = useCallback(async () => {
    if (!supabase || !userId) return;
    
    try {
      const { data, error } = await supabase.rpc('get_financial_summary', {
        p_user_id: userId,
      });
      
      if (error) {
        console.log('재무 요약 로드 오류:', error.message);
        console.log('Supabase에서 마이그레이션을 실행해주세요.');
      } else if (data && data.length > 0) {
        setSummary({
          total_income: data[0].total_income || 0,
          total_expense: data[0].total_expense || 0,
          net_asset: data[0].net_asset || 0,
        });
      }
    } catch (err) {
      console.log('요약 로드 오류:', err);
    }
  }, [supabase, userId]);

  // 필터 조건 생성 함수
  const getFilterConditions = useCallback(() => {
    let startDate: Date | null = null;
    
    if (filters.period !== 'all') {
      const now = new Date();
      switch (filters.period) {
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '1month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3months':
          startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case '1year':
          startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
      }
    }
    
    // 타입 매핑
    let typeFilter: string | null = null;
    if (filters.type !== 'all') {
      const typeMap: Record<string, string> = {
        'income': '수입',
        'expense': '지출',
        'transfer': '자산이체',
      };
      typeFilter = typeMap[filters.type] || null;
    }
    
    return { startDate, type: typeFilter };
  }, [filters]);

  // 거래 목록 로드 (초기 로드)
  const loadTransactions = useCallback(async () => {
    if (!supabase || !userId) return;
    
    try {
      const { startDate, type } = getFilterConditions();
      
      // 먼저 총 개수 조회
      let countQuery = supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (startDate) {
        countQuery = countQuery.gte('date', startDate.toISOString());
      }
      if (type) {
        countQuery = countQuery.eq('transaction_type', type);
      }
      
      const { count } = await countQuery;
      setTotalCount(count || 0);
      
      // 첫 페이지 데이터 조회
      let dataQuery = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      
      if (startDate) {
        dataQuery = dataQuery.gte('date', startDate.toISOString());
      }
      if (type) {
        dataQuery = dataQuery.eq('transaction_type', type);
      }
      
      const { data, error } = await dataQuery;
      
      if (error) {
        console.log('거래 로드: 테이블이 없거나 오류 발생');
        setTransactions([]);
        setHasMore(false);
      } else {
        setTransactions(data || []);
        setHasMore((data?.length || 0) < (count || 0));
      }
    } catch (err) {
      console.log('거래 로드:', err);
      setTransactions([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId, getFilterConditions]);

  // 더 불러오기
  const loadMoreTransactions = useCallback(async () => {
    if (!supabase || !userId || isLoadingMore) return;
    
    setIsLoadingMore(true);
    try {
      const { startDate, type } = getFilterConditions();
      const offset = transactions.length;
      
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      
      if (startDate) {
        query = query.gte('date', startDate.toISOString());
      }
      if (type) {
        query = query.eq('transaction_type', type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.log('추가 로드 오류');
      } else if (data) {
        setTransactions(prev => [...prev, ...data]);
        setHasMore(transactions.length + data.length < totalCount);
      }
    } catch (err) {
      console.log('추가 로드:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [supabase, userId, getFilterConditions, transactions.length, totalCount, isLoadingMore]);

  // 데이터 로드
  useEffect(() => {
    if (userId) {
      loadSummary();
      loadTransactions();
    }
  }, [userId, loadSummary, loadTransactions]);

  // 거래 추가
  const handleAddTransaction = async (data: TransactionData) => {
    if (!supabase || !userId) {
      throw new Error('로그인이 필요합니다');
    }
    
    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      date: new Date(data.date).toISOString(),
      amount: data.amount,
      transaction_type: data.transaction_type,
      is_transfer: data.is_transfer,
      asset: data.asset,
      transfer_asset: data.transfer_asset || null,
      category: data.category,
      sub_category: data.sub_category || null,
      memo: data.memo || null,
      currency: 'KRW',
      source: 'app',
    });
    
    if (error) {
      console.error('거래 추가 오류:', error);
      throw error;
    }
    
    // 데이터 새로고침
    await loadSummary();
    await loadTransactions();
  };

  // 거래 삭제
  const handleDeleteTransaction = async (id: string) => {
    if (!supabase || !userId) return;
    
    const confirmed = window.confirm('이 거래를 삭제하시겠습니까?');
    if (!confirmed) return;
    
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    
    if (error) {
      console.error('거래 삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다');
    } else {
      await loadSummary();
      await loadTransactions();
    }
  };

  // 업로드 완료 핸들러
  const handleUploadComplete = () => {
    loadSummary();
    loadTransactions();
    setShowUpload(false);
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        <GlobalNav />
        
        <main className="max-w-[412px] mx-auto px-4 pt-20">
          {/* 대시보드 (재무 요약) */}
          <Dashboard
            totalIncome={summary.total_income}
            totalExpense={summary.total_expense}
            netAsset={summary.net_asset}
            isLoading={isLoading}
          />
          
          {/* 버튼 그룹 */}
          <div className="my-4 flex gap-2">
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex-1 py-3 text-base bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
            >
              + 거래 추가
            </button>
            <button
              onClick={() => setShowUpload(!showUpload)}
              className={`px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                showUpload 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              CSV
            </button>
          </div>

          {/* CSV 업로드 영역 */}
          {showUpload && (
            <div className="mb-4">
              <ExcelUpload 
                onUploadComplete={handleUploadComplete}
                accessToken={accessToken}
              />
            </div>
          )}
          
          {/* 필터 */}
          <div className="mb-3">
            <TransactionFilters
              filters={filters}
              onChange={setFilters}
            />
          </div>

          {/* 거래 리스트 */}
          <div className="mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              거래 내역 ({transactions.length} / {totalCount}건)
            </p>
            <TransactionList
              transactions={transactions}
              isLoading={isLoading}
              onDelete={handleDeleteTransaction}
            />
            
            {/* 더 보기 버튼 */}
            {hasMore && !isLoading && (
              <button
                onClick={loadMoreTransactions}
                disabled={isLoadingMore}
                className="w-full mt-3 py-3 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                {isLoadingMore ? '불러오는 중...' : `더 보기 (${totalCount - transactions.length}건 남음)`}
              </button>
            )}
            
            {/* 전체 로드 완료 메시지 */}
            {!hasMore && transactions.length > 0 && transactions.length === totalCount && (
              <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-3">
                전체 {totalCount}건 로드 완료
              </p>
            )}
          </div>
        </main>
        
        <FooterNav />
      </div>
      
      {/* 거래 추가 폼 */}
      <TransactionForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleAddTransaction}
      />
    </AuthGuard>
  );
}
