'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

  useEffect(() => {
    loadRoutineTemplates();
  }, []);

  useEffect(() => {
    loadDailyRecord(selectedDate);
    loadRoutineChecks(selectedDate);
    loadAllRecords();
  }, [selectedDate]);

  // 루틴 템플릿 로드
  const loadRoutineTemplates = async () => {
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
  };

  // 특정 날짜의 루틴 체크 상태 로드
  const loadRoutineChecks = async (date: string) => {
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
  };

  const loadDailyRecord = async (date: string) => {
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
  };

  const loadAllRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_records')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('전체 데이터 조회 오류:', error);
        return;
      }

      setAllRecords(data || []);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  };

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
        return allRecords
          .filter((r) => r.weight !== null)
          .map((r) => ({
            date: r.date,
            weight: r.weight,
          }));
    }

    return allRecords
      .filter((r) => {
        const recordDate = new Date(r.date);
        return r.weight !== null && recordDate >= startDate;
      })
      .map((r) => ({
        date: r.date,
        weight: r.weight,
      }));
  };

  // 월별 달성 현황 데이터
  const getMonthlyAchievement = async () => {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Little Life
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAIAgentOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg"
            >
              🤖 AI Agent
            </button>
            <button
              onClick={() => setIsRoutineSettingOpen(true)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
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
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-3">
              <div className="flex gap-3 items-center">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {!isEditMode ? (
                  <button
                    onClick={handleEdit}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    수정하기
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? '저장 중...' : '저장'}
                  </button>
                )}
              </div>
              {message && (
                <div className="mt-3 text-center text-sm font-medium">{message}</div>
              )}
            </div>

            {/* 체중 입력 */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-2">
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
                className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
              />
            </div>

            {/* 데일리 루틴 - 동적으로 렌더링 */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-3">
              <h3 className="text-base font-semibold text-white mb-4">📋 데일리 루틴</h3>
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
                <div className="text-center text-gray-500 py-4">
                  루틴을 추가해주세요
                </div>
              )}
            </div>

            {/* 식사 기록 */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                🍽️ 오늘의 식사
              </label>
              <div className="flex gap-4 mb-3">
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
                className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 resize-none"
                rows={2}
              />
            </div>

            {/* 오늘의 메모 */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                📝 오늘의 메모
              </label>
              <textarea
                value={formData.daily_memo}
                onChange={(e) => handleInputChange('daily_memo', e.target.value)}
                placeholder="오늘 하루를 기록해보세요..."
                disabled={!isEditMode}
                className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 resize-none"
                rows={4}
              />
            </div>
          </div>

          {/* 오른쪽: 통계 섹션 */}
          <div>
            {/* 1. 체중 그래프 */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">체중 변화</h3>
                <select
                  value={weightPeriod}
                  onChange={(e) => setWeightPeriod(e.target.value as PeriodFilter)}
                  className="px-3 py-1.5 text-xs bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                      <p className="text-gray-500 text-sm">체중 데이터가 없습니다</p>
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
            />

            {/* 3. 일별 메모 보기 */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5">
              <h3 className="text-base font-semibold text-white mb-4">일별 메모</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {getMemoDates().length > 0 ? (
                  getMemoDates().map((record) => (
                    <div
                      key={record.id}
                      className="bg-gray-700/50 rounded-lg p-3 border border-gray-600"
                    >
                      <div className="text-xs text-gray-400 mb-1">{record.date}</div>
                      <div className="text-sm text-gray-200">{record.daily_memo}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
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
      <label className="flex items-center gap-3 cursor-pointer py-3">
        <span className="text-2xl">{emoji}</span>
        <span className={`flex-1 text-sm ${checked ? 'text-white font-medium' : 'text-gray-400'}`}>
          {label}
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="w-6 h-6 text-blue-500 bg-gray-700 border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        />
      </label>
      {!isLast && <div style={{ height: '0.5mm', backgroundColor: '#4B5563' }}></div>}
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
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-5 h-5 text-blue-500 bg-gray-700 border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      />
      <span className={`text-sm ${checked ? 'text-white font-medium' : 'text-gray-400'}`}>
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
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">⚙️ 루틴 설정</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-3 mb-6">
          {templates.map((template, index) => (
            <div key={template.id} className="flex items-center gap-3 bg-gray-700 rounded-lg p-3">
              <span className="text-gray-400 text-sm w-6">{index + 1}</span>
              <input
                type="text"
                value={template.emoji}
                onChange={(e) => handleUpdate(template.id, 'emoji', e.target.value)}
                className="w-12 px-2 py-1 text-center bg-gray-600 text-white border border-gray-500 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                maxLength={2}
              />
              <input
                type="text"
                value={template.label}
                onChange={(e) => handleUpdate(template.id, 'label', e.target.value)}
                className="flex-1 px-3 py-1 bg-gray-600 text-white border border-gray-500 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={() => handleDelete(template.id)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={handleAdd}
          className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors mb-4"
        >
          + 루틴 추가
        </button>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
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
}: {
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  routineTemplates: RoutineTemplate[];
  isMonthExpanded: boolean;
  setIsMonthExpanded: (expanded: boolean) => void;
}) {
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadMonthlyData();
  }, [selectedMonth, routineTemplates]);

  const loadMonthlyData = async () => {
    setIsLoading(true);
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const result = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      
      const { data: checks } = await supabase
        .from('daily_routine_checks')
        .select('routine_id, checked')
        .eq('date', dateStr);
      
      result.push({
        day,
        checks: checks || []
      });
    }
    
    setMonthlyData(result);
    setIsLoading(false);
  };

  const isChecked = (dayData: any, routineId: string) => {
    return dayData.checks.some((c: any) => c.routine_id === routineId && c.checked);
  };

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-white">월별 달성 현황</h3>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-3 py-1.5 text-xs bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
      
      {isLoading ? (
        <div className="text-center text-gray-500 py-8">로딩 중...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">날짜</th>
                  {routineTemplates.map(routine => (
                    <th key={routine.id} className="text-center py-2 px-1 text-gray-400 font-medium text-lg">
                      {routine.emoji}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData
                  .filter((_, index) => isMonthExpanded || index < 15)
                  .map((dayData) => (
                  <tr key={dayData.day} className="border-b border-gray-700/50">
                    <td className="py-2 px-2 text-gray-300">{dayData.day}일</td>
                    {routineTemplates.map(routine => (
                      <td key={routine.id} className="text-center py-2 px-1 text-green-400 font-bold">
                        {isChecked(dayData, routine.id) ? '✓' : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-center">
            <button
              onClick={() => setIsMonthExpanded(!isMonthExpanded)}
              className="px-4 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              {isMonthExpanded ? '접기 ▲' : '더보기 ▼'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// AI Agent 모달 컴포넌트
function AIAgentModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            🤖 AI Agent
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* AI Agent 설명 */}
        <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-xl p-6 mb-6 border border-purple-500/20">
          <h3 className="text-lg font-semibold text-white mb-3">✨ 나만의 AI 라이프 코치</h3>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            AI Agent가 당신의 일상을 종합적으로 분석하여 맞춤형 조언을 제공합니다.
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">⚖️</div>
              <div className="text-xs text-gray-400">체중 변화</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📋</div>
              <div className="text-xs text-gray-400">데일리 루틴</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">🍽️</div>
              <div className="text-xs text-gray-400">식사 기록</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">💰</div>
              <div className="text-xs text-gray-400">재무 상태</div>
              <div className="text-xs text-yellow-400 mt-1">준비중</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs text-gray-400">가계부</div>
              <div className="text-xs text-yellow-400 mt-1">준비중</div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">📝</div>
              <div className="text-xs text-gray-400">일기 분석</div>
            </div>
          </div>
        </div>

        {/* 개발 예정 기능 안내 */}
        <div className="bg-gray-700/30 rounded-xl p-6 border border-gray-600">
          <div className="text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-white mb-3">곧 만나요!</h3>
            <p className="text-gray-400 mb-6">
              AI Agent 기능은 현재 개발 중입니다.<br/>
              조만간 당신의 라이프 코치가 되어드릴게요!
            </p>
            
            <div className="bg-gray-800 rounded-lg p-4 text-left">
              <h4 className="text-sm font-semibold text-white mb-3">🎯 예정된 기능</h4>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>일주일 단위 루틴 달성률 분석 및 개선 제안</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>체중 변화 패턴 분석 및 건강 조언</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>식사 기록 기반 영양 밸런스 체크</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>재무 상태와 소비 패턴 분석 (개발 예정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>가계부 데이터 기반 절약 팁 제공 (개발 예정)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>일기 내용 감정 분석 및 멘탈 케어 조언</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400">▸</span>
                  <span>개인화된 주간/월간 리포트 자동 생성</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}