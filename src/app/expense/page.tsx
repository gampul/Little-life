'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { getSupabase } from '../../lib/supabase';

interface ExpenseRecord {
  id?: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  memo: string;
  created_at?: string;
}

const EXPENSE_CATEGORIES = [
  { emoji: '🍔', label: '식비' },
  { emoji: '🚌', label: '교통' },
  { emoji: '🏠', label: '주거' },
  { emoji: '⚡', label: '공과금' },
  { emoji: '🛒', label: '생활용품' },
  { emoji: '👕', label: '의류' },
  { emoji: '🏥', label: '의료' },
  { emoji: '📚', label: '교육' },
  { emoji: '🎮', label: '여가' },
  { emoji: '✈️', label: '여행' },
  { emoji: '🎁', label: '경조사' },
  { emoji: '📱', label: '통신' },
  { emoji: '💄', label: '미용' },
  { emoji: '🐕', label: '반려동물' },
  { emoji: '📦', label: '기타' },
];

const INCOME_CATEGORIES = [
  { emoji: '💰', label: '급여' },
  { emoji: '💵', label: '부수입' },
  { emoji: '🏦', label: '이자' },
  { emoji: '📈', label: '투자수익' },
  { emoji: '🎁', label: '용돈' },
  { emoji: '📦', label: '기타' },
];

export default function ExpensePage() {
  const supabase = getSupabase();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  
  const [formData, setFormData] = useState<ExpenseRecord>({
    date: selectedDate,
    type: 'expense',
    category: '',
    amount: 0,
    memo: '',
  });

  // 월별 데이터 가져오기
  const fetchMonthlyRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const startOfMonth = new Date(selectedDate);
      startOfMonth.setDate(1);
      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);

      const { data, error } = await supabase
        .from('expense_records')
        .select('*')
        .gte('date', startOfMonth.toISOString().split('T')[0])
        .lte('date', endOfMonth.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error: unknown) {
      // 테이블이 없는 경우 무시 (첫 사용시)
      const pgError = error as { code?: string };
      if (pgError?.code === '42P01') {
        console.log('expense_records 테이블이 없습니다. Supabase에서 테이블을 생성해주세요.');
      } else {
        console.error('Error fetching records:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [supabase, selectedDate]);

  useEffect(() => {
    fetchMonthlyRecords();
  }, [fetchMonthlyRecords]);

  // 월 이동
  const changeMonth = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate);
    if (direction === 'prev') {
      current.setMonth(current.getMonth() - 1);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  // 수입/지출 합계 계산
  const totalIncome = records
    .filter(r => r.type === 'income')
    .reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = records
    .filter(r => r.type === 'expense')
    .reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpense;

  // 저장
  const handleSave = async () => {
    if (!formData.category || formData.amount <= 0) {
      alert('카테고리와 금액을 입력해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('expense_records')
        .insert([{
          ...formData,
          date: selectedDate,
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setFormData({
        date: selectedDate,
        type: 'expense',
        category: '',
        amount: 0,
        memo: '',
      });
      fetchMonthlyRecords();
    } catch (error: unknown) {
      console.error('Error saving record:', error);
      const pgError = error as { code?: string };
      if (pgError?.code === '42P01') {
        alert('expense_records 테이블이 없습니다. Supabase에서 테이블을 먼저 생성해주세요.');
      } else {
        alert('저장 중 오류가 발생했습니다.');
      }
    }
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('expense_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchMonthlyRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  const currentMonth = new Date(selectedDate);
  const monthStr = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

  const categories = activeTab === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  // 날짜별로 그룹핑
  const groupedRecords = records.reduce((groups, record) => {
    const date = record.date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(record);
    return groups;
  }, {} as Record<string, ExpenseRecord[]>);

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-24">
      <GlobalNav />
      
      <div className="max-w-[480px] mx-auto px-4 py-4">
        {/* 월 선택 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={() => changeMonth('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{monthStr}</h1>
          <button 
            onClick={() => changeMonth('next')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 요약 카드 */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 mb-6 text-white shadow-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs opacity-80 mb-1">수입</p>
              <p className="text-lg font-bold">+{totalIncome.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">지출</p>
              <p className="text-lg font-bold">-{totalExpense.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs opacity-80 mb-1">잔액</p>
              <p className={`text-lg font-bold ${balance >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {balance >= 0 ? '+' : ''}{balance.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* 거래 내역 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">거래 내역</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full shadow-md flex items-center justify-center hover:scale-110 transition-transform"
              aria-label="거래 추가"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : Object.keys(groupedRecords).length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-4xl mb-3">📝</p>
              <p>이번 달 거래 내역이 없습니다.</p>
              <p className="text-sm mt-1">아래 + 버튼을 눌러 추가해보세요!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {Object.entries(groupedRecords)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dayRecords]) => (
                  <div key={date}>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                      </span>
                    </div>
                    {dayRecords.map((record) => {
                      const category = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find(c => c.label === record.category);
                      return (
                        <div 
                          key={record.id} 
                          className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{category?.emoji || '📦'}</span>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{record.category}</p>
                              {record.memo && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{record.memo}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${record.type === 'income' ? 'text-blue-600' : 'text-red-500'}`}>
                              {record.type === 'income' ? '+' : '-'}{record.amount.toLocaleString()}원
                            </span>
                            <button
                              onClick={() => record.id && handleDelete(record.id)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div 
            className="w-full max-w-[480px] bg-white dark:bg-gray-800 rounded-t-3xl p-6 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* 탭 */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => {
                  setActiveTab('expense');
                  setFormData(prev => ({ ...prev, type: 'expense', category: '' }));
                }}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  activeTab === 'expense' 
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                지출
              </button>
              <button
                onClick={() => {
                  setActiveTab('income');
                  setFormData(prev => ({ ...prev, type: 'income', category: '' }));
                }}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  activeTab === 'income' 
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' 
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                수입
              </button>
            </div>

            {/* 금액 입력 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">금액</label>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={e => setFormData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full text-3xl font-bold text-center py-4 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
              />
            </div>

            {/* 카테고리 선택 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">카테고리</label>
              <div className="grid grid-cols-5 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.label}
                    onClick={() => setFormData(prev => ({ ...prev, category: cat.label }))}
                    className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
                      formData.category === cat.label
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 ring-2 ring-indigo-500'
                        : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-xs mt-1 text-gray-600 dark:text-gray-400">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 입력 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">메모 (선택)</label>
              <input
                type="text"
                value={formData.memo}
                onChange={e => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                placeholder="메모를 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 저장 버튼 */}
            <button
              onClick={handleSave}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
            >
              저장하기
            </button>
          </div>
        </div>
      )}

      <FooterNav />

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

