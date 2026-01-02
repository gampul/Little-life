'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { getSupabase } from '../../lib/supabase';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';

// 원형 그래프 컴포넌트
function CircularProgressChart({ 
  progress, 
  size = 60
}: { 
  progress: number; 
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  
  // 달성률에 따른 색상 결정
  const getColor = (progress: number) => {
    if (progress >= 80) return '#10B981'; // green
    if (progress >= 60) return '#3B82F6'; // blue
    if (progress >= 40) return '#F59E0B'; // amber
    if (progress >= 20) return '#EF4444'; // red
    return '#9CA3AF'; // gray
  };

  const color = getColor(progress);

  return (
    <div 
      className="relative flex items-center justify-center" 
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* 배경 원 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-gray-200 dark:text-gray-700"
        />
        {/* 진행률 원 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* 달성률 텍스트 (중앙) */}
      <div 
        className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-medium pointer-events-none"
        style={{ color }}
      >
        {Math.round(progress)}%
      </div>
    </div>
  );
}

// 루틴 아이템 컴포넌트
function RoutineItemWithChart({
  template,
  index,
  progress,
  onUpdate,
  onMove,
  onDelete,
  canMoveUp,
  canMoveDown,
}: {
  template: RoutineTemplate;
  index: number;
  progress: number;
  onUpdate: (index: number, field: 'label' | 'type' | 'unit', value: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDelete: (index: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="bg-[rgb(254,252,247)] dark:bg-gray-700 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 sm:gap-3 mb-2">
        {/* 원형 그래프 */}
        <div className="flex-shrink-0">
          <CircularProgressChart 
            progress={progress} 
            size={48}
          />
        </div>
        <input
          type="text"
          value={template.label}
          onChange={(e) => onUpdate(index, 'label', e.target.value)}
          className="flex-1 min-w-0 px-2 sm:px-3 py-1 text-sm sm:text-base bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded min-h-[40px] sm:min-h-[44px]"
          placeholder="루틴 이름"
        />
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button
            onClick={() => onMove(index, 'up')}
            disabled={!canMoveUp}
            className="p-1 sm:px-1.5 text-sm text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 min-h-[36px] sm:min-h-[40px] min-w-[28px] sm:min-w-[32px]"
            title="위로"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(index, 'down')}
            disabled={!canMoveDown}
            className="p-1 sm:px-1.5 text-sm text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 min-h-[36px] sm:min-h-[40px] min-w-[28px] sm:min-w-[32px]"
            title="아래로"
          >
            ↓
          </button>
          <button
            onClick={() => onDelete(index)}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white rounded min-h-[36px] sm:min-h-[40px] whitespace-nowrap"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </div>
      {/* 타입 선택 */}
      <div className="flex flex-col gap-2 pl-14">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">타입:</span>
          <div className="flex gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`type-${template.id}`}
                checked={template.type === 'checkbox'}
                onChange={() => onUpdate(index, 'type', 'checkbox')}
                className="w-4 h-4"
              />
              <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">체크박스</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`type-${template.id}`}
                checked={template.type === 'number'}
                onChange={() => onUpdate(index, 'type', 'number')}
                className="w-4 h-4"
              />
              <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">숫자</span>
            </label>
          </div>
        </div>
        
        {/* 숫자 타입일 때 단위 선택 */}
        {template.type === 'number' && (
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">단위:</span>
            <select
              value={template.unit || ''}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '__custom__') {
                  const customUnit = prompt('새로운 단위를 입력하세요:');
                  if (customUnit && customUnit.trim()) {
                    onUpdate(index, 'unit', customUnit.trim());
                  }
                } else {
                  onUpdate(index, 'unit', value);
                }
              }}
              className="px-2 py-1 text-xs sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">단위 없음</option>
              <option value="분">분</option>
              <option value="Km">Km</option>
              <option value="원">원</option>
              <option value="__custom__">+ 직접 입력</option>
            </select>
            {template.unit && !['분', 'Km', '원'].includes(template.unit) && (
              <span className="text-xs text-gray-500 dark:text-gray-400">({template.unit})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  field_key: string;
  sort_order: number;
  type: 'checkbox' | 'number';
  unit?: string;
}

export default function SettingsPage() {
  const supabase = getSupabase();
  const userId = 'default_user';
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [routineProgress, setRoutineProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // 루틴 템플릿 로드
  const loadRoutineTemplates = useCallback(async () => {
    if (!supabase) return;
    try {
      // type, unit 컬럼 포함하여 조회 시도
      let { data, error } = await supabase
        .from('routine_templates')
        .select('id, emoji, label, field_key, sort_order, user_id, type, unit')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      // type 또는 unit 컬럼이 없는 경우 재시도
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ type 또는 unit 컬럼이 없습니다. 마이그레이션 없이 계속 진행합니다.');
        const result = await supabase
          .from('routine_templates')
          .select('id, emoji, label, field_key, sort_order, user_id')
          .eq('user_id', userId)
          .order('sort_order', { ascending: true });
        
        // type, unit 필드 추가
        data = (result.data || []).map(t => ({ ...t, type: 'checkbox' as const, unit: undefined }));
        error = result.error;
      }

      if (error) {
        console.error('루틴 템플릿 조회 오류');
        if (error?.message) console.error('- 메시지:', error.message);
        if (error?.code) console.error('- 코드:', error.code);
        if (error?.details) console.error('- 상세:', error.details);
        if (error?.hint) console.error('- 힌트:', error.hint);
        return;
      }

      // type, unit 필드가 없는 경우 기본값 설정
      const templatesWithType = (data || []).map(t => ({
        ...t,
        type: t.type || 'checkbox' as 'checkbox' | 'number',
        unit: t.unit || undefined
      }));
      setRoutineTemplates(templatesWithType);
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadRoutineTemplates();
  }, [loadRoutineTemplates]);

  // 현재 월의 루틴 달성률 계산
  const loadRoutineProgress = useCallback(async () => {
    if (!supabase || routineTemplates.length === 0) return;
    
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      // 현재 월의 모든 날짜 생성
      const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
      const monthDates: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        monthDates.push(dateStr);
      }

      // 루틴 템플릿 ID 목록 추출
      const routineIds = routineTemplates.map(t => t.id);
      
      if (routineIds.length === 0) {
        setRoutineProgress({});
        return;
      }

      // 현재 월의 루틴 체크 데이터 가져오기
      // routine_id가 템플릿 ID 목록에 포함된 것만 조회
      // 먼저 모든 체크 데이터를 조회해서 확인
      const { data: allChecks, error: allChecksError } = await supabase
        .from('daily_routine_checks')
        .select('date, routine_id, checked')
        .in('date', monthDates)
        .eq('checked', true);

      if (allChecksError && allChecksError.code !== 'PGRST116') {
        console.error('루틴 진행률 조회 오류:', allChecksError);
        return;
      }

      // 디버깅: 조회된 데이터 확인
      console.log('=== 루틴 진행률 계산 디버깅 ===');
      console.log('현재 월:', currentYear, currentMonth);
      console.log('월 전체 체크 데이터 (필터링 전):', allChecks);
      console.log('루틴 템플릿 IDs:', routineTemplates.map(t => ({ id: t.id, label: t.label })));
      console.log('루틴 ID 목록:', routineIds);
      
      // routine_id로 필터링
      const checks = allChecks?.filter(c => routineIds.includes(c.routine_id)) || [];
      console.log('필터링된 체크 데이터:', checks);
      
      // 각 routine_id별로 몇 개의 체크가 있는지 확인
      const checksByRoutineId: Record<string, number> = {};
      allChecks?.forEach(c => {
        checksByRoutineId[c.routine_id] = (checksByRoutineId[c.routine_id] || 0) + 1;
      });
      console.log('routine_id별 체크 개수:', checksByRoutineId);

      // 루틴별 달성률 계산
      const progress: Record<string, number> = {};
      routineTemplates.forEach(template => {
        const matchingChecks = checks?.filter(c => c.routine_id === template.id) || [];
        const checkedCount = matchingChecks.length;
        const progressPercent = daysInMonth > 0 ? (checkedCount / daysInMonth) * 100 : 0;
        progress[template.id] = Math.min(100, Math.max(0, progressPercent));
        
        // 디버깅: 각 루틴별 계산 결과
        console.log(`루틴 "${template.label}" (ID: ${template.id}):`, {
          checkedCount,
          daysInMonth,
          progressPercent: progressPercent.toFixed(2) + '%',
          matchingChecks: matchingChecks.length > 0 ? matchingChecks.map(c => c.date) : '없음'
        });
      });

      setRoutineProgress(progress);
    } catch (err) {
      console.error('루틴 진행률 계산 오류:', err);
    }
  }, [supabase, routineTemplates]);

  useEffect(() => {
    if (routineTemplates.length > 0) {
      loadRoutineProgress();
    }
  }, [loadRoutineProgress]);

  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // IMPORTANT:
      // 기존 구현은 routine_templates를 통째로 DELETE 후 INSERT 해서,
      // (FK + ON DELETE CASCADE가 있으면) daily_routine_checks까지 같이 삭제될 수 있음.
      // 그래서 "id 유지 + upsert"로 변경해 기존 기록을 보존한다.

      // 1) 현재 DB에 저장된 템플릿 id 목록
      const { data: existingTemplates, error: existingError } = await supabase
        .from('routine_templates')
        .select('id')
        .eq('user_id', userId);

      if (existingError && existingError.code !== 'PGRST116') {
        console.error('루틴 템플릿 기존 목록 조회 오류:', existingError);
        throw existingError;
      }

      const existingIds = new Set((existingTemplates || []).map((t: any) => t.id));

      // 2) 현재 화면 상태 기반 payload 생성 (sort_order 재계산)
      const templatesPayload: any[] = routineTemplates.map((t, index) => ({
        id: t.id, // id 유지가 핵심
        user_id: userId,
        emoji: t.emoji,
        label: t.label,
        field_key: t.field_key,
        sort_order: index,
        type: t.type || 'checkbox',
        unit: t.unit || null,
      }));

      // 3) upsert (id 기준). 컬럼/제약이 없는 구버전 DB는 기존 fallback 로직으로 처리
      let { error: upsertError } = await supabase
        .from('routine_templates')
        .upsert(templatesPayload, { onConflict: 'id' });

      if (upsertError && (upsertError.message.includes('column') || upsertError.code === '42703')) {
        console.warn('⚠️ type/unit 컬럼 또는 onConflict 제약이 없을 수 있어 fallback으로 재시도합니다.');

        // unit이 없는 경우: unit 제거하고 upsert 재시도
        if (upsertError.message.includes('unit')) {
          const payloadNoUnit = routineTemplates.map((t, index) => ({
            id: t.id,
            user_id: userId,
            emoji: t.emoji,
            label: t.label,
            field_key: t.field_key,
            sort_order: index,
            type: t.type || 'checkbox',
          }));

          const result = await supabase
            .from('routine_templates')
            .upsert(payloadNoUnit, { onConflict: 'id' });
          upsertError = result.error;
        } else if (upsertError.message.includes('type')) {
          // type이 없는 경우: type, unit 모두 제거하고 upsert 재시도
          const payloadBasic = routineTemplates.map((t, index) => ({
            id: t.id,
            user_id: userId,
            emoji: t.emoji,
            label: t.label,
            field_key: t.field_key,
            sort_order: index,
          }));

          const result = await supabase
            .from('routine_templates')
            .upsert(payloadBasic, { onConflict: 'id' });
          upsertError = result.error;
        }
      }

      // onConflict가 id로 안 잡히는 스키마(예: PK가 다른 경우) 대비: user_id + field_key로도 한 번 더 시도
      if (upsertError && (upsertError.message.includes('duplicate key') || upsertError.message.includes('on conflict'))) {
        console.warn('⚠️ id onConflict 실패. user_id,field_key로 재시도합니다.');
        const result = await supabase
          .from('routine_templates')
          .upsert(templatesPayload, { onConflict: 'user_id,field_key' });
        upsertError = result.error;
      }

      if (upsertError) {
        console.error('=== upsert 에러 상세 ===');
        console.error('메시지:', upsertError.message);
        console.error('코드:', upsertError.code);
        console.error('상세:', upsertError.details);
        console.error('힌트:', upsertError.hint);
        throw upsertError;
      }

      // 4) 화면에서 제거된 템플릿만 선택적으로 삭제 (이 경우에만 관련 체크 데이터 삭제가 발생할 수 있음)
      const currentIds = new Set(routineTemplates.map(t => t.id));
      const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));

      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('routine_templates')
          .delete()
          .eq('user_id', userId)
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('선택 삭제 오류:', deleteError);
          throw deleteError;
        }
      }

      setMessage('✅ 저장되었습니다!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('=== 최종 에러 캐치 ===');
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (err?.message) {
        errorMessage = err.message;
      }
      
      setMessage(`❌ 저장 실패: ${errorMessage}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = (index: number, field: 'label' | 'type' | 'unit', value: string) => {
    const updated = [...routineTemplates];
    updated[index] = { ...updated[index], [field]: value };
    setRoutineTemplates(updated);
  };

  const handleDelete = (index: number) => {
    setRoutineTemplates(routineTemplates.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    if (routineTemplates.length >= 12) {
      setMessage('⚠️ 루틴은 최대 12개까지만 추가할 수 있습니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    const newFieldKey = `routine_${Date.now()}`;
    const newId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `routine_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setRoutineTemplates([
      ...routineTemplates,
      {
        id: newId,
        emoji: '✅',
        label: '새 루틴',
        field_key: newFieldKey,
        sort_order: routineTemplates.length,
        type: 'checkbox',
      },
    ]);
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newTemplates = [...routineTemplates];
    if (direction === 'up' && index > 0) {
      [newTemplates[index], newTemplates[index - 1]] = [newTemplates[index - 1], newTemplates[index]];
    } else if (direction === 'down' && index < newTemplates.length - 1) {
      [newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]];
    }
    setRoutineTemplates(newTemplates);
  };

  if (!supabase) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-[480px] w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
          <h2 className="text-xl font-bold text-red-800 dark:text-red-400 mb-4">
            ⚠️ 환경 변수 오류
          </h2>
          <p className="text-red-700 dark:text-red-300">
            Supabase 환경 변수가 설정되지 않았습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
      <GlobalNav />
      
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">⚙️ 설정</h2>
          </div>

          {/* 테마 설정 */}
          <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">테마</h3>
              <div className="flex items-center gap-2 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all min-h-[40px] ${
                    mounted && theme === 'light'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : 'hover:bg-gray-300/50 dark:hover:bg-gray-600/50'
                  }`}
                  aria-label="화이트 모드"
                >
                  <span className="text-base">☀️</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">라이트</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all min-h-[40px] ${
                    mounted && theme === 'dark'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : 'hover:bg-gray-300/50 dark:hover:bg-gray-600/50'
                  }`}
                  aria-label="다크 모드"
                >
                  <span className="text-base">🌙</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">다크</span>
                </button>
              </div>
            </div>
          </div>

          {/* 루틴 설정 */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                루틴 설정 ({routineTemplates.length}/12)
              </h3>
              <button
                onClick={handleAdd}
                disabled={routineTemplates.length >= 12}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm rounded-lg transition-colors min-h-[36px] sm:min-h-[44px] whitespace-nowrap flex-shrink-0 ${
                  routineTemplates.length >= 12
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                + 추가
              </button>
            </div>

            <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
              {routineTemplates.map((template, index) => {
                const progress = routineProgress[template.id] || 0;
                return (
                  <RoutineItemWithChart
                    key={template.id}
                    template={template}
                    index={index}
                    progress={progress}
                    onUpdate={handleUpdate}
                    onMove={handleMove}
                    onDelete={handleDelete}
                    canMoveUp={index > 0}
                    canMoveDown={index < routineTemplates.length - 1}
                  />
                );
              })}
            </div>

            {routineTemplates.length === 0 && (
              <div className="text-center text-sm sm:text-base text-gray-400 dark:text-gray-500 py-6 sm:py-8">
                루틴이 없습니다. 추가 버튼을 눌러 루틴을 추가하세요.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full px-4 py-2.5 sm:py-3 text-sm sm:text-base bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>

            {message && (
              <div className={`mt-2 sm:mt-3 text-xs sm:text-sm text-center ${message.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <FooterNav />
    </div>
  );
}

