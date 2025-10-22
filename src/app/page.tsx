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
  housework: boolean;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  plank: boolean;
  okr_writing: boolean;
  reading: boolean;
  one_day_class: boolean;
  no_alcohol: boolean;
  running_walk: boolean;
  brush: boolean;
  love: boolean;
  cleaning: boolean;
  daily_memo: string;
}

type PeriodFilter = '7days' | '1month' | '1year' | 'ytd' | 'all';

export default function Home() {
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

  const [formData, setFormData] = useState<DailyRecord>({
    date: selectedDate,
    weight: null,
    housework: false,
    meal_breakfast: false,
    meal_lunch: false,
    meal_dinner: false,
    meal_memo: '',
    plank: false,
    okr_writing: false,
    reading: false,
    one_day_class: false,
    no_alcohol: false,
    running_walk: false,
    brush: false,
    love: false,
    cleaning: false,
    daily_memo: '',
  });

  useEffect(() => {
    loadDailyRecord(selectedDate);
    loadAllRecords();
  }, [selectedDate]);

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
          housework: false,
          meal_breakfast: false,
          meal_lunch: false,
          meal_dinner: false,
          meal_memo: '',
          plank: false,
          okr_writing: false,
          reading: false,
          one_day_class: false,
          no_alcohol: false,
          running_walk: false,
          brush: false,
          love: false,
          cleaning: false,
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
        setMessage('✅ 수정되었습니다!');
      } else {
        const { error } = await supabase
          .from('daily_records')
          .insert([formData]);

        if (error) throw error;
        setMessage('✅ 저장되었습니다!');
      }

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
  const getMonthlyAchievement = () => {
    const [year, month] = selectedMonth.split('-');
    const daysInMonth = new Date(
      parseInt(year),
      parseInt(month),
      0
    ).getDate();

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;
      const record = allRecords.find((r) => r.date === dateStr);
      return { day, record };
    });
  };

  // 메모가 있는 날짜만 가져오기
  const getMemoDates = () => {
    return allRecords
      .filter((r) => r.daily_memo && r.daily_memo.trim() !== '')
      .reverse();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-2xl mx-auto p-6">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            리틀 라이프
            <span className="text-2xl block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              Little-life
            </span>
          </h1>
          <p className="text-sm text-gray-400 mt-3">데일리 루틴을 지키며 하루를 힘차게 시작하자</p>
        </div>

        {/* 날짜 선택 */}
        <div className="mb-6">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-gray-800 text-white border border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>

        {/* 메시지 표시 */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-xl text-center text-sm font-medium ${
              message.includes('✅')
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}
          >
            {message}
          </div>
        )}

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

        {/* 데일리 루틴 */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-3">
          <RoutineItem
            emoji="📝"
            label="가계부 쓰기&이불정리"
            checked={formData.housework}
            onChange={() => handleCheckboxChange('housework')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🏋️"
            label="플랭크(3분)"
            checked={formData.plank}
            onChange={() => handleCheckboxChange('plank')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🔥"
            label="OKR 작성하기"
            checked={formData.okr_writing}
            onChange={() => handleCheckboxChange('okr_writing')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="📚"
            label="독서하기"
            checked={formData.reading}
            onChange={() => handleCheckboxChange('reading')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🎓"
            label="원데이 클래스"
            checked={formData.one_day_class}
            onChange={() => handleCheckboxChange('one_day_class')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🚫"
            label="금주하기"
            checked={formData.no_alcohol}
            onChange={() => handleCheckboxChange('no_alcohol')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🏃"
            label="러닝/산책하기"
            checked={formData.running_walk}
            onChange={() => handleCheckboxChange('running_walk')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🪥"
            label="양치질하기"
            checked={formData.brush}
            onChange={() => handleCheckboxChange('brush')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="💕"
            label="사랑 나누기"
            checked={formData.love}
            onChange={() => handleCheckboxChange('love')}
            disabled={!isEditMode}
          />
          <RoutineItem
            emoji="🧹"
            label="주변 청소하기"
            checked={formData.cleaning}
            onChange={() => handleCheckboxChange('cleaning')}
            disabled={!isEditMode}
            isLast={true}
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
            placeholder="오늘 하루를 자유롭게 기록해보세요..."
            disabled={!isEditMode}
            rows={4}
            className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 resize-none"
          />
        </div>

        {/* 식사 기록 */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            🍽️ 식사 기록
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
            placeholder="오늘 먹은 음식을 기록해보세요..."
            disabled={!isEditMode}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 resize-none"
          />
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3 mb-8">
          {isEditMode ? (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '저장하기'}
            </button>
          ) : (
            <button
              onClick={handleEdit}
              className="flex-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors duration-200"
            >
              수정하기
            </button>
          )}
          <button
            className="flex-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-semibold py-3.5 rounded-xl transition-colors duration-200"
            onClick={() => alert('AI 추천 기능은 곧 추가됩니다!')}
          >
            AI 추천받기
          </button>
        </div>

        {/* 시각화 섹션 */}
        <div className="border-t border-gray-700 pt-8">
          <h2 className="text-xl font-bold text-white mb-6">📊 데이터 분석</h2>

          {/* 1. 체중 추이 그래프 */}
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">체중 추이</h3>
              <div className="flex gap-2">
                {(['7days', '1month', '1year', 'ytd', 'all'] as PeriodFilter[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => setWeightPeriod(period)}
                    className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                      weightPeriod === period
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {period === '7days' && '7일'}
                    {period === '1month' && '1개월'}
                    {period === '1year' && '1년'}
                    {period === 'ytd' && 'YTD'}
                    {period === 'all' && '전체'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-64">
              {getWeightChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getWeightChartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tick={{ fontSize: 12 }}
                      domain={['dataMin - 2', 'dataMax + 2']}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1F2937', 
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        color: '#fff'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="#3B82F6" 
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  체중 데이터가 없습니다
                </div>
              )}
            </div>
          </div>

          {/* 2. 월별 달성 현황 표 */}
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-2 text-gray-400 font-medium">날짜</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">📝</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🏋️</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🔥</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">📚</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🎓</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🚫</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🏃</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🪥</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">💕</th>
                    <th className="text-center py-2 px-1 text-gray-400 font-medium">🧹</th>
                  </tr>
                </thead>
                <tbody>
                  {getMonthlyAchievement().map(({ day, record }) => (
                    <tr key={day} className="border-b border-gray-700/50">
                      <td className="py-2 px-2 text-gray-300">{day}일</td>
                      <td className="text-center py-2 px-1">
                        {record?.housework ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.plank ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.okr_writing ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.reading ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.one_day_class ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.no_alcohol ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.running_walk ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.brush ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.love ? '✓' : '-'}
                      </td>
                      <td className="text-center py-2 px-1">
                        {record?.cleaning ? '✓' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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
      {!isLast && <div style={{ height: '1mm', backgroundColor: '#374151' }}></div>}
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