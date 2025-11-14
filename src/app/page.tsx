'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ThemeToggle } from './components/ThemeToggle';

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

  // Supabase 클라이언트를 런타임에만 초기화 (빌드 시점에는 환경 변수가 없을 수 있음)
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 디버깅: 환경 변수 상태 확인
    console.log('🔍 환경 변수 확인:');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ 설정됨' : '❌ 없음');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ 설정됨' : '❌ 없음');

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Missing Supabase environment variables.');
      console.error('설정된 URL:', supabaseUrl || '없음');
      console.error('설정된 Key:', supabaseAnonKey ? '있음 (길이: ' + supabaseAnonKey.length + ')' : '없음');
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);

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

  const [formData, setFormData] = useState<DailyRecord>({
    date: selectedDate,
    weight: null,
    meal_breakfast: false,
    meal_lunch: false,
    meal_dinner: false,
    meal_memo: '',
    daily_memo: '',
  });

  // 루틴 템플릿 로드
  const loadRoutineTemplates = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('routine_templates')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('루틴 템플릿 조회 오류:', error);
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
      const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .eq('date', date)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('데이터 조회 오류:', error);
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
      const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('전체 데이터 조회 오류:', error);
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

  const handleInputChange = (
    field: keyof DailyRecord,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    setIsSaving(true);
    setMessage('');

    try {
      // 1. daily_records 저장
      const { data: existingData } = await supabase
        .from('daily_records')
        .select('id')
        .eq('date', selectedDate)
        .single();

      if (existingData) {
        const { error } = await supabase
          .from('daily_records')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('date', selectedDate);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_records')
          .insert([formData]);

        if (error) throw error;
      }

      // 2. 루틴 체크 저장
      // 기존 데이터 삭제 후 재삽입
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

        if (checkError) throw checkError;
      }

      setMessage('✅ 저장되었습니다!');
      setIsEditMode(false);
      setHasData(true);
      loadAllRecords();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('저장 오류:', err);
      setMessage('❌ 저장에 실패했습니다.');
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


  // 메모가 있는 날짜 조회
  const getMemoDates = () => {
    return allRecords
      .filter((r) => r.daily_memo && r.daily_memo.trim() !== '')
      .reverse();
  };

  // 환경 변수 오류 표시
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
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
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto p-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Little Life
          </h1>
          <div className="flex gap-3">
            <ThemeToggle />
            <button
              onClick={() => setIsAIAgentOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg text-base min-h-[44px]"
              aria-label="AI Agent"
            >
              🤖 AI Agent
            </button>
            <button
              onClick={() => setIsRoutineSettingOpen(true)}
              className="px-4 py-2.5 bg-gray-600 dark:bg-gray-700 hover:bg-gray-500 dark:hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2 text-base min-h-[44px]"
              aria-label="루틴 설정"
            >
              ⚙️ 루틴 설정
            </button>
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 입력 섹션 */}
          <div>
            {/* 날짜 선택 & 버튼 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-3 shadow-sm">
              <div className="flex flex-col gap-3 items-stretch">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
                />
                {!isEditMode ? (
                  <button
                    onClick={handleEdit}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-medium rounded-lg transition-colors min-h-[44px]"
                  >
                    수정하기
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white text-base font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                )}
              </div>
              {message && (
                <div className="mt-3 text-center text-base font-medium text-gray-700 dark:text-gray-300">{message}</div>
              )}
            </div>

            {/* 체중 입력 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-3 shadow-sm">
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                ⚖️ 오늘의 체중 (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={formData.weight || ''}
                onChange={(e) =>
                  handleInputChange('weight', e.target.value ? parseFloat(e.target.value) : '')
                }
                placeholder="체중을 입력하세요"
                disabled={!isEditMode}
                className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 min-h-[44px]"
              />
            </div>

            {/* 데일리 루틴 - 동적으로 렌더링 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-3 shadow-sm">
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
                  />
                  {/* 확장된 루틴의 캘린더 표시 */}
                  {expandedRoutineId === routine.id && (
                    <div className="mt-4 pb-4">
                      <RoutineCalendar
                        routineId={routine.id}
                        routineLabel={routine.label}
                        routineEmoji={routine.emoji}
                        routineTemplates={routineTemplates}
                        isExpanded={true}
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
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-3 shadow-sm">
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

            {/* 오늘의 메모 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-3 shadow-sm">
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300 mb-3">
                📝 오늘의 메모
              </label>
              <textarea
                value={formData.daily_memo}
                onChange={(e) => handleInputChange('daily_memo', e.target.value)}
                placeholder="오늘 하루를 기록해보세요..."
                disabled={!isEditMode}
                className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 resize-none"
                rows={5}
              />
            </div>
          </div>

          {/* 오른쪽: 통계 섹션 */}
          <div>
            {/* 1. 체중 그래프 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mb-4 shadow-sm">
              <div className="flex flex-col items-start justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">체중 변화</h3>
                <select
                  value={weightPeriod}
                  onChange={(e) => setWeightPeriod(e.target.value as PeriodFilter)}
                  className="w-full px-4 py-2.5 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
                >
                  <option value="7days">최근 7일</option>
                  <option value="1month">1개월</option>
                  <option value="1year">1년</option>
                  <option value="ytd">연초부터</option>
                  <option value="all">전체</option>
                </select>
              </div>
              <div className="h-64">
                {getWeightChartData().length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={getWeightChartData()}
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
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
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <YAxis 
                        stroke="#6B7280"
                        tick={{ fontSize: 11, fill: '#9CA3AF' }}
                        tickLine={false}
                        axisLine={{ stroke: '#374151' }}
                        domain={['dataMin - 1', 'dataMax + 1']}
                        tickFormatter={(value) => `${value}kg`}
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
                        itemStyle={{ color: '#3B82F6', fontSize: '14px', fontWeight: 'bold' }}
                        formatter={(value: any) => [`${value} kg`, '체중']}
                        cursor={{ stroke: '#3B82F6', strokeWidth: 1, strokeDasharray: '5 5' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="weight" 
                        stroke="#3B82F6" 
                        strokeWidth={1}
                        dot={{ 
                          fill: '#3B82F6', 
                          strokeWidth: 2,
                          stroke: '#1F2937',
                          r: 3
                        }}
                        activeDot={{ 
                          r: 5, 
                          fill: '#3B82F6',
                          stroke: '#fff',
                          strokeWidth: 2
                        }}
                        fill="url(#colorWeight)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">체중 데이터가 없습니다</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. 일별 메모 보기 */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">일별 메모</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getMemoDates().length > 0 ? (
                  getMemoDates().map((record) => (
                    <div
                      key={record.id}
                      className="bg-white dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{record.date}</div>
                      <div className="text-base text-gray-700 dark:text-gray-200 leading-relaxed">{record.daily_memo}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                    작성된 메모가 없습니다
                  </div>
                )}
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
}: {
  emoji: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  isLast?: boolean;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 py-3 min-h-[52px]">
        {/* 확장/접기 버튼 */}
        <button
          onClick={onExpandToggle}
          disabled={!onExpandToggle}
          className="flex items-center justify-center w-6 h-6 shrink-0 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-transform"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          aria-label={isExpanded ? '접기' : '펼치기'}
        >
          <span className="text-lg">▶</span>
        </button>
        
        <span className="text-2xl">{emoji}</span>
        
        {/* 루틴 라벨 클릭 시 확장/접기 */}
        <button
          onClick={onExpandToggle}
          disabled={!onExpandToggle}
          className={`flex-1 text-left text-base ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'} disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-700 dark:hover:text-gray-200 transition-colors`}
        >
          {label}
        </button>
        
        {/* 체크박스 */}
        <label className="cursor-pointer shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            className="w-6 h-6 text-blue-500 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          />
        </label>
      </div>
      {!isLast && <div style={{ height: '0.5mm' }} className="bg-gray-200 dark:bg-gray-600"></div>}
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

  // Supabase 클라이언트를 런타임에만 초기화
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);

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
      await supabase
        .from('routine_templates')
        .delete()
        .eq('user_id', userId);

      // 새로운 템플릿 삽입
      const templatesToInsert = templates.map((t, index) => ({
        user_id: userId,
        emoji: t.emoji,
        label: t.label,
        field_key: t.field_key,
        sort_order: index + 1,
      }));

      const { error } = await supabase
        .from('routine_templates')
        .insert(templatesToInsert);

      if (error) throw error;

      alert('✅ 저장되었습니다!');
      onClose();
    } catch (err) {
      console.error('저장 오류:', err);
      alert('❌ 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl">
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

        <div className="space-y-3 mb-6">
          {templates.map((template, index) => (
            <div key={template.id} className="flex flex-col items-stretch gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
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
          ))}
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
}: {
  routineId: string;
  routineLabel: string;
  routineEmoji: string;
  routineTemplates: RoutineTemplate[];
  isExpanded?: boolean;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const [editModeRoutine, setEditModeRoutine] = useState<string | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Supabase 클라이언트 (기존 데이터 동기화용)
  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return null;
    }

    return createClient(supabaseUrl, supabaseAnonKey);
  }, []);

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

  const consecutiveDays = getConsecutiveDays(routineId);

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm w-full">
      {/* 루틴 제목 + 연속 체크 수 + 수정 버튼 */}
      <div className="flex items-center gap-2 mb-4 relative">
        <span className="text-2xl">{routineEmoji}</span>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">{routineLabel}</h4>
        {consecutiveDays > 0 && (
          <div className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium rounded-full">
            {consecutiveDays}일 연속
          </div>
        )}
        {/* 우측 수정 버튼 */}
        <button
          onClick={() => setEditModeRoutine(editModeRoutine === routineId ? null : routineId)}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 hover:scale-105 shadow-md"
        >
          {editModeRoutine === routineId ? '저장' : '수정'}
        </button>
      </div>
      
      {/* 현재 달 표시 */}
      <div className="flex items-center gap-3 mb-3">
        <h5 className="text-base font-medium text-gray-900 dark:text-white text-left shrink-0">
          {currentYear}년 {currentMonth}월
        </h5>
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[200px]">
          <div
            className="h-full bg-purple-500 transition-all duration-500 ease-out"
            style={{ 
              width: `${getMonthProgress(currentYear, currentMonth, routineId)}%`,
            }}
          />
        </div>
        <div className="w-3 h-3 rounded-full bg-purple-500 overflow-hidden shrink-0 shadow-sm" />
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
                            transition-all duration-300 ease-in-out
                            ${editModeRoutine === routineId ? 'hover:scale-110 hover:shadow-md' : ''}
                          `}
                          style={{
                            width: '37px',
                            height: '32px',
                            backgroundColor: isChecked ? '#8B5CF6' : '#4B5563',
                            borderRadius: '6px',
                            color: isChecked ? '#FFFFFF' : '#E5E7EB',
                            fontSize: '14px',
                            fontWeight: '500',
                            border: isToday 
                              ? '2px solid #60A5FA'
                              : isChecked 
                                ? 'none' 
                                : '1px solid #6B7280',
                            boxShadow: isChecked 
                              ? '0 2px 8px rgba(139, 92, 246, 0.4)' 
                              : '0 1px 2px rgba(0,0,0,0.1)',
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
      
      {/* 스크롤 안내 */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
        ← 좌우로 스크롤하여 더 많은 날짜를 확인하세요 →
      </p>
    </div>
  );
}

// AI Agent 모달 컴포넌트
function AIAgentModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            🤖 AI Agent
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* AI Agent 설명 */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 rounded-xl p-6 mb-6 border border-purple-200 dark:border-purple-500/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">✨ 나만의 AI 라이프 코치</h3>
          <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-4">
            AI Agent가 당신의 일상을 종합적으로 분석하여 맞춤형 조언을 제공합니다.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">⚖️</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">체중 변화</div>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">데일리 루틴</div>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">🍽️</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">식사 기록</div>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">재무 상태</div>
              <div className="text-xs text-yellow-400 dark:text-yellow-400 mt-1">준비중</div>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">가계부</div>
              <div className="text-xs text-yellow-400 dark:text-yellow-400 mt-1">준비중</div>
            </div>
            <div className="bg-white dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📝</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">일기 분석</div>
            </div>
          </div>
        </div>

        {/* 개발 예정 기능 안내 */}
        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
          <div className="text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">곧 만나요!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 text-base">
              AI Agent 기능은 현재 개발 중입니다.<br/>
              조만간 당신의 라이프 코치가 되어드릴게요!
            </p>
            
            <div className="bg-white dark:bg-gray-900 rounded-lg p-4 text-left border border-gray-200 dark:border-gray-700">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">🎯 예정된 기능</h4>
              <ul className="space-y-2 text-base text-gray-600 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>일주일 단위 루틴 달성률 분석 및 개선 제안</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>체중 변화 패턴 분석 및 건강 조언</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>식사 기록 기반 영양 밸런스 체크</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>재무 상태와 소비 패턴 분석 (개발 예정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>가계부 데이터 기반 절약 팁 제공 (개발 예정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>일기 내용 감정 분석 및 멘탈 케어 조언</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 dark:text-purple-400">▸</span>
                  <span>개인화된 주간/월간 리포트 자동 생성</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-white rounded-lg transition-colors min-h-[44px] text-base"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}