'use client';

import { useState, useEffect, useCallback } from 'react';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { getSupabase } from '../../lib/supabase';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FinanceRecord {
  id?: string;
  period: string;
  owner: string;
  division: string;
  category: string;
  stock: string;
  qty: number;
  in_out: number;
  dividend: number;
  value: number;
  growth_rate: number;
  memo?: string;
}

interface PeriodSummary {
  period: string;
  totalDividend: number;
  totalValue: number;
}

interface OwnerSummary {
  period: string;
  [key: string]: string | number;
}

interface DivisionSummary {
  period: string;
  [key: string]: string | number;
}

// 숫자 포맷 함수
const formatNumber = (num: number): string => {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억`;
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(0)}만`;
  }
  return num.toLocaleString();
};

// 천 단위 콤마 포맷
const formatCurrency = (num: number): string => {
  return num.toLocaleString() + '원';
};

export default function AccountPage() {
  const supabase = getSupabase();
  const [records, setRecords] = useState<FinanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'owner' | 'division' | 'add'>('overview');
  const [message, setMessage] = useState('');

  // 신규 등록 폼 상태
  const [newRecord, setNewRecord] = useState<Omit<FinanceRecord, 'id'>>({
    period: '',
    owner: '',
    division: 'P',
    category: '',
    stock: '',
    qty: 0,
    in_out: 0,
    dividend: 0,
    value: 0,
    growth_rate: 0,
    memo: '',
  });

  // 기간 선택 아코디언 상태
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [isCustomPeriod, setIsCustomPeriod] = useState(false);
  const [customPeriodInput, setCustomPeriodInput] = useState('');

  // 소유자 선택 아코디언 상태
  const [isOwnerOpen, setIsOwnerOpen] = useState(false);
  const [isCustomOwner, setIsCustomOwner] = useState(false);
  const [customOwnerInput, setCustomOwnerInput] = useState('');

  // 기본 소유자 목록
  const defaultOwners = ['김희창', '민수진', '김사랑'];

  // 카테고리 선택 아코디언 상태
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // 기본 카테고리 목록 (순서 유지)
  const defaultCategories = ['S&P', 'DOW', 'REITs', 'CC', 'NASDAQ', 'ROBOT'];

  // 계좌유형 선택 아코디언 상태
  const [isDivisionOpen, setIsDivisionOpen] = useState(false);

  // 기본 계좌유형 목록
  const defaultDivisions = [
    { value: 'P', label: '개인연금' },
    { value: 'G', label: '일반' },
    { value: 'ISA', label: 'ISA' },
  ];

  // 계좌유형 선택 핸들러
  const handleDivisionSelect = (division: string) => {
    setNewRecord({ ...newRecord, division });
    setIsDivisionOpen(false);
  };

  // 선택된 계좌유형 라벨 가져오기
  const getSelectedDivisionLabel = () => {
    const found = defaultDivisions.find((d) => d.value === newRecord.division);
    return found ? `${found.value} (${found.label})` : '계좌유형을 선택하세요';
  };

  // 데이터 로드
  const loadRecords = useCallback(async () => {
    if (!supabase) {
      console.log('Supabase 클라이언트가 없습니다.');
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('finance_records 테이블 조회 시작...');
      const { data, error } = await supabase
        .from('finance_records')
        .select('*')
        .order('period', { ascending: true });

      if (error) {
        console.error('Supabase 에러:', error.message);
        console.error('에러 코드:', error.code);
        console.error('에러 상세:', error.details);
        console.error('에러 힌트:', error.hint);
        throw error;
      }
      
      console.log('조회된 데이터 수:', data?.length || 0);
      setRecords(data || []);
    } catch (error: unknown) {
      const err = error as { message?: string; code?: string };
      console.error('데이터 로드 실패:', err.message || error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 기간별 합계 데이터 계산
  const getPeriodSummary = (): PeriodSummary[] => {
    const summary: { [key: string]: { dividend: number; value: number } } = {};
    
    records.forEach((record) => {
      if (!summary[record.period]) {
        summary[record.period] = { dividend: 0, value: 0 };
      }
      summary[record.period].dividend += record.dividend || 0;
      summary[record.period].value += record.value || 0;
    });

    return Object.entries(summary)
      .map(([period, data]) => ({
        period: period.replace('2025. ', ''),
        totalDividend: data.dividend,
        totalValue: data.value,
      }))
      .sort((a, b) => {
        const monthA = parseInt(a.period);
        const monthB = parseInt(b.period);
        return monthA - monthB;
      });
  };

  // Owner별 기간별 합계 데이터
  const getOwnerSummary = (): OwnerSummary[] => {
    const owners = [...new Set(records.map((r) => r.owner))];
    const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
      const monthA = parseInt(a.replace('2025. ', ''));
      const monthB = parseInt(b.replace('2025. ', ''));
      return monthA - monthB;
    });

    return periods.map((period) => {
      const result: OwnerSummary = { period: period.replace('2025. ', '') };
      owners.forEach((owner) => {
        const ownerRecords = records.filter(
          (r) => r.period === period && r.owner === owner
        );
        result[owner] = ownerRecords.reduce((sum, r) => sum + (r.value || 0), 0);
      });
      return result;
    });
  };

  // Division별 기간별 합계 데이터
  const getDivisionSummary = (): DivisionSummary[] => {
    const divisions = [...new Set(records.map((r) => r.division))];
    const periods = [...new Set(records.map((r) => r.period))].sort((a, b) => {
      const monthA = parseInt(a.replace('2025. ', ''));
      const monthB = parseInt(b.replace('2025. ', ''));
      return monthA - monthB;
    });

    return periods.map((period) => {
      const result: DivisionSummary = { period: period.replace('2025. ', '') };
      divisions.forEach((division) => {
        const divRecords = records.filter(
          (r) => r.period === period && r.division === division
        );
        result[division] = divRecords.reduce((sum, r) => sum + (r.value || 0), 0);
      });
      return result;
    });
  };

  // 신규 레코드 저장
  const handleSaveRecord = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }

    if (!newRecord.period || !newRecord.owner || !newRecord.stock) {
      setMessage('❌ 기간, 소유자, 종목명은 필수입니다.');
      return;
    }

    try {
      const { error } = await supabase.from('finance_records').insert([newRecord]);

      if (error) throw error;

      setMessage('✅ 저장되었습니다!');
      setNewRecord({
        period: '',
        owner: '',
        division: 'P',
        category: '',
        stock: '',
        qty: 0,
        in_out: 0,
        dividend: 0,
        value: 0,
        growth_rate: 0,
        memo: '',
      });
      loadRecords();
      
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('저장 실패:', error);
      setMessage('❌ 저장에 실패했습니다.');
    }
  };

  // 고유 Owner 목록
  const uniqueOwners = [...new Set(records.map((r) => r.owner))];
  const uniqueDivisions = [...new Set(records.map((r) => r.division))];

  // 기간 목록 생성 (기존 + 미래 기간)
  const getAvailablePeriods = (): string[] => {
    // 기존 기간 추출
    const existingPeriods = [...new Set(records.map((r) => r.period))];
    
    // 현재 날짜 기준 다음 달까지 생성
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 0-indexed
    
    // 다음 2개월까지 미래 기간 생성
    const futurePeriods: string[] = [];
    for (let i = 0; i <= 2; i++) {
      let year = currentYear;
      let month = currentMonth + i;
      if (month > 12) {
        month = month - 12;
        year = year + 1;
      }
      const periodStr = `${year}. ${month}`;
      if (!existingPeriods.includes(periodStr)) {
        futurePeriods.push(periodStr);
      }
    }
    
    // 모든 기간을 합치고 정렬
    const allPeriods = [...existingPeriods, ...futurePeriods];
    
    return allPeriods.sort((a, b) => {
      const [yearA, monthA] = a.split('. ').map(Number);
      const [yearB, monthB] = b.split('. ').map(Number);
      if (yearA !== yearB) return yearA - yearB;
      return monthA - monthB;
    });
  };

  const availablePeriods = getAvailablePeriods();

  // 기간 선택 핸들러
  const handlePeriodSelect = (period: string) => {
    setNewRecord({ ...newRecord, period });
    setIsPeriodOpen(false);
    setIsCustomPeriod(false);
  };

  // 커스텀 기간 추가 핸들러
  const handleCustomPeriodAdd = () => {
    if (customPeriodInput.trim()) {
      setNewRecord({ ...newRecord, period: customPeriodInput.trim() });
      setCustomPeriodInput('');
      setIsCustomPeriod(false);
      setIsPeriodOpen(false);
    }
  };

  // 소유자 목록 생성 (기본값 + 데이터에서 추출된 소유자)
  const getAvailableOwners = (): string[] => {
    const recordOwners = [...new Set(records.map((r) => r.owner))];
    const allOwners = [...new Set([...defaultOwners, ...recordOwners])];
    return allOwners.sort();
  };

  const availableOwners = getAvailableOwners();

  // 소유자 선택 핸들러
  const handleOwnerSelect = (owner: string) => {
    setNewRecord({ ...newRecord, owner });
    setIsOwnerOpen(false);
    setIsCustomOwner(false);
  };

  // 커스텀 소유자 추가 핸들러
  const handleCustomOwnerAdd = () => {
    if (customOwnerInput.trim()) {
      setNewRecord({ ...newRecord, owner: customOwnerInput.trim() });
      setCustomOwnerInput('');
      setIsCustomOwner(false);
      setIsOwnerOpen(false);
    }
  };

  // 카테고리 목록 생성 (기본값 순서 유지 + 추가 카테고리)
  const getAvailableCategories = (): string[] => {
    const recordCategories = [...new Set(records.map((r) => r.category).filter(Boolean))];
    // 기본 카테고리 순서 유지, 추가 카테고리는 뒤에 정렬하여 추가
    const additionalCategories = recordCategories
      .filter((c) => !defaultCategories.includes(c))
      .sort();
    return [...defaultCategories, ...additionalCategories];
  };

  const availableCategories = getAvailableCategories();

  // 카테고리 선택 핸들러
  const handleCategorySelect = (category: string) => {
    setNewRecord({ ...newRecord, category });
    setIsCategoryOpen(false);
    setIsCustomCategory(false);
  };

  // 커스텀 카테고리 추가 핸들러
  const handleCustomCategoryAdd = () => {
    if (customCategoryInput.trim()) {
      setNewRecord({ ...newRecord, category: customCategoryInput.trim() });
      setCustomCategoryInput('');
      setIsCustomCategory(false);
      setIsCategoryOpen(false);
    }
  };

  // 색상 배열
  const ownerColors: { [key: string]: string } = {
    '김희창': '#3B82F6',
    '민수진': '#10B981',
    '김사랑': '#F59E0B',
  };

  const divisionColors: { [key: string]: string } = {
    'P': '#8B5CF6',
    'G': '#EC4899',
    'ISA': '#14B8A6',
  };

  const divisionLabels: { [key: string]: string } = {
    'P': '개인연금',
    'G': '일반',
    'ISA': 'ISA',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
      <GlobalNav />

      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="space-y-2">
          {/* 제목 */}
          <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
              💰 나만의 금융투자 포트폴리오
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              투자 현황을 기록하고 분석하세요.
            </p>
          </div>

          {/* 탭 메뉴 */}
          <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-2">
            <div className="flex gap-1">
              {[
                { key: 'overview', label: '📊 전체' },
                { key: 'owner', label: '👤 소유자별' },
                { key: 'division', label: '📁 계좌별' },
                { key: 'add', label: '➕ 등록' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`flex-1 px-2 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.key
                      ? 'bg-red-600 text-white'
                      : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 전체 현황 탭 */}
          {activeTab === 'overview' && (
            <>
              {/* 기간별 배당금 & 평가금액 그래프 */}
              <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  📈 기간별 평가금액 추이
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getPeriodSummary()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(v) => `${v}월`}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelFormatter={(label) => `${label}월`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="totalValue"
                        name="평가금액"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={{ fill: '#3B82F6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 기간별 배당금 그래프 */}
              <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  💵 기간별 배당금 추이
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getPeriodSummary()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(v) => `${v}월`}
                      />
                      <YAxis 
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelFormatter={(label) => `${label}월`}
                      />
                      <Legend />
                      <Bar
                        dataKey="totalDividend"
                        name="배당금"
                        fill="#10B981"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 총 자산 요약 */}
              <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  💎 최신 현황 요약
                </h2>
                {(() => {
                  const latestPeriod = getPeriodSummary().slice(-1)[0];
                  const prevPeriod = getPeriodSummary().slice(-2, -1)[0];
                  const valueChange = latestPeriod && prevPeriod 
                    ? ((latestPeriod.totalValue - prevPeriod.totalValue) / prevPeriod.totalValue * 100).toFixed(1)
                    : '0';
                  
                  return latestPeriod ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatNumber(latestPeriod.totalValue)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">총 평가금액</div>
                        <div className={`text-xs mt-1 ${parseFloat(valueChange) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {parseFloat(valueChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(valueChange))}%
                        </div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {formatNumber(latestPeriod.totalDividend)}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">월 배당금</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">데이터가 없습니다.</p>
                  );
                })()}
              </div>
            </>
          )}

          {/* 소유자별 탭 */}
          {activeTab === 'owner' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                👤 소유자별 평가금액 추이
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getOwnerSummary()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      tickFormatter={(v) => `${v}월`}
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                      labelFormatter={(label) => `${label}월`}
                    />
                    <Legend />
                    {uniqueOwners.map((owner) => (
                      <Bar
                        key={owner}
                        dataKey={owner}
                        name={owner}
                        fill={ownerColors[owner] || '#6B7280'}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 소유자별 최신 현황 */}
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">최신 현황</h3>
                {uniqueOwners.map((owner) => {
                  const ownerRecords = records.filter(
                    (r) => r.owner === owner && r.period === '2025. 12'
                  );
                  const total = ownerRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                  return (
                    <div
                      key={owner}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: ownerColors[owner] || '#6B7280' }}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {owner}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 계좌유형별 탭 */}
          {activeTab === 'division' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                📁 계좌유형별 평가금액 추이
              </h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getDivisionSummary()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fill: '#9CA3AF', fontSize: 12 }}
                      tickFormatter={(v) => `${v}월`}
                    />
                    <YAxis 
                      tick={{ fill: '#9CA3AF', fontSize: 10 }}
                      tickFormatter={(v) => formatNumber(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: 'none',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        divisionLabels[name] || name,
                      ]}
                      labelFormatter={(label) => `${label}월`}
                    />
                    <Legend formatter={(value) => divisionLabels[value] || value} />
                    {uniqueDivisions.map((division) => (
                      <Bar
                        key={division}
                        dataKey={division}
                        name={division}
                        fill={divisionColors[division] || '#6B7280'}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 계좌유형별 최신 현황 */}
              <div className="mt-6 space-y-3">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">최신 현황</h3>
                {uniqueDivisions.map((division) => {
                  const divRecords = records.filter(
                    (r) => r.division === division && r.period === '2025. 12'
                  );
                  const total = divRecords.reduce((sum, r) => sum + (r.value || 0), 0);
                  return (
                    <div
                      key={division}
                      className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: divisionColors[division] || '#6B7280' }}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {divisionLabels[division] || division}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 신규 등록 탭 */}
          {activeTab === 'add' && (
            <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                ➕ 신규 투자 기록 등록
              </h2>

              {message && (
                <div
                  className={`mb-4 p-3 rounded-lg text-sm ${
                    message.includes('✅')
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="space-y-4">
                {/* 기간 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📅 기간 *
                  </label>
                  
                  {/* 선택된 기간 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsPeriodOpen(!isPeriodOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={newRecord.period ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                      {newRecord.period || '기간을 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isPeriodOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isPeriodOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 기존 기간 목록 */}
                      {availablePeriods.map((period) => {
                        const isFuture = !records.some((r) => r.period === period);
                        return (
                          <button
                            key={period}
                            type="button"
                            onClick={() => handlePeriodSelect(period)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.period === period
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {newRecord.period === period && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {period}
                            </span>
                            {isFuture && (
                              <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                                신규
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomPeriod ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomPeriod(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 기간 직접 입력...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: 2026. 3"
                            value={customPeriodInput}
                            onChange={(e) => setCustomPeriodInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomPeriodAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomPeriodAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomPeriod(false);
                                setCustomPeriodInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isPeriodOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsPeriodOpen(false);
                        setIsCustomPeriod(false);
                      }}
                    />
                  )}
                </div>

                {/* 소유자 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    👤 소유자 *
                  </label>
                  
                  {/* 선택된 소유자 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsOwnerOpen(!isOwnerOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={newRecord.owner ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                      {newRecord.owner || '소유자를 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isOwnerOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isOwnerOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 소유자 목록 */}
                      {availableOwners.map((owner) => {
                        const isDefault = defaultOwners.includes(owner);
                        return (
                          <button
                            key={owner}
                            type="button"
                            onClick={() => handleOwnerSelect(owner)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.owner === owner
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {newRecord.owner === owner && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {owner}
                            </span>
                            {isDefault && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                기본
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomOwner ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomOwner(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 소유자 추가...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: 홍길동"
                            value={customOwnerInput}
                            onChange={(e) => setCustomOwnerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomOwnerAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomOwnerAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomOwner(false);
                                setCustomOwnerInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isOwnerOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsOwnerOpen(false);
                        setIsCustomOwner(false);
                      }}
                    />
                  )}
                </div>

                {/* 계좌유형 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    💼 계좌유형
                  </label>
                  
                  {/* 선택된 계좌유형 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsDivisionOpen(!isDivisionOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className="text-gray-900 dark:text-white">
                      {getSelectedDivisionLabel()}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isDivisionOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isDivisionOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 계좌유형 목록 */}
                      {defaultDivisions.map((division) => (
                        <button
                          key={division.value}
                          type="button"
                          onClick={() => handleDivisionSelect(division.value)}
                          className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                            newRecord.division === division.value
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            {newRecord.division === division.value && (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            {division.value} ({division.label})
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isDivisionOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDivisionOpen(false)}
                    />
                  )}
                </div>

                {/* 카테고리 - 아코디언 선택 */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📂 카테고리
                  </label>
                  
                  {/* 선택된 카테고리 표시 / 토글 버튼 */}
                  <button
                    type="button"
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-left flex items-center justify-between focus:ring-2 focus:ring-blue-500 outline-none transition-colors hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    <span className={newRecord.category ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}>
                      {newRecord.category || '카테고리를 선택하세요'}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 아코디언 드롭다운 */}
                  {isCategoryOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      {/* 카테고리 목록 */}
                      {availableCategories.map((category) => {
                        const isDefault = defaultCategories.includes(category);
                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => handleCategorySelect(category)}
                            className={`w-full px-4 py-2.5 text-sm text-left flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                              newRecord.category === category
                                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {newRecord.category === category && (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              {category}
                            </span>
                            {isDefault && (
                              <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                                기본
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {/* 구분선 */}
                      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

                      {/* 직접 입력 옵션 */}
                      {!isCustomCategory ? (
                        <button
                          type="button"
                          onClick={() => setIsCustomCategory(true)}
                          className="w-full px-4 py-2.5 text-sm text-left text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          새 카테고리 추가...
                        </button>
                      ) : (
                        <div className="p-3 space-y-2">
                          <input
                            type="text"
                            placeholder="예: DOW, ROBOT"
                            value={customCategoryInput}
                            onChange={(e) => setCustomCategoryInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCustomCategoryAdd();
                              }
                            }}
                            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleCustomCategoryAdd}
                              className="flex-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                              추가
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomCategory(false);
                                setCustomCategoryInput('');
                              }}
                              className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 외부 클릭 시 닫기 */}
                  {isCategoryOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => {
                        setIsCategoryOpen(false);
                        setIsCustomCategory(false);
                      }}
                    />
                  )}
                </div>

                {/* 종목명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    종목명 *
                  </label>
                  <input
                    type="text"
                    placeholder="예: ACE 미국 S&P 500"
                    value={newRecord.stock}
                    onChange={(e) => setNewRecord({ ...newRecord, stock: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* 수량 & 입출금 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      수량
                    </label>
                    <input
                      type="number"
                      value={newRecord.qty || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, qty: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      입출금액
                    </label>
                    <input
                      type="number"
                      value={newRecord.in_out || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, in_out: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* 배당금 & 평가금액 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      배당금
                    </label>
                    <input
                      type="number"
                      value={newRecord.dividend || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, dividend: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      평가금액
                    </label>
                    <input
                      type="number"
                      value={newRecord.value || ''}
                      onChange={(e) =>
                        setNewRecord({ ...newRecord, value: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* 메모 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📝 메모
                  </label>
                  <textarea
                    placeholder="투자 관련 메모를 입력하세요..."
                    value={newRecord.memo || ''}
                    onChange={(e) => setNewRecord({ ...newRecord, memo: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                {/* 저장 버튼 */}
                <button
                  onClick={handleSaveRecord}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
                >
                  💾 저장하기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <FooterNav />
    </div>
  );
}
