'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { getSupabase } from '../../lib/supabase';
import { LedgerSummary } from './components/LedgerSummary';
import { TransactionForm, TransactionData } from './components/TransactionForm';
import { TransactionList, Transaction } from './components/TransactionList';
import { TransactionFilters, FilterState } from './components/TransactionFilters';

interface LedgerSummaryData {
  total_income: number;
  total_expense: number;
  total_transfer: number;
  net_cash_position: number;
}

export default function LedgerPage() {
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // 요약 데이터
  const [summary, setSummary] = useState<LedgerSummaryData>({
    total_income: 0,
    total_expense: 0,
    total_transfer: 0,
    net_cash_position: 0,
  });
  
  // 거래 목록
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  
  // 필터
  const [filters, setFilters] = useState<FilterState>({
    period: 'all',
    type: 'all',
  });

  // 사용자 인증 확인
  useEffect(() => {
    if (!supabase) return;
    
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.error('인증 오류:', error);
        setUserId(null);
      } else {
        setUserId(data.user?.id ?? null);
      }
    });
  }, [supabase]);

  // 요약 데이터 로드
  const loadSummary = useCallback(async () => {
    if (!supabase || !userId) return;
    
    try {
      const { data, error } = await supabase.rpc('get_ledger_summary', {
        p_user_id: userId,
      });
      
      if (error) {
        console.error('요약 로드 오류:', error);
        // RPC가 없으면 직접 계산
        const { data: txData } = await supabase
          .from('ledger_transactions')
          .select('amount, type')
          .eq('user_id', userId);
        
        if (txData) {
          const total_income = txData
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
          const total_expense = txData
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);
          const total_transfer = txData
            .filter(t => t.type === 'transfer')
            .reduce((sum, t) => sum + t.amount, 0);
          
          setSummary({
            total_income,
            total_expense,
            total_transfer,
            net_cash_position: total_income - total_expense - total_transfer,
          });
        }
      } else if (data && data.length > 0) {
        setSummary({
          total_income: data[0].total_income || 0,
          total_expense: data[0].total_expense || 0,
          total_transfer: data[0].total_transfer || 0,
          net_cash_position: data[0].net_cash_position || 0,
        });
      }
    } catch (err) {
      console.error('요약 로드 오류:', err);
    }
  }, [supabase, userId]);

  // 거래 목록 로드
  const loadTransactions = useCallback(async () => {
    if (!supabase || !userId) return;
    
    try {
      let query = supabase
        .from('ledger_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(50);
      
      // 기간 필터
      if (filters.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        
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
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('date', startDate.toISOString());
      }
      
      // 타입 필터
      if (filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('거래 로드 오류:', error);
      } else {
        setTransactions(data || []);
      }
    } catch (err) {
      console.error('거래 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, userId, filters]);

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
    
    const { error } = await supabase.from('ledger_transactions').insert({
      user_id: userId,
      date: new Date(data.date).toISOString(),
      amount: data.amount,
      type: data.type,
      asset: data.asset,
      category: data.category,
      description: data.description || null,
      currency: 'KRW',
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
      .from('ledger_transactions')
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

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
        <GlobalNav />
        
        <main className="max-w-[412px] mx-auto px-4 pt-20">
          {/* 요약 카드 */}
          <LedgerSummary
            netCashPosition={summary.net_cash_position}
            totalIncome={summary.total_income}
            totalExpense={summary.total_expense}
            totalTransfer={summary.total_transfer}
            isLoading={isLoading}
          />
          
          {/* 거래 추가 버튼 */}
          <div className="my-4">
            <button
              onClick={() => setIsFormOpen(true)}
              style={{ fontSize: '16px' }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
            >
              + 거래 추가
            </button>
          </div>
          
          {/* 필터 */}
          <div className="mb-3">
            <TransactionFilters
              filters={filters}
              onChange={setFilters}
            />
          </div>
          
          {/* 거래 리스트 */}
          <div className="mb-4">
            <p style={{ fontSize: '14px' }} className="text-gray-500 dark:text-gray-400 mb-2">
              최근 거래
            </p>
            <TransactionList
              transactions={transactions}
              isLoading={isLoading}
              onDelete={handleDeleteTransaction}
            />
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
