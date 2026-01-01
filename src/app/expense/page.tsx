'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { getSupabase } from '../../lib/supabase';

interface ExpenseRecord {
  id?: string;
  date: string;
  account: string;
  category: string;
  sub_category: string;
  description: string;
  amount: number;
  transaction_type: '수입' | '지출' | '이체지출';
  memo: string;
  balance: number;
  currency: string;
  created_at?: string;
}

// CSV 업로드 파싱 함수
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export default function ExpensePage() {
  const supabase = getSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [records, setRecords] = useState<ExpenseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('list');
  
  const [formData, setFormData] = useState<ExpenseRecord>({
    date: selectedDate,
    account: '',
    category: '',
    sub_category: '',
    description: '',
    amount: 0,
    transaction_type: '지출',
    memo: '',
    balance: 0,
    currency: 'KRW',
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
      const pgError = error as { code?: string };
      if (pgError?.code === '42P01') {
        console.log('expense_records 테이블이 없습니다.');
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

  // CSV 파일 업로드
  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('CSV 파일 형식이 올바르지 않습니다.');
        return;
      }

      const records: ExpenseRecord[] = [];
      
      // 헤더 스킵하고 데이터 파싱
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 10) continue;

        const parseNumber = (str: string): number => {
          if (!str || str.trim() === '' || str === '-') return 0;
          const cleaned = str.replace(/,/g, '').replace(/"/g, '').trim();
          return parseFloat(cleaned) || 0;
        };

        // 날짜 파싱 (예: "2026. 01. 01 09:04:28" -> "2026-01-01")
        let dateStr = values[0];
        const originalDate = values[0];
        
        try {
          // "2026. 01. 01 09:04:28" 형식 처리
          if (originalDate && originalDate.includes('.')) {
            const dateTimeParts = originalDate.split(' ');
            const datePart = dateTimeParts[0]; // "2026. 01. 01"
            const dateParts = datePart.split('.').map(p => p.trim()).filter(p => p);
            
            if (dateParts.length >= 3) {
              const year = dateParts[0];
              const month = dateParts[1].padStart(2, '0');
              const day = dateParts[2].padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
              
              // 첫 번째 레코드만 로그
              if (i === 1) {
                console.log('🔍 날짜 변환:', originalDate, '→', dateStr);
              }
            }
          }
        } catch (e) {
          console.warn('날짜 파싱 실패:', originalDate, e);
        }

        // transaction_type 정규화 및 매핑
        let transactionType = values[6]?.replace(/"/g, '').trim() || '';
        
        // 기존 값을 새로운 3가지 타입으로 매핑
        const typeMapping: Record<string, '수입' | '지출' | '이체지출'> = {
          '입금': '수입',
          '이체입금': '수입',
          '출금': '지출',
          '이체출금': '이체지출',
        };
        
        let mappedType = typeMapping[transactionType];
        
        // 매핑되지 않은 경우 기본값 설정
        if (!mappedType) {
          const amount = parseNumber(values[5] || '0');
          mappedType = amount >= 0 ? '지출' : '수입';
        }

        const record: ExpenseRecord = {
          date: dateStr,
          account: values[1]?.replace(/"/g, '').trim() || '',
          category: values[2]?.replace(/"/g, '').trim() || '',
          sub_category: values[3]?.replace(/"/g, '').trim() || '',
          description: values[4]?.replace(/"/g, '').trim() || '',
          amount: parseNumber(values[5] || '0'),
          transaction_type: mappedType,
          memo: values[7]?.replace(/"/g, '').trim() || '',
          balance: parseNumber(values[8] || '0'),
          currency: values[9]?.replace(/"/g, '').trim() || 'KRW',
        };

        if (record.date && record.amount > 0) {
          records.push(record);
        }
      }

      if (records.length === 0) {
        alert('파싱된 데이터가 없습니다.');
        return;
      }

      console.log(`✅ 파싱 완료: ${records.length}개`);
      console.log('첫 번째 레코드:', records[0]);
      console.log('날짜 형식 확인:', records[0].date);

      // Supabase에 업로드
      try {
        setIsLoading(true);
        
        console.log(`📊 업로드 시작: ${records.length}개의 레코드`);
        console.log('샘플 데이터:', records[0]);
        
        // 기존 데이터 삭제
        console.log('🗑️ 기존 데이터 삭제 중...');
        const { error: deleteError } = await supabase
          .from('expense_records')
          .delete()
          .not('id', 'is', null);

        if (deleteError) {
          console.error('삭제 오류:', deleteError);
          throw deleteError;
        }
        console.log('✅ 기존 데이터 삭제 완료');

        // 배치 단위로 삽입 (500개씩)
        const batchSize = 500;
        let insertedCount = 0;
        
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          console.log(`📥 배치 ${Math.floor(i / batchSize) + 1} 삽입 중... (${batch.length}개)`);
          
          const { error: insertError } = await supabase
            .from('expense_records')
            .insert(batch);

          if (insertError) {
            console.error('삽입 오류:', insertError);
            console.error('오류 상세:', JSON.stringify(insertError, null, 2));
            console.error('문제 데이터 샘플:', batch[0]);
            throw insertError;
          }
          
          insertedCount += batch.length;
          console.log(`✅ 진행: ${insertedCount}/${records.length}`);
        }

        console.log(`✅ 업로드 완료: ${records.length}개`);
        alert(`✅ ${records.length}개의 레코드가 업로드되었습니다!`);
        setShowUploadModal(false);
        fetchMonthlyRecords();
      } catch (error: any) {
        console.error('❌ Upload error:', error);
        console.error('Error type:', typeof error);
        console.error('Error keys:', Object.keys(error || {}));
        console.error('Error message:', error?.message);
        console.error('Error code:', error?.code);
        console.error('Error details:', error?.details);
        console.error('Error hint:', error?.hint);
        
        let errorMessage = '업로드 중 오류가 발생했습니다.';
        if (error?.message) {
          errorMessage += `\n${error.message}`;
        }
        if (error?.hint) {
          errorMessage += `\n힌트: ${error.hint}`;
        }
        
        alert(`❌ ${errorMessage}`);
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    
    // 먼저 UTF-8로 시도
    reader.readAsText(file);
  };

  // 수입/지출 합계 계산
  const totalIncome = records
    .filter(r => r.transaction_type === '수입')
    .reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = records
    .filter(r => r.transaction_type === '지출' || r.transaction_type === '이체지출')
    .reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpense;

  // 카테고리별 합계
  const categoryTotals = records.reduce((acc, record) => {
    if (record.transaction_type === '지출' || record.transaction_type === '이체지출') {
      const key = record.category || '기타';
      acc[key] = (acc[key] || 0) + record.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  // 저장
  const handleSave = async () => {
    if (!formData.description || formData.amount <= 0) {
      alert('내용과 금액을 입력해주세요.');
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
        account: '',
        category: '',
        sub_category: '',
        description: '',
        amount: 0,
        transaction_type: '지출',
        memo: '',
        balance: 0,
        currency: 'KRW',
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

  // 월별로 그룹핑
  const recordsByMonth = records.reduce((acc, record) => {
    const recordDate = new Date(record.date);
    const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(record);
    return acc;
  }, {} as Record<string, ExpenseRecord[]>);

  const sortedMonths = Object.keys(recordsByMonth).sort((a, b) => b.localeCompare(a));

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

        {/* 뷰 모드 전환 & 액션 버튼 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            📋 목록
          </button>
          <button
            onClick={() => setViewMode('summary')}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'summary'
                ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            📊 요약
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            📤 CSV
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            ➕
          </button>
        </div>

        {/* 카테고리별 요약 뷰 */}
        {viewMode === 'summary' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">카테고리별 지출</h2>
            <div className="space-y-3">
              {Object.entries(categoryTotals)
                .sort(([, a], [, b]) => b - a)
                .map(([category, amount]) => {
                  const percentage = totalExpense > 0 ? (amount / totalExpense * 100).toFixed(1) : 0;
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{category}</span>
                        <span className="text-gray-900 dark:text-white font-semibold">
                          {amount.toLocaleString()}원 ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 거래 내역 - 월별 아코디언 */}
        {viewMode === 'list' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">거래 내역</h2>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-gray-500">로딩 중...</div>
            ) : sortedMonths.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p className="text-4xl mb-3">📝</p>
                <p>거래 내역이 없습니다.</p>
                <p className="text-sm mt-1">CSV 파일을 업로드하거나 직접 추가해보세요!</p>
              </div>
            ) : (
              <div className="space-y-2 p-2">
                {sortedMonths.map((monthKey) => {
                  const [year, month] = monthKey.split('-');
                  const monthRecords = recordsByMonth[monthKey];
                  const isExpanded = expandedMonth === monthKey;
                  
                  const monthIncome = monthRecords
                    .filter(r => r.transaction_type === '수입')
                    .reduce((sum, r) => sum + r.amount, 0);
                  const monthExpense = monthRecords
                    .filter(r => r.transaction_type === '지출' || r.transaction_type === '이체지출')
                    .reduce((sum, r) => sum + r.amount, 0);
                  
                  return (
                    <div key={monthKey} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedMonth(isExpanded ? null : monthKey)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {year}년 {parseInt(month)}월
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({monthRecords.length}건)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-xs text-right">
                            <div className="text-blue-600 dark:text-blue-400">+{monthIncome.toLocaleString()}</div>
                            <div className="text-red-500 dark:text-red-400">-{monthExpense.toLocaleString()}</div>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {monthRecords.map((record) => (
                            <div 
                              key={record.id} 
                              className="flex items-start justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(record.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
                                  </span>
                                  {record.category && (
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                      {record.category}
                                    </span>
                                  )}
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {record.description || record.sub_category || '내용 없음'}
                                </p>
                                {record.memo && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{record.memo}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-3">
                                <span className={`font-semibold text-sm whitespace-nowrap ${
                                  record.transaction_type === '수입'
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-red-500 dark:text-red-400'
                                }`}>
                                  {record.transaction_type === '수입' ? '+' : '-'}
                                  {record.amount.toLocaleString()}
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
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* CSV 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowUploadModal(false)}>
          <div 
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl p-6 m-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">CSV 파일 업로드</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              은행 거래내역 CSV 파일을 업로드하면 자동으로 데이터가 등록됩니다.
            </p>
            <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ 기존 데이터가 모두 삭제되고 새 데이터로 대체됩니다.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="w-full mb-4 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
            />
            <button
              onClick={() => setShowUploadModal(false)}
              className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div 
            className="w-full max-w-[480px] bg-white dark:bg-gray-800 rounded-t-3xl p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">거래 추가</h2>

            {/* 거래 유형 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">거래 유형</label>
              <div className="grid grid-cols-4 gap-2">
                {['수입', '지출', '이체지출'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData(prev => ({ ...prev, transaction_type: type as any }))}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      formData.transaction_type === type
                        ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* 금액 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">금액</label>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={e => setFormData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full text-2xl font-bold text-center py-3 border-b-2 border-gray-300 dark:border-gray-600 bg-transparent focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-white"
              />
            </div>

            {/* 내용 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">내용</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="거래 내용을 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 카테고리 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">카테고리</label>
              <input
                type="text"
                value={formData.category}
                onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="예: 식비, 교통비 등"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 메모 */}
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
