'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlobalNav } from './components/GlobalNav';
import { FooterNav } from './components/FooterNav';
import { AIAgentModal } from './components/AIAgentModal';

interface DailyRecord {
  id?: string;
  date: string;
  weight: number | null;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  daily_memo: string;
}

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  field_key: string;
  sort_order: number;
}

interface RoutineCheck {
  routine_id: string;
  checked: boolean;
}

type PeriodFilter = '7days' | '1month' | '1year' | 'ytd' | 'all';

export default function Home() {
  const userId = 'default_user'; // 실제 앱에서는 로그인한 사용자 ID 사용
  const pathname = usePathname();

  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [hasData, setHasData] = useState(false);
  const [allRecords, setAllRecords] = useState<DailyRecord[]>([]);
  const [weightPeriod, setWeightPeriod] = useState<PeriodFilter>('1month');
  
  // 루틴 관련 상태
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [routineChecks, setRoutineChecks] = useState<RoutineCheck[]>([]);
  const [isRoutineSettingOpen, setIsRoutineSettingOpen] = useState(false);
  const [isAIAgentOpen, setIsAIAgentOpen] = useState(false);
  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [editModeRoutine, setEditModeRoutine] = useState<string | null>(null);

  const [formData, setFormData] = useState<DailyRecord>({
    date: selectedDate,
    weight: null,
    meal_breakfast: false,
    meal_lunch: false,
    meal_dinner: false,
    meal_memo: '',
    daily_memo: '',
  });

  const handleInputChange = (
    field: keyof DailyRecord,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };


  // 루틴 템플릿 로드
  const loadRoutineTemplates = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('routine_templates')
        .select('id, emoji, label, field_key, sort_order, user_id')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('루틴 템플릿 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      setRoutineTemplates(data || []);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase, userId]);

  // 특정 날짜의 루틴 체크 상태 로드
  const loadRoutineChecks = useCallback(async (date: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('daily_routine_checks')
        .select('routine_id, checked')
        .eq('date', date);

      if (error && error.code !== 'PGRST116') {
        console.error('루틴 체크 조회 오류:', error);
        return;
      }

      setRoutineChecks(data || []);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase]);

  const loadDailyRecord = useCallback(async (date: string) => {
    if (!supabase) return;
    try {
      // 명시적으로 컬럼 지정 (title 컬럼 제외)
      const { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
        .eq('date', date)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('데이터 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      if (data) {
        setFormData(data);
        setHasData(true);
        setIsEditMode(false);
      } else {
        setFormData({
          date: date,
          weight: null,
          meal_breakfast: false,
          meal_lunch: false,
          meal_dinner: false,
          meal_memo: '',
          daily_memo: '',
        });
        setHasData(false);
        setIsEditMode(true);
      }
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase]);

  const loadAllRecords = useCallback(async () => {
    if (!supabase) {
      console.warn('Supabase 클라이언트가 없습니다.');
      return;
    }
    try {
      // 명시적으로 컬럼 지정 (title 컬럼 제외)
      const { data, error } = await supabase
        .from('daily_records')
        .select('id, date, weight, meal_breakfast, meal_lunch, meal_dinner, meal_memo, daily_memo, created_at, updated_at')
        .order('date', { ascending: true });

      if (error) {
        console.error('전체 데이터 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      console.log('로드된 레코드 수:', data?.length || 0);
      console.log('체중 데이터가 있는 레코드:', data?.filter(r => r.weight !== null).length || 0);
      setAllRecords(data || []);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase]);

  useEffect(() => {
    loadRoutineTemplates();
  }, [loadRoutineTemplates]);

  useEffect(() => {
    loadDailyRecord(selectedDate);
    loadRoutineChecks(selectedDate);
    loadAllRecords();
  }, [selectedDate, loadDailyRecord, loadRoutineChecks, loadAllRecords]);

  // 루틴 체크박스 상태 확인
  const isRoutineChecked = (routineId: string): boolean => {
    return routineChecks.some(check => check.routine_id === routineId && check.checked);
  };

  // 루틴 체크박스 토글
  const handleRoutineCheckChange = (routineId: string) => {
    const isChecked = isRoutineChecked(routineId);
    setRoutineChecks(prev => {
      const existing = prev.find(c => c.routine_id === routineId);
      if (existing) {
        return prev.map(c => 
          c.routine_id === routineId ? { ...c, checked: !c.checked } : c
        );
      } else {
        return [...prev, { routine_id: routineId, checked: true }];
      }
    });
  };

  const handleCheckboxChange = (field: keyof DailyRecord) => {
    setFormData((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };


  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다. 환경 변수를 확인해주세요.');
      return;
    }
    
    setIsSaving(true);
    setMessage('');

    try {
      // 1. daily_records 저장
      const { data: existingData, error: checkError } = await supabase
        .from('daily_records')
        .select('id')
        .eq('date', selectedDate)
        .maybeSingle();

      // ✅ 에러 상세 로깅 추가
      if (checkError && checkError.code !== 'PGRST116') {
        console.error('=== 체크 에러 상세 ===');
        console.error('메시지:', checkError.message);
        console.error('코드:', checkError.code);
        console.error('상세:', checkError.details);
        console.error('힌트:', checkError.hint);
        console.error('전체:', JSON.stringify(checkError, null, 2));
        throw checkError;
      }

      if (existingData) {
        const { error } = await supabase
          .from('daily_records')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('date', selectedDate);

        if (error) {
          console.error('=== 업데이트 에러 상세 ===');
          console.error('메시지:', error.message);
          console.error('코드:', error.code);
          console.error('상세:', error.details);
          console.error('힌트:', error.hint);
          console.error('전체:', JSON.stringify(error, null, 2));
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('daily_records')
          .insert([formData]);

        if (error) {
          console.error('=== 삽입 에러 상세 ===');
          console.error('메시지:', error.message);
          console.error('코드:', error.code);
          console.error('상세:', error.details);
          console.error('힌트:', error.hint);
          console.error('전체:', JSON.stringify(error, null, 2));
          throw error;
        }
      }

      // 2. 루틴 체크 저장
      await supabase
        .from('daily_routine_checks')
        .delete()
        .eq('date', selectedDate);

      const checksToInsert = routineChecks
        .filter(check => check.checked)
        .map(check => ({
          date: selectedDate,
          routine_id: check.routine_id,
          checked: true,
        }));

      if (checksToInsert.length > 0) {
        const { error: checkError } = await supabase
          .from('daily_routine_checks')
          .insert(checksToInsert);

        if (checkError) {
          console.error('=== 루틴 체크 삽입 에러 상세 ===');
          console.error('메시지:', checkError.message);
          console.error('코드:', checkError.code);
          console.error('상세:', checkError.details);
          console.error('힌트:', checkError.hint);
          console.error('전체:', JSON.stringify(checkError, null, 2));
          throw checkError;
        }
      }

      setMessage('✅ 저장되었습니다!');
      setIsEditMode(false);
      setHasData(true);
      loadAllRecords();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('=== 최종 에러 캐치 ===');
      console.error('타입:', typeof err);
      console.error('전체 에러:', err);
      
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (err?.message) {
        errorMessage = err.message;
        
        // 구체적인 에러 메시지 처리
        if (err.message.includes('new row violates row-level security policy')) {
          errorMessage = '데이터 저장 권한이 없습니다. Supabase RLS 정책을 확인해주세요.';
        } else if (err.message.includes('duplicate key value')) {
          errorMessage = '이미 존재하는 데이터입니다.';
        } else if (err.message.includes('violates foreign key constraint')) {
          errorMessage = '참조 데이터가 존재하지 않습니다.';
        }
      }
      
      setMessage(`❌ 저장 실패: ${errorMessage}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  // 체중 그래프 데이터 필터링
  const getWeightChartData = () => {
    const now = new Date();
    let startDate = new Date();

    switch (weightPeriod) {
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '1month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case '1year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      case 'ytd':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case 'all':
        const allData = allRecords
          .filter((r) => r.weight !== null)
          .map((r) => ({
            date: r.date,
            weight: r.weight,
          }));
        console.log('전체 데이터 필터링 결과:', allData.length, '개');
        return allData;
    }

    const filtered = allRecords
      .filter((r) => {
        const recordDate = new Date(r.date);
        return r.weight !== null && recordDate >= startDate;
      })
      .map((r) => ({
        date: r.date,
        weight: r.weight,
      }));
    console.log(`${weightPeriod} 필터링 결과:`, filtered.length, '개');
    return filtered;
  };



  // 환경 변수 오류 표시
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-[480px] w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-400 mb-4">
            ⚠️ 환경 변수 오류
          </h2>
          <p className="text-red-700 dark:text-red-300 mb-4">
            Supabase 환경 변수가 설정되지 않았습니다.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded p-4 mb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              다음 환경 변수가 필요합니다:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 mb-3">
              <li>
                NEXT_PUBLIC_SUPABASE_URL: {supabaseUrl ? (
                  <span className="text-green-600">✅ 설정됨 ({supabaseUrl.substring(0, 30)}...)</span>
                ) : (
                  <span className="text-red-600">❌ 없음</span>
                )}
              </li>
              <li>
                NEXT_PUBLIC_SUPABASE_ANON_KEY: {supabaseAnonKey ? (
                  <span className="text-green-600">✅ 설정됨 (길이: {supabaseAnonKey.length})</span>
                ) : (
                  <span className="text-red-600">❌ 없음</span>
                )}
              </li>
            </ul>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded p-3 mb-4">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              💡 <strong>해결 방법:</strong>
            </p>
            <ol className="text-xs text-yellow-700 dark:text-yellow-400 mt-2 space-y-1 list-decimal list-inside">
              <li>Vercel 대시보드 → Settings → Environment Variables 확인</li>
              <li>환경 변수 추가 후 <strong>반드시 재배포</strong> (Redeploy) 필요</li>
              <li>브라우저 콘솔(F12)에서 환경 변수 상태 확인</li>
            </ol>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400">
            Vercel에 배포된 경우, 프로젝트 설정 → Environment Variables에서 확인하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20">
      <GlobalNav />
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

        {/* 루틴 설정 모달 */}
        {isRoutineSettingOpen && (
          <RoutineSettingModal
            userId={userId}
            routineTemplates={routineTemplates}
            onClose={() => {
              setIsRoutineSettingOpen(false);
              loadRoutineTemplates();
            }}
          />
        )}

        {/* AI Agent 모달 */}
        {isAIAgentOpen && (
          <AIAgentModal
            onClose={() => setIsAIAgentOpen(false)}
          />
        )}

        <div className="space-y-6">
          {/* 입력 섹션 */}
          <div>
            {/* 날짜, 체중 입력, 수정 버튼 한 줄 배치 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-6 shadow-sm">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {/* 날짜 입력 */}
                <div 
                  className="relative cursor-pointer overflow-hidden"
                  onClick={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input[type="date"]') as HTMLInputElement;
                    if (input) {
                      input.focus();
                      // showPicker는 readOnly가 아닌 input에서만 작동
                      if (input.showPicker) {
                        try {
                          input.showPicker();
                        } catch (err) {
                          // showPicker 실패 시 click으로 대체
                          input.click();
                        }
                      } else {
                        input.click();
                      }
                    }
                  }}
                >
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-transparent border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[44px] cursor-pointer [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                    style={{ color: 'transparent', WebkitAppearance: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.currentTarget.showPicker) {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) {
                          // 에러 무시 (브라우저가 자동으로 처리)
                        }
                      }
                    }}
                  />
                  {/* 날짜 포맷 표시 (오버레이) - 한 줄로 정렬, 박스 안으로 제한 */}
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-base text-gray-900 dark:text-white font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[calc(100%-2rem)]">
                    {(() => {
                      const date = new Date(selectedDate);
                      const year = date.getFullYear();
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      return `${year}년 ${month}월 ${day}일`;
                    })()}
                  </div>
                </div>
            {/* 체중 입력 */}
            <input
              type="number"
              step="0.1"
              value={formData.weight || ''}
              onChange={(e) =>
                handleInputChange('weight', e.target.value ? parseFloat(e.target.value) : '')
              }
              placeholder="체중"
              disabled={!isEditMode}
              className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 min-h-[44px]"
            />
            {/* 수정/저장 버튼 */}
                {!isEditMode ? (
                  <button
                    onClick={handleEdit}
                className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px] transition-colors flex items-center justify-center"
                aria-label="수정하기"
                  >
                <span className="text-base">✏️</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 min-h-[44px] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                aria-label={isSaving ? '저장 중' : '저장'}
                  >
                <span className="text-base">{isSaving ? '⏳' : '💾'}</span>
                  </button>
                )}
              </div>
              {message && (
                <div className="mt-3 text-center text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">{message}</div>
              )}
            </div>

            {/* 체중 변화 그래프 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-6 shadow-sm">
              <div className="flex flex-col gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">📊 체중 변화</h3>
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    onClick={() => setWeightPeriod('7days')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === '7days'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setWeightPeriod('1month')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === '1month'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    1M
                  </button>
                  <button
                    onClick={() => setWeightPeriod('1year')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === '1year'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    1Y
                  </button>
                  <button
                    onClick={() => setWeightPeriod('ytd')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === 'ytd'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    YTD
                  </button>
                  <button
                    onClick={() => setWeightPeriod('all')}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      weightPeriod === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    전체
                  </button>
                </div>
              </div>
              <div className="h-64">
                {getWeightChartData().length > 0 ? (() => {
                  const rawData = getWeightChartData();
                  // 날짜순으로 정렬
                  const chartData = [...rawData].sort((a, b) => 
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );
                  
                  // 데이터 포인트 수에 따라 interval 자동 계산
                  // 10개 이하: 모두 표시, 10-20개: 1개씩 건너뛰기, 20-30개: 2개씩, 30개 이상: 3개씩
                  const dataCount = chartData.length;
                  let interval: number | "preserveStartEnd" = 0;
                  if (dataCount > 30) {
                    interval = Math.floor(dataCount / 10); // 최대 10개 정도만 표시
                  } else if (dataCount > 20) {
                    interval = 2;
                  } else if (dataCount > 10) {
                    interval = 1;
                  }
                  
                  return (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={chartData}
                      margin={{ top: 5, right: 5, left: 0, bottom: 25 }}
                    >
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        stroke="#374151" 
                        strokeOpacity={0.3}
                        vertical={false}
                      />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6B7280"
                        tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                        padding={{ left: 0, right: 0 }}
                        interval={interval}
                        tickFormatter={(value) => {
                          if (!value) return '';
                          const date = new Date(value);
                          return `${date.getMonth() + 1}/${date.getDate()}`;
                        }}
                      />
                      <YAxis 
                        stroke="#6B7280"
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tickFormatter={(value) => `${value}kg`}
                        width={45}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1F2937', 
                          border: '1px solid #374151',
                          borderRadius: '12px',
                          padding: '8px 12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                        }}
                        labelStyle={{ color: '#D1D5DB', fontSize: '12px', marginBottom: '4px' }}
                        itemStyle={{ color: '#EF4444', fontSize: '14px', fontWeight: 'bold' }}
                        formatter={(value: any) => [`${value} kg`, '체중']}
                        cursor={{ stroke: '#EF4444', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#EF4444" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        fill="url(#colorWeight)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  );
                })() : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">체중 데이터가 없습니다</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 데일리 루틴 - 동적으로 렌더링 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 데일리 루틴</h3>
              {routineTemplates.map((routine, index) => (
                <div key={routine.id}>
                  <RoutineItem
                    emoji={routine.emoji}
                    label={routine.label}
                    checked={isRoutineChecked(routine.id)}
                    onChange={() => handleRoutineCheckChange(routine.id)}
                    disabled={!isEditMode}
                    isLast={index === routineTemplates.length - 1}
                    isExpanded={expandedRoutineId === routine.id}
                    onExpandToggle={() => {
                      setExpandedRoutineId(expandedRoutineId === routine.id ? null : routine.id);
                    }}
                    routineId={routine.id}
                    routineTemplates={routineTemplates}
                    editModeRoutine={editModeRoutine}
                    setEditModeRoutine={setEditModeRoutine}
                  />
                  {/* 확장된 루틴의 캘린더 표시 */}
                  {expandedRoutineId === routine.id && (
                    <div className="mt-2 pb-2 -mx-4 sm:-mx-5">
                      <RoutineCalendar
                        routineId={routine.id}
                        routineLabel={routine.label}
                        routineEmoji={routine.emoji}
                        routineTemplates={routineTemplates}
                        isExpanded={true}
                        editModeRoutine={editModeRoutine}
                        setEditModeRoutine={setEditModeRoutine}
                      />
                    </div>
                  )}
                </div>
              ))}
              {routineTemplates.length === 0 && (
                <div className="text-center text-gray-400 dark:text-gray-500 py-4">
                  루틴을 추가해주세요
                </div>
              )}
            </div>

            {/* 식사 기록 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-6 shadow-sm">
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-4">
                🍽️ 오늘의 식사
              </label>
              <div className="flex flex-wrap gap-4 mb-4">
                <MealCheckbox
                  label="아침"
                  checked={formData.meal_breakfast}
                  onChange={() => handleCheckboxChange('meal_breakfast')}
                  disabled={!isEditMode}
                />
                <MealCheckbox
                  label="점심"
                  checked={formData.meal_lunch}
                  onChange={() => handleCheckboxChange('meal_lunch')}
                  disabled={!isEditMode}
                />
                <MealCheckbox
                  label="저녁"
                  checked={formData.meal_dinner}
                  onChange={() => handleCheckboxChange('meal_dinner')}
                  disabled={!isEditMode}
                />
              </div>
              <textarea
                value={formData.meal_memo}
                onChange={(e) => handleInputChange('meal_memo', e.target.value)}
                placeholder="식사 메모 (선택사항)"
                disabled={!isEditMode}
                className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 resize-none"
                rows={3}
              />
            </div>

            {/* 네비게이션 메뉴 - 고정 */}
            <div className="sticky top-16 z-40 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-6 shadow-lg">
              <div className="flex items-center justify-around gap-2">
                {/* AI Agent 버튼 */}
                <button
                  onClick={() => setIsAIAgentOpen(true)}
                  className="w-full px-4 py-3 text-base font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-500"
                  aria-label="AI Agent"
                >
                  <span>🚀</span>
                  <span>AI</span>
                </button>

                {/* Daily 버튼 */}
                <Link
                  href="/"
                  className={`w-full px-4 py-3 text-base font-medium rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2 border ${
                    pathname === '/'
                      ? 'bg-blue-600 text-white border-blue-700 dark:border-blue-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-500'
                  }`}
                >
                  <span>📅</span>
                  <span>Daily</span>
                </Link>

                {/* Diary 버튼 */}
                <Link
                  href="/memo"
                  className={`w-full px-4 py-3 text-base font-medium rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2 border ${
                    pathname === '/memo'
                      ? 'bg-blue-600 text-white border-blue-700 dark:border-blue-500'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-500'
                  }`}
                >
                  <span>📝</span>
                  <span>Diary</span>
                </Link>
              </div>
            </div>
            </div>
          </div>
      </div>
    </div>
  );
}

// 루틴 아이템 컴포넌트
function RoutineItem({
  emoji,
  label,
  checked,
  onChange,
  disabled,
  isLast = false,
  isExpanded = false,
  onExpandToggle,
  routineId,
  routineTemplates,
  editModeRoutine,
  setEditModeRoutine,
}: {
  emoji: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  isLast?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
  routineId: string;
  routineTemplates: RoutineTemplate[];
  editModeRoutine: string | null;
  setEditModeRoutine: (routineId: string | null) => void;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // 로컬 스토리지에서 데이터 로드
  useEffect(() => {
    try {
      const stored = localStorage.getItem('routine-calendar-data');
      if (stored) {
        const parsed = JSON.parse(stored);
        const data: Record<string, Set<string>> = {};
        Object.keys(parsed).forEach(date => {
          data[date] = new Set(parsed[date]);
        });
        setCheckedDates(data);
      }
    } catch (err) {
      console.error('로컬 스토리지 로드 오류:', err);
    }
  }, []);

  // 날짜 체크 상태 확인
  const isDateChecked = (date: string, routineId: string) => {
    return checkedDates[date]?.has(routineId) || false;
  };

  // 연속 체크한 날짜 수 계산
  const getConsecutiveDays = (routineId: string) => {
    let consecutiveCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let checkDate = new Date(today);
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (isDateChecked(dateStr, routineId)) {
        consecutiveCount++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
      if (consecutiveCount > 365) break;
    }
    return consecutiveCount;
  };

  // 월별 체크 비율 계산
  const getMonthProgress = (year: number, month: number, routineId: string) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let checkedCount = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (isDateChecked(dateStr, routineId)) {
        checkedCount++;
      }
    }
    return daysInMonth > 0 ? (checkedCount / daysInMonth) * 100 : 0;
  };

  // 루틴 색상은 항상 기본값(blue) 사용
  const routineColor = '#3B82F6';
  
  // hex 색상을 RGB로 변환
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  };
  
  // 색상 밝기 계산 (0-255)
  const getBrightness = (hex: string) => {
    const rgb = hexToRgb(hex);
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  };
  
  // hex를 rgba로 변환
  const hexToRgba = (hex: string, alpha: number) => {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };
  
  // 색상별 클래스 매핑 (hex 색상 지원)
  const getColorClasses = (color: string) => {
    // hex 색상인 경우
    if (color.startsWith('#')) {
      const brightness = getBrightness(color);
      const isLight = brightness > 128;
      const lightColor = hexToRgba(color, 0.2); // 20% 투명도
      const darkColor = hexToRgba(color, 0.3); // 30% 투명도
      const textColor = isLight ? '#1E3A8A' : '#60A5FA';
      const textDarkColor = isLight ? '#3B82F6' : '#93C5FD';
      
      return {
        bg: color,
        bgLight: lightColor,
        bgDark: darkColor,
        text: textColor,
        textDark: textDarkColor,
        ring: color,
        button: color,
        buttonHover: color,
      };
    }
    
    // 기존 색상 이름 매핑
    const colorMap: Record<string, { bg: string; bgLight: string; bgDark: string; text: string; textDark: string; ring: string; button: string; buttonHover: string }> = {
      blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30', text: 'text-blue-700', textDark: 'text-blue-400', ring: 'ring-blue-500', button: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' },
      purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30', text: 'text-purple-700', textDark: 'text-purple-400', ring: 'ring-purple-500', button: 'bg-purple-600', buttonHover: 'hover:bg-purple-700' },
      green: { bg: 'bg-green-500', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30', text: 'text-green-700', textDark: 'text-green-400', ring: 'ring-green-500', button: 'bg-green-600', buttonHover: 'hover:bg-green-700' },
      red: { bg: 'bg-red-500', bgLight: 'bg-red-100', bgDark: 'bg-red-900/30', text: 'text-red-700', textDark: 'text-red-400', ring: 'ring-red-500', button: 'bg-red-600', buttonHover: 'hover:bg-red-700' },
      yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-100', bgDark: 'bg-yellow-900/30', text: 'text-yellow-700', textDark: 'text-yellow-400', ring: 'ring-yellow-500', button: 'bg-yellow-600', buttonHover: 'hover:bg-yellow-700' },
      orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-100', bgDark: 'bg-orange-900/30', text: 'text-orange-700', textDark: 'text-orange-400', ring: 'ring-orange-500', button: 'bg-orange-600', buttonHover: 'hover:bg-orange-700' },
      pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-100', bgDark: 'bg-pink-900/30', text: 'text-pink-700', textDark: 'text-pink-400', ring: 'ring-pink-500', button: 'bg-pink-600', buttonHover: 'hover:bg-pink-700' },
      indigo: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', bgDark: 'bg-indigo-900/30', text: 'text-indigo-700', textDark: 'text-indigo-400', ring: 'ring-indigo-500', button: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' },
    };
    return colorMap[color] || colorMap.blue;
  };
  
  const colorClasses = getColorClasses(routineColor);
  const isHexColor = routineColor.startsWith('#');
  const consecutiveDays = getConsecutiveDays(routineId);
  
  return (
    <div>
      <div 
        className="flex items-center gap-3 py-2 min-h-[44px] cursor-pointer"
          onClick={onExpandToggle}
      >
        {/* 이모지 + 텍스트 영역 */}
        <div className="flex items-center gap-3 flex-1">
        <span className="text-2xl">{emoji}</span>
          <span className={`text-base ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            {label}
          </span>
        </div>
        
        {/* 연속 일수 + 슬라이더 */}
        <div className="flex items-center gap-2 shrink-0">
          {consecutiveDays > 0 && (
            <div
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                isHexColor 
                  ? '' 
                  : `${colorClasses.bgLight} dark:${colorClasses.bgDark} ${colorClasses.text} dark:${colorClasses.textDark}`
              }`}
              style={isHexColor ? {
                backgroundColor: colorClasses.bgLight,
                color: getBrightness(routineColor) > 128 ? '#1E3A8A' : '#60A5FA',
              } : {}}
            >
              {consecutiveDays}일 연속
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden w-24">
              <div
                className={isHexColor ? 'h-full transition-all duration-500 ease-out' : `h-full ${colorClasses.bg} transition-all duration-500 ease-out`}
                style={{ 
                  width: `${getMonthProgress(currentYear, currentMonth, routineId)}%`,
                  backgroundColor: isHexColor ? routineColor : undefined,
                }}
              />
            </div>
            <div
              className={isHexColor ? 'w-3 h-3 rounded-full shrink-0 shadow-sm' : `w-3 h-3 rounded-full ${colorClasses.bg} shrink-0 shadow-sm`}
              style={isHexColor ? { backgroundColor: routineColor } : {}}
            />
          </div>
        </div>
        
        {/* 체크박스 */}
        <label 
          className="cursor-pointer shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) {
              onChange();
            }
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              e.stopPropagation();
              if (!disabled) {
                onChange();
              }
            }}
            disabled={disabled}
            className={`w-6 h-6 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded-md focus:ring-2 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
              isHexColor ? '' : `${colorClasses.text} focus:${colorClasses.ring}`
            }`}
            style={isHexColor ? {
              accentColor: routineColor,
            } : {}}
          />
        </label>
      </div>
      {!isLast && <div style={{ height: '0.5px' }} className="bg-gray-200 dark:bg-gray-600"></div>}
    </div>
  );
}

// 식사 체크박스 컴포넌트
function MealCheckbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer min-h-[44px] py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-6 h-6 text-blue-500 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
      />
      <span className={`text-base ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </span>
    </label>
  );
}

// 루틴 설정 모달 컴포넌트
function RoutineSettingModal({
  userId,
  routineTemplates,
  onClose,
}: {
  userId: string;
  routineTemplates: RoutineTemplate[];
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<RoutineTemplate[]>([...routineTemplates]);
  const [isSaving, setIsSaving] = useState(false);

  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();

  const handleAdd = () => {
    const newTemplate: RoutineTemplate = {
      id: `temp_${Date.now()}`,
      emoji: '✨',
      label: '새로운 루틴',
      field_key: `custom_${Date.now()}`,
      sort_order: templates.length + 1,
    };
    setTemplates([...templates, newTemplate]);
  };

  const handleDelete = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id));
  };

  const handleUpdate = (id: string, field: 'emoji' | 'label', value: string) => {
    setTemplates(templates.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleSave = async () => {
    if (!supabase) {
      alert('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    setIsSaving(true);
    try {
      // 기존 템플릿 삭제
      const { error: deleteError } = await supabase
        .from('routine_templates')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('템플릿 삭제 오류');
        if (deleteError?.message) console.error('- 메시지:', deleteError.message);
        if (deleteError?.code) console.error('- 코드:', deleteError.code);
        if (deleteError?.details) console.error('- 상세:', deleteError.details);
        throw deleteError;
      }

      // 새로운 템플릿 삽입
      const templatesToInsert = templates.map((t, index) => ({
        user_id: userId,
        emoji: t.emoji,
        label: t.label,
        field_key: t.field_key,
        sort_order: index + 1,
      }));

      // insert 시도
      const { error: insertError } = await supabase
        .from('routine_templates')
        .insert(templatesToInsert);

      if (insertError) {
        console.error('=== 템플릿 삽입 에러 상세 ===');
        console.error('메시지:', insertError.message);
        console.error('코드:', insertError.code);
        console.error('상세:', insertError.details);
        console.error('힌트:', insertError.hint);
        console.error('전체:', JSON.stringify(insertError, null, 2));
        throw insertError;
      }

      alert('✅ 저장되었습니다!');
      onClose();
    } catch (err: any) {
      console.error('=== 루틴 설정 저장 오류 ===');
      console.error('타입:', typeof err);
      console.error('전체 에러:', err);
      if (err?.message) console.error('메시지:', err.message);
      if (err?.code) console.error('코드:', err.code);
      if (err?.details) console.error('상세:', err.details);
      if (err?.hint) console.error('힌트:', err.hint);
      console.error('전체 JSON:', JSON.stringify(err, null, 2));
      
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (err?.message) {
        errorMessage = err.message;
        
        // 구체적인 에러 메시지 처리
        if (err.message.includes('new row violates row-level security policy')) {
          errorMessage = '데이터 저장 권한이 없습니다. Supabase RLS 정책을 확인해주세요.';
        } else if (err.message.includes('duplicate key value')) {
          errorMessage = '이미 존재하는 데이터입니다.';
        } else if (err.message.includes('violates foreign key constraint')) {
          errorMessage = '참조 데이터가 존재하지 않습니다.';
        }
      }
      
      alert(`❌ 저장 실패: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 max-w-[480px] w-full max-h-[80vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">⚙️ 루틴 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 mb-6">
          {templates.map((template, index) => {
            
            return (
            <div key={template.id} className="flex flex-col items-stretch gap-3 bg-white dark:bg-gray-700 rounded-lg p-4 sm:p-5">
              <span className="text-gray-500 dark:text-gray-400 text-base">{index + 1}</span>
              <input
                type="text"
                value={template.emoji}
                onChange={(e) => handleUpdate(template.id, 'emoji', e.target.value)}
                className="w-full px-3 py-2.5 text-center bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
                maxLength={2}
              />
              <input
                type="text"
                value={template.label}
                onChange={(e) => handleUpdate(template.id, 'label', e.target.value)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
              />
              <button
                onClick={() => handleDelete(template.id)}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors min-h-[44px]"
              >
                삭제
              </button>
            </div>
            );
          })}
        </div>

        <button
          onClick={handleAdd}
          className="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors mb-4 min-h-[44px] text-base"
        >
          + 루틴 추가
        </button>

        <div className="flex flex-col gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors min-h-[44px] text-base"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 min-h-[44px] text-base"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 루틴별 캘린더 컴포넌트
function RoutineCalendar({
  routineId,
  routineLabel,
  routineEmoji,
  routineTemplates,
  isExpanded = false,
  editModeRoutine,
  setEditModeRoutine,
}: {
  routineId: string;
  routineLabel: string;
  routineEmoji: string;
  routineTemplates: RoutineTemplate[];
  isExpanded?: boolean;
  editModeRoutine: string | null;
  setEditModeRoutine: (routineId: string | null) => void;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Supabase 클라이언트 싱글톤 사용
  const supabase = getSupabase();

  // 3개월 목록 생성 (이전, 현재, 다음)
  const getThreeMonths = useCallback(() => {
    const months = [];
    for (let i = -1; i <= 1; i++) {
      let year = currentYear;
      let month = currentMonth + i;
      
      if (month < 1) {
        month += 12;
        year -= 1;
      } else if (month > 12) {
        month -= 12;
        year += 1;
      }
      
      months.push({ year, month });
    }
    return months;
  }, [currentYear, currentMonth]);

  // 로컬 스토리지에서 데이터 로드 및 Supabase 데이터 동기화
  useEffect(() => {
    const loadData = async () => {
      // 1. 로컬 스토리지에서 로드
      let data: Record<string, Set<string>> = {};
      try {
        const stored = localStorage.getItem('routine-calendar-data');
        if (stored) {
          const parsed = JSON.parse(stored);
          Object.keys(parsed).forEach(date => {
            data[date] = new Set(parsed[date]);
          });
        }
      } catch (err) {
        console.error('로컬 스토리지 로드 오류:', err);
      }

      // 2. Supabase에서도 로드하여 병합 (기존 데이터 유지)
      // 연간 단위 로드 (현재 년도의 1월 1일부터 12월 31일까지)
      if (supabase) {
        try {
          const allDates: string[] = [];
          
          // 현재 년도의 1월부터 12월까지
          for (let month = 1; month <= 12; month++) {
            const daysInMonth = new Date(currentYear, month, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              allDates.push(dateStr);
            }
          }

          const { data: checks } = await supabase
            .from('daily_routine_checks')
            .select('date, routine_id, checked')
            .in('date', allDates)
            .eq('checked', true);

          if (checks && checks.length > 0) {
            checks.forEach((check: any) => {
              if (!data[check.date]) {
                data[check.date] = new Set();
              }
              data[check.date].add(check.routine_id);
            });
          }
        } catch (err) {
          console.error('Supabase 데이터 로드 오류:', err);
        }
      }

      setCheckedDates(data);
      // 로컬 스토리지에 병합된 데이터 저장
      if (Object.keys(data).length > 0) {
        const serializable: Record<string, string[]> = {};
        Object.keys(data).forEach(date => {
          serializable[date] = Array.from(data[date]);
        });
        localStorage.setItem('routine-calendar-data', JSON.stringify(serializable));
      }
    };
    loadData();
  }, [routineTemplates, getThreeMonths, supabase]);

  // 토글이 열릴 때 현재 월을 중앙에 표시하도록 스크롤 위치 설정
  useEffect(() => {
    if (isExpanded && calendarScrollRef.current) {
      // 현재 월의 중간 날짜 (15일)를 기준으로 계산
      const currentMonthMidDate = new Date(currentYear, currentMonth - 1, 15);
      currentMonthMidDate.setHours(0, 0, 0, 0);
      
      // 연간 캘린더: 현재 년도의 1월 1일부터 시작
      const startYear = currentYear;
      const startMonth = 1;
      
      const firstDayOfMonth = new Date(startYear, startMonth - 1, 1);
      const firstDayWeekday = firstDayOfMonth.getDay();
      const firstDayMondayIndex = (firstDayWeekday + 6) % 7;
      const firstMonday = new Date(firstDayOfMonth);
      if (firstDayMondayIndex !== 0) {
        firstMonday.setDate(firstMonday.getDate() - firstDayMondayIndex);
      }
      firstMonday.setHours(0, 0, 0, 0);
      
      // 현재 월의 중간 날짜가 몇 번째 주인지 계산 (0부터 시작)
      const daysDiff = Math.floor((currentMonthMidDate.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
      const weekIndex = Math.floor(daysDiff / 7);
      
      // 약간의 지연을 두고 스크롤 (DOM 렌더링 완료 후)
      const timeoutId = setTimeout(() => {
        if (calendarScrollRef.current) {
          const container = calendarScrollRef.current;
          const containerWidth = container.clientWidth;
          
          // 요일 헤더 너비: 40px
          const headerWidth = 40;
          // 주 너비: 37px (셀) + 4px (gap) = 41px
          const weekWidth = 37 + 4;
          
          // 현재 월의 중간 주 시작 위치 (요일 헤더 포함)
          const currentWeekStartPosition = headerWidth + (weekIndex * weekWidth);
          
          // 현재 월의 중간 주를 화면 정 중앙에 배치하기 위한 스크롤 위치 계산
          // 스크롤 위치 = 현재 주 시작 위치 - (컨테이너 너비 / 2) + (주 너비 / 2)
          const scrollPosition = Math.max(0, currentWeekStartPosition - (containerWidth / 2) + (weekWidth / 2));
          
          container.scrollLeft = scrollPosition;
        }
      }, 600);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isExpanded, currentYear, currentMonth]);

  // 로컬 스토리지에 데이터 저장
  const saveToStorage = useCallback((data: Record<string, Set<string>>) => {
    try {
      const serializable: Record<string, string[]> = {};
      Object.keys(data).forEach(date => {
        serializable[date] = Array.from(data[date]);
      });
      localStorage.setItem('routine-calendar-data', JSON.stringify(serializable));
    } catch (err) {
      console.error('로컬 스토리지 저장 오류:', err);
    }
  }, []);

  // 특정 월의 날짜 목록 생성
  const getMonthDays = (year: number, month: number) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        day,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      });
    }
    return days;
  };

  // 주 단위로 날짜 배열 생성 (세로: 요일, 가로: 주)
  // 첫 번째 열에 1,2,3,4,5,6,7이 오도록 주 단위로 구성
  const getWeekBasedDateGrid = (startYear: number, startMonth: number, numWeeks: number = 8) => {
    // 시작 날짜: 해당 월의 첫 날
    const firstDayOfMonth = new Date(startYear, startMonth - 1, 1);
    
    // 첫 날의 요일 (0=일요일, 1=월요일, ..., 6=토요일)
    const firstDayWeekday = firstDayOfMonth.getDay();
    
    // 월요일 인덱스로 변환 (월요일=0, 화요일=1, ..., 일요일=6)
    const firstDayMondayIndex = (firstDayWeekday + 6) % 7; // 일요일(0)을 6으로 변환
    
    // 해당 월의 첫 월요일 계산
    // 첫 날이 월요일이 아니면 이전 주 월요일로 이동
    const firstMonday = new Date(firstDayOfMonth);
    if (firstDayMondayIndex !== 0) {
      firstMonday.setDate(firstMonday.getDate() - firstDayMondayIndex);
    }
    
    // 주 단위로 날짜 그룹화
    // weeks[0] = 첫 번째 주 [월, 화, 수, 목, 금, 토, 일]
    // weeks[1] = 두 번째 주 [월, 화, 수, 목, 금, 토, 일]
    const weeks: Array<Array<{ 
      day: number; 
      date: string; 
      month: number; 
      year: number;
      isNewMonth: boolean;
    }>> = [];
    
    let currentDate = new Date(firstMonday);
    let prevMonth = currentDate.getMonth() + 1;
    let prevYear = currentDate.getFullYear();
    
    // numWeeks 주만큼 날짜 생성
    for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
      const week: Array<{ 
        day: number; 
        date: string; 
        month: number; 
        year: number;
        isNewMonth: boolean;
      }> = [];
      
      // 한 주의 7일 (월요일~일요일)
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        
        // 월 변경 감지: 이전 날짜와 비교
        const isNewMonth = (month !== prevMonth || year !== prevYear);
        
        week.push({
          day,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          month,
          year,
          isNewMonth
        });
        
        // 이전 값 업데이트
        prevMonth = month;
        prevYear = year;
        
        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      weeks.push(week);
    }
    
    return weeks;
  };

  // 날짜 체크 상태 확인
  const isDateChecked = (date: string, routineId: string) => {
    return checkedDates[date]?.has(routineId) || false;
  };

  // 날짜 클릭 핸들러 (체크/언체크)
  const handleDateToggle = (date: string, routineId: string) => {
    if (editModeRoutine !== routineId) return;
    
    setCheckedDates(prev => {
      const newData = { ...prev };
      if (!newData[date]) {
        newData[date] = new Set();
      }
      
      const dateSet = new Set(newData[date]);
      if (dateSet.has(routineId)) {
        dateSet.delete(routineId);
      } else {
        dateSet.add(routineId);
      }
      
      if (dateSet.size === 0) {
        delete newData[date];
      } else {
        newData[date] = dateSet;
      }
      
      saveToStorage(newData);
      return newData;
    });
  };

  // 월별 체크 비율 계산 (0~100%)
  const getMonthProgress = (year: number, month: number, routineId: string) => {
    const days = getMonthDays(year, month);
    let checkedCount = 0;
    
    days.forEach(({ date }) => {
      if (isDateChecked(date, routineId)) {
        checkedCount++;
      }
    });
    
    return days.length > 0 ? (checkedCount / days.length) * 100 : 0;
  };

  // 연속 체크한 날짜 수 계산 (현재 날짜 기준)
  const getConsecutiveDays = (routineId: string) => {
    let consecutiveCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 오늘부터 과거로 거슬러 올라가며 연속 체크된 날짜 계산
    let checkDate = new Date(today);
    
    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (isDateChecked(dateStr, routineId)) {
        consecutiveCount++;
        // 하루 전으로 이동
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
      
      // 무한 루프 방지 (최대 365일까지 확인)
      if (consecutiveCount > 365) break;
    }
    
    return consecutiveCount;
  };

  // 루틴 색상은 항상 기본값(blue) 사용
  const routineColor = '#3B82F6';
  
  // hex 색상을 RGB로 변환
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 };
  };
  
  // 색상 밝기 계산 (0-255)
  const getBrightness = (hex: string) => {
    const rgb = hexToRgb(hex);
    return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  };
  
  // hex를 rgba로 변환
  const hexToRgba = (hex: string, alpha: number) => {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  };
  
  // 색상별 클래스 매핑 (hex 색상 지원)
  const getColorClasses = (color: string) => {
    // hex 색상인 경우
    if (color.startsWith('#')) {
      const brightness = getBrightness(color);
      const isLight = brightness > 128;
      const lightColor = hexToRgba(color, 0.2); // 20% 투명도
      const darkColor = hexToRgba(color, 0.3); // 30% 투명도
      const textColor = isLight ? '#1E3A8A' : '#60A5FA';
      const textDarkColor = isLight ? '#3B82F6' : '#93C5FD';
      
      return {
        bg: color,
        bgLight: lightColor,
        bgDark: darkColor,
        text: textColor,
        textDark: textDarkColor,
        ring: color,
        button: color,
        buttonHover: color,
      };
    }
    
    // 기존 색상 이름 매핑
    const colorMap: Record<string, { bg: string; bgLight: string; bgDark: string; text: string; textDark: string; button: string; buttonHover: string }> = {
      blue: { bg: 'bg-blue-500', bgLight: 'bg-blue-100', bgDark: 'bg-blue-900/30', text: 'text-blue-700', textDark: 'text-blue-400', button: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' },
      purple: { bg: 'bg-purple-500', bgLight: 'bg-purple-100', bgDark: 'bg-purple-900/30', text: 'text-purple-700', textDark: 'text-purple-400', button: 'bg-purple-600', buttonHover: 'hover:bg-purple-700' },
      green: { bg: 'bg-green-500', bgLight: 'bg-green-100', bgDark: 'bg-green-900/30', text: 'text-green-700', textDark: 'text-green-400', button: 'bg-green-600', buttonHover: 'hover:bg-green-700' },
      red: { bg: 'bg-red-500', bgLight: 'bg-red-100', bgDark: 'bg-red-900/30', text: 'text-red-700', textDark: 'text-red-400', button: 'bg-red-600', buttonHover: 'hover:bg-red-700' },
      yellow: { bg: 'bg-yellow-500', bgLight: 'bg-yellow-100', bgDark: 'bg-yellow-900/30', text: 'text-yellow-700', textDark: 'text-yellow-400', button: 'bg-yellow-600', buttonHover: 'hover:bg-yellow-700' },
      orange: { bg: 'bg-orange-500', bgLight: 'bg-orange-100', bgDark: 'bg-orange-900/30', text: 'text-orange-700', textDark: 'text-orange-400', button: 'bg-orange-600', buttonHover: 'hover:bg-orange-700' },
      pink: { bg: 'bg-pink-500', bgLight: 'bg-pink-100', bgDark: 'bg-pink-900/30', text: 'text-pink-700', textDark: 'text-pink-400', button: 'bg-pink-600', buttonHover: 'hover:bg-pink-700' },
      indigo: { bg: 'bg-indigo-500', bgLight: 'bg-indigo-100', bgDark: 'bg-indigo-900/30', text: 'text-indigo-700', textDark: 'text-indigo-400', button: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' },
    };
    return colorMap[color] || colorMap.blue;
  };
  
  const colorClasses = getColorClasses(routineColor);
  const isHexColor = routineColor.startsWith('#');
  const consecutiveDays = getConsecutiveDays(routineId);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-2 sm:p-3 w-full">
      {/* 날짜 + 달성률 + 슬라이더 + 수정 버튼 일직선 */}
      <div className="flex items-center justify-between mb-3">
        {/* 왼쪽: 날짜 + 연속 일수 */}
        <div className="flex items-center gap-2 shrink-0">
          <h5 className="text-base font-medium text-gray-900 dark:text-white shrink-0">
            {currentYear}년 {currentMonth}월
          </h5>
        {consecutiveDays > 0 && (
            <div
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                isHexColor 
                  ? '' 
                  : `${colorClasses.bgLight} dark:${colorClasses.bgDark} ${colorClasses.text} dark:${colorClasses.textDark}`
              }`}
              style={isHexColor ? {
                backgroundColor: colorClasses.bgLight,
                color: getBrightness(routineColor) > 128 ? '#1E3A8A' : '#60A5FA',
              } : {}}
            >
            {consecutiveDays}일 연속
          </div>
        )}
      </div>
        {/* 오른쪽: 슬라이더 + 수정 버튼 */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden w-24">
              <div
                className={isHexColor ? 'h-full transition-all duration-500 ease-out' : `h-full ${colorClasses.bg} transition-all duration-500 ease-out`}
            style={{ 
              width: `${getMonthProgress(currentYear, currentMonth, routineId)}%`,
                  backgroundColor: isHexColor ? routineColor : undefined,
            }}
          />
        </div>
            <div
              className={isHexColor ? 'w-3 h-3 rounded-full shrink-0 shadow-sm' : `w-3 h-3 rounded-full ${colorClasses.bg} shrink-0 shadow-sm`}
              style={isHexColor ? { backgroundColor: routineColor } : {}}
            />
          </div>
          <button
            onClick={() => setEditModeRoutine(editModeRoutine === routineId ? null : routineId)}
            className={`px-3 py-1.5 text-sm text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-md shrink-0 ${
              isHexColor ? '' : `${colorClasses.button} ${colorClasses.buttonHover}`
            }`}
            style={isHexColor ? {
              backgroundColor: routineColor,
            } : {}}
          >
            {editModeRoutine === routineId ? '저장' : '수정'}
          </button>
        </div>
      </div>
      
      {/* 가로 스크롤 가능한 캘린더 컨테이너 (요일별 세로 배치) */}
      <div 
        ref={calendarScrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{
          width: '100%',
          scrollbarWidth: 'thin',
          scrollbarColor: '#6B7280 #374151'
        }}
      >
        <div style={{ minWidth: 'max-content' }}>
          {(() => {
            // 연간 캘린더: 현재 년도의 1월 1일부터 시작
            const startYear = currentYear;
            const startMonth = 1;
            
            // 55주치 날짜 (약 385일 = 연간 + 여유) - 1월 1일부터 12월 31일까지 포함
            const numWeeks = 55;
            const weeks = getWeekBasedDateGrid(startYear, startMonth, numWeeks);
            
            // 각 주의 월 정보 계산 (월별 헤더 표시용)
            const monthHeaders: Array<{ weekIndex: number; month: number; year: number }> = [];
            weeks.forEach((week, weekIdx) => {
              // 각 주의 첫 번째 날짜(월요일)의 월을 사용
              const firstDay = week[0];
              if (weekIdx === 0 || weeks[weekIdx - 1][0].month !== firstDay.month || weeks[weekIdx - 1][0].year !== firstDay.year) {
                monthHeaders.push({
                  weekIndex: weekIdx,
                  month: firstDay.month,
                  year: firstDay.year
                });
              }
            });
            
            return (
              <div
                className="bg-gray-800 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg"
                style={{
                  padding: '8px',
                  display: 'grid',
                  gridTemplateColumns: `40px repeat(${weeks.length}, 37px)`,
                  gridTemplateRows: '24px repeat(7, 32px)',
                  gap: '4px',
                  minHeight: '250px',
                  width: 'max-content'
                }}
              >
                {/* 왼쪽 상단 빈 공간 */}
                <div
                  style={{
                    gridRow: 1,
                    gridColumn: 1,
                    backgroundColor: '#374151',
                    borderRadius: '6px'
                  }}
                />
                
                {/* 월별 헤더 */}
                {monthHeaders.map((header, idx) => {
                  const nextHeader = monthHeaders[idx + 1];
                  const colSpan = nextHeader 
                    ? nextHeader.weekIndex - header.weekIndex 
                    : weeks.length - header.weekIndex;
                  
                  return (
                    <div
                      key={`month-${header.weekIndex}`}
                      className="flex items-center justify-center text-white font-semibold"
                      style={{
                        gridRow: 1,
                        gridColumn: header.weekIndex + 2,
                        gridColumnEnd: `span ${colSpan}`,
                        fontSize: '11px',
                        backgroundColor: '#374151',
                        borderRadius: '6px'
                      }}
                    >
                      {header.year !== currentYear ? `${header.year}년 ` : ''}{header.month}월
                    </div>
                  );
                })}
                
                {/* 요일 헤더 (왼쪽 열) */}
                {['월', '화', '수', '목', '금', '토', '일'].map((weekdayName, weekdayIdx) => (
                  <div
                    key={`header-${weekdayIdx}`}
                    className="flex items-center justify-center text-gray-100 dark:text-gray-100 font-semibold"
                    style={{
                      gridRow: weekdayIdx + 2,
                      gridColumn: 1,
                      fontSize: '12px',
                      backgroundColor: '#374151',
                      borderRadius: '6px'
                    }}
                  >
                    {weekdayName}
                  </div>
                ))}
                
                {/* 주별 날짜 열들 */}
                {weeks.map((week, weekIdx) => {
                  return week.map((cell, weekdayIdx) => {
                    const { day, date, month, year } = cell;
                    const isChecked = isDateChecked(date, routineId);
                    const isToday = date === new Date().toISOString().split('T')[0];
                    const isSaturday = weekdayIdx === 5; // 토요일
                    const isSunday = weekdayIdx === 6; // 일요일
                    
                    // 배경색 결정: 체크됨 > 요일별 색상 > 기본
                    let backgroundColor = 'rgba(75, 85, 99, 0.15)'; // 기본 회색 (투명도 15%)
                    if (isChecked) {
                      // 체크된 날짜는 요일별로 다른 색상
                      if (isSaturday) {
                        backgroundColor = '#3B82F6'; // 토요일: 파란색
                      } else if (isSunday) {
                        backgroundColor = '#EF4444'; // 일요일: 빨간색
                      } else {
                        backgroundColor = '#9CA3AF'; // 월~금: 밝은 회색
                      }
                    } else if (isSaturday) {
                      backgroundColor = 'rgba(59, 130, 246, 0.15)'; // 토요일: 파란색 (투명도 15%)
                    } else if (isSunday) {
                      backgroundColor = 'rgba(239, 68, 68, 0.15)'; // 일요일: 붉은색 (투명도 15%)
                    }
                    
                    return (
                      <div
                        key={`${weekIdx}-${weekdayIdx}`}
                        style={{
                          gridRow: weekdayIdx + 2,
                          gridColumn: weekIdx + 2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          position: 'relative'
                        }}
                      >
                        {/* 날짜 셀 */}
                        <div
                          className={`
                            flex items-center justify-center relative shrink-0
                            cursor-pointer
                            transition-all duration-200 ease-in-out
                            hover:scale-110 hover:shadow-lg hover:brightness-150 hover:z-10 hover:ring-2 hover:ring-blue-400
                          `}
                          style={{
                            width: '37px',
                            height: '32px',
                            backgroundColor: backgroundColor,
                            borderRadius: '6px',
                            color: isChecked ? '#FFFFFF' : '#E5E7EB',
                            fontSize: '14px',
                            fontWeight: isChecked ? '700' : '500',
                            border: isToday 
                              ? '2px solid #60A5FA'
                              : 'none',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                            userSelect: 'none',
                            position: 'relative',
                            zIndex: 2
                          }}
                          onClick={() => {
                            if (editModeRoutine === routineId) {
                              handleDateToggle(date, routineId);
                            }
                          }}
                          title={
                            `${year}년 ${month}월 ${day}일${isChecked ? ' (체크됨)' : ''}${editModeRoutine === routineId ? ' - 클릭하여 체크/언체크' : ' - 수정 버튼을 눌러 편집'}`
                          }
                        >
                          {/* 날짜 숫자 */}
                          <span>{day}</span>
                        </div>
                      </div>
                    );
                  });
                })}
              </div>
            );
          })()}
        </div>
      </div>
      
      <FooterNav onAIAgentClick={() => setIsAIAgentOpen(true)} />
    </div>
  );
}