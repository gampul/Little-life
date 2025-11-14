'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  
  // 루틴 관련 상태
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [routineChecks, setRoutineChecks] = useState<RoutineCheck[]>([]);
  const [isRoutineSettingOpen, setIsRoutineSettingOpen] = useState(false);
  const [isAIAgentOpen, setIsAIAgentOpen] = useState(false);

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

  // 월별 달성 현황 데이터
  const getMonthlyAchievement = async () => {
    if (!supabase) return [];
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const result = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      
      // 해당 날짜의 루틴 체크 로드
      const { data: checks } = await supabase
        .from('daily_routine_checks')
        .select('routine_id, checked')
        .eq('date', dateStr);
      
      result.push({
        day,
        checks: checks || []
      });
    }
    
    return result;
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
                <RoutineItem
                  key={routine.id}
                  emoji={routine.emoji}
                  label={routine.label}
                  checked={isRoutineChecked(routine.id)}
                  onChange={() => handleRoutineCheckChange(routine.id)}
                  disabled={!isEditMode}
                  isLast={index === routineTemplates.length - 1}
                />
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

            {/* 2. 월별 달성 현황 표 */}
            <MonthlyAchievementTable
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              routineTemplates={routineTemplates}
              isMonthExpanded={isMonthExpanded}
              setIsMonthExpanded={setIsMonthExpanded}
              onDateSelect={(date) => {
                setSelectedDate(date);
                setIsEditMode(true);
              }}
            />

            {/* 3. 일별 메모 보기 */}
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
}: {
  emoji: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
  isLast?: boolean;
}) {
  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer py-3 min-h-[52px]">
        <span className="text-2xl">{emoji}</span>
        <span className={`flex-1 text-base ${checked ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
          {label}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="w-6 h-6 text-blue-500 bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        />
      </label>
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

// 월별 달성 현황 테이블 컴포넌트
function MonthlyAchievementTable({
  selectedMonth,
  setSelectedMonth,
  routineTemplates,
  isMonthExpanded,
  setIsMonthExpanded,
  onDateSelect,
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  routineTemplates: RoutineTemplate[];
  isMonthExpanded: boolean;
  setIsMonthExpanded: (expanded: boolean) => void;
  onDateSelect?: (date: string) => void;
}) {
  const [checkedDates, setCheckedDates] = useState<Record<string, Set<string>>>({});
  const [editModeRoutine, setEditModeRoutine] = useState<string | null>(null);
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
      if (supabase) {
        try {
          const threeMonths = getThreeMonths();
          const allDates: string[] = [];
          
          for (const { year, month } of threeMonths) {
            const daysInMonth = new Date(year, month, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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

  // 연속된 날짜 배열 생성 (빈 칸 없이 여러 달 포함)
  const getContinuousDateGrid = (startYear: number, startMonth: number, numGrids: number = 3) => {
    const grids: Array<Array<{ day: number | null; date: string | null; month: number | null; year: number | null }>> = [];
    
    // 시작 날짜 계산
    let currentDate = new Date(startYear, startMonth - 1, 1);
    
    // 여러 그리드 생성 (각 그리드는 98개 셀)
    for (let gridIdx = 0; gridIdx < numGrids; gridIdx++) {
      const grid: Array<{ day: number | null; date: string | null; month: number | null; year: number | null }> = [];
      
      // 98개 셀 채우기 (7행 × 14열)
      for (let i = 0; i < 98; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const day = currentDate.getDate();
        
        grid.push({
          day,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          month,
          year
        });
        
        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      grids.push(grid);
    }
    
    return grids;
  };

  // 날짜 포맷팅 (월 표시용)
  const formatDateLabel = (year: number, month: number, day: number) => {
    // 날짜만 표시 (월은 필요시 별도 표시)
    return day;
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

  // 진행률에 따른 색상 계산 (0% = 회색, 100% = 진한 보라색 #8B5CF6)
  const getProgressColor = (progress: number) => {
    if (progress === 0) {
      return 'bg-gray-400';
    }
    // 보라색 그라데이션: progress에 따라 농도 조절 (#8B5CF6 = purple-500/violet-500)
    const opacity = Math.min(progress / 100, 1);
    if (opacity < 0.3) {
      return 'bg-violet-400';
    } else if (opacity < 0.6) {
      return 'bg-violet-500'; // #8B5CF6에 가장 가까운 색상
    } else if (opacity < 0.8) {
      return 'bg-violet-600';
    } else {
      return 'bg-violet-700';
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-4 shadow-sm max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">캘린더</h3>
      </div>
      
      <div className="space-y-8">
        {routineTemplates.map((routine) => {
          const threeMonths = getThreeMonths();
          const consecutiveDays = getConsecutiveDays(routine.id);
          
          return (
            <div key={routine.id} className="border-b border-gray-200 dark:border-gray-700 pb-8 last:border-b-0 last:pb-0 relative">
              {/* 루틴 제목 + 연속 체크 수 */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{routine.emoji}</span>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">{routine.label}</h4>
                {consecutiveDays > 0 && (
                  <div className="px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-medium rounded-full">
                    {consecutiveDays}일 연속
                  </div>
                )}
              </div>
              
              {/* 우측 수정 버튼 */}
              <button
                onClick={() => setEditModeRoutine(editModeRoutine === routine.id ? null : routine.id)}
                className="absolute top-0 right-0 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 hover:scale-105"
              >
                {editModeRoutine === routine.id ? '저장' : '수정'}
              </button>
              
              {/* 연속 날짜 캘린더 (가로 스크롤) */}
              <div className="space-y-3">
                {/* 현재 달 표시 */}
                <div className="flex items-center gap-3">
                  <h5 className="text-base font-medium text-gray-900 dark:text-white text-left shrink-0">
                    {currentYear}년 {currentMonth}월
                  </h5>
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[200px]">
                    <div
                      className="h-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${getMonthProgress(currentYear, currentMonth, routine.id)}%`,
                        backgroundColor: getMonthProgress(currentYear, currentMonth, routine.id) > 0 
                          ? `rgba(139, 92, 246, ${Math.min(getMonthProgress(currentYear, currentMonth, routine.id) / 100, 1)})` 
                          : '#9CA3AF'
                      }}
                    />
                  </div>
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
                    <div
                      className="w-full h-full transition-all duration-500 ease-out"
                      style={{ 
                        backgroundColor: getMonthProgress(currentYear, currentMonth, routine.id) > 0 ? '#8B5CF6' : '#9CA3AF',
                        opacity: getMonthProgress(currentYear, currentMonth, routine.id) > 0 ? 1 : 0.3 
                      }}
                    />
                  </div>
                </div>
                
                {/* 가로 스크롤 가능한 캘린더 컨테이너 */}
                <div 
                  className="overflow-x-auto overflow-y-hidden"
                  style={{
                    width: '100%',
                    maxWidth: '882px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#6B7280 #3A3A3C'
                  }}
                >
                  <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                    {(() => {
                      // 시작 날짜: 현재 달 기준 1개월 전 (과거 기록도 볼 수 있도록)
                      const startDate = new Date(currentYear, currentMonth - 2, 1);
                      const startYear = startDate.getFullYear();
                      const startMonth = startDate.getMonth() + 1;
                      
                      // 총 3개 그리드 생성 (각 그리드 = 98일 = 약 3.2개월, 총 약 9.6개월)
                      const numGrids = 3;
                      const grids = getContinuousDateGrid(startYear, startMonth, numGrids);
                      
                      // 모든 그리드를 하나의 배열로 병합하여 월 변경 감지
                      const allDates = grids.flat();
                      
                      return grids.map((grid, gridIdx) => {
                        // 그리드를 7행 × 14열로 변환
                        const rows: Array<Array<{ day: number | null; date: string | null; month: number | null; year: number | null; globalIndex: number }>> = [];
                        for (let i = 0; i < 7; i++) {
                          const row: Array<{ day: number | null; date: string | null; month: number | null; year: number | null; globalIndex: number }> = [];
                          for (let j = 0; j < 14; j++) {
                            const index = i * 14 + j;
                            const globalIndex = gridIdx * 98 + index;
                            const cell = grid[index] || { day: null, date: null, month: null, year: null };
                            row.push({ ...cell, globalIndex });
                          }
                          rows.push(row);
                        }
                        
                        return (
                          <div
                            key={gridIdx}
                            className="shrink-0"
                            style={{
                              width: '882px',
                              height: '370px',
                              backgroundColor: '#3A3A3C',
                              padding: '8px',
                              borderRadius: '8px',
                              display: 'grid',
                              gridTemplateColumns: 'repeat(14, 56px)',
                              gridTemplateRows: 'repeat(7, 48px)',
                              gap: '6px',
                              justifyContent: 'center'
                            }}
                          >
                            {rows.map((row, rowIdx) => (
                              row.map((cell, colIdx) => {
                                const { day, date, month, year, globalIndex } = cell;
                                const isChecked = date ? isDateChecked(date, routine.id) : false;
                                const isToday = date === new Date().toISOString().split('T')[0];
                                const isEmpty = day === null || date === null;
                                
                                // 월 변경 감지: 이전 날짜와 다른 월이거나, day가 1인 경우
                                let isMonthStart = false;
                                if (!isEmpty && day === 1) {
                                  // 첫 번째 셀이거나, 이전 셀이 다른 월인 경우
                                  if (globalIndex === 0) {
                                    isMonthStart = true;
                                  } else {
                                    const prevCell = allDates[globalIndex - 1];
                                    if (prevCell && (prevCell.month !== month || prevCell.year !== year)) {
                                      isMonthStart = true;
                                    }
                                  }
                                }
                                
                                return (
                                  <div
                                    key={`${gridIdx}-${rowIdx}-${colIdx}`}
                                    className={`
                                      flex items-center justify-center relative
                                      ${isEmpty ? '' : 'cursor-pointer'}
                                      transition-all duration-300 ease-in-out
                                      ${editModeRoutine === routine.id && !isEmpty ? 'hover:scale-105' : ''}
                                    `}
                                    style={{
                                      width: '56px',
                                      height: '48px',
                                      backgroundColor: isEmpty ? '#3A3A3C' : isChecked ? '#8B5CF6' : '#B8B0E5',
                                      borderRadius: '8px',
                                      color: isEmpty ? 'transparent' : isChecked ? '#FFFFFF' : '#1A1A1A',
                                      fontSize: '18px',
                                      fontWeight: '500',
                                      border: isToday ? '2px solid #3B82F6' : 'none',
                                      boxShadow: isChecked ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
                                      userSelect: 'none',
                                      position: 'relative'
                                    }}
                                    onClick={() => {
                                      if (!isEmpty && date && editModeRoutine === routine.id) {
                                        handleDateToggle(date, routine.id);
                                      }
                                    }}
                                    title={
                                      isEmpty 
                                        ? '' 
                                        : `${year}년 ${month}월 ${day}일${isChecked ? ' (체크됨)' : ''}${editModeRoutine === routine.id ? ' - 클릭하여 체크/언체크' : ' - 수정 버튼을 눌러 편집'}`
                                    }
                                  >
                                    {day !== null ? day : ''}
                                    {/* 월 시작 표시 (작은 점) */}
                                    {isMonthStart && (
                                      <div
                                        style={{
                                          position: 'absolute',
                                          top: '2px',
                                          right: '2px',
                                          width: '4px',
                                          height: '4px',
                                          backgroundColor: '#FFFFFF',
                                          borderRadius: '50%',
                                          opacity: 0.8
                                        }}
                                      />
                                    )}
                                  </div>
                                );
                              })
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
                
                {/* 스크롤 안내 */}
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                  ← 좌우로 스크롤하여 더 많은 날짜를 확인하세요 →
                </p>
              </div>
            </div>
          );
        })}
        
        {routineTemplates.length === 0 && (
          <div className="text-center text-gray-400 dark:text-gray-500 py-8">
            루틴을 추가해주세요
          </div>
        )}
      </div>
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