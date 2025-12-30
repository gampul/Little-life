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
  onUpdate: (index: number, field: 'label', value: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDelete: (index: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  return (
    <div className="bg-[rgb(254,252,247)] dark:bg-gray-700 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 sm:gap-3">
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
    </div>
  );
}

interface RoutineTemplate {
  id: string;
  emoji: string;
  label: string;
  field_key: string;
  sort_order: number;
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
      // 기존 템플릿 삭제
      const { error: deleteError } = await supabase
        .from('routine_templates')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('=== 삭제 에러 상세 ===');
        console.error('메시지:', deleteError.message);
        console.error('코드:', deleteError.code);
        console.error('상세:', deleteError.details);
        console.error('힌트:', deleteError.hint);
        throw deleteError;
      }

      // 새 템플릿 삽입
      if (routineTemplates.length > 0) {
        const templatesToInsert = routineTemplates.map((t, index) => ({
          user_id: userId,
          emoji: t.emoji,
          label: t.label,
          field_key: t.field_key,
          sort_order: index,
        }));

        const { error: insertError } = await supabase
          .from('routine_templates')
          .insert(templatesToInsert);

        if (insertError) {
          console.error('=== 삽입 에러 상세 ===');
          console.error('메시지:', insertError.message);
          console.error('코드:', insertError.code);
          console.error('상세:', insertError.details);
          console.error('힌트:', insertError.hint);
          throw insertError;
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

  const handleUpdate = (index: number, field: 'label', value: string) => {
    const updated = [...routineTemplates];
    updated[index] = { ...updated[index], [field]: value };
    setRoutineTemplates(updated);
  };

  const handleDelete = (index: number) => {
    setRoutineTemplates(routineTemplates.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    const newFieldKey = `routine_${Date.now()}`;
    setRoutineTemplates([
      ...routineTemplates,
      {
        id: newFieldKey,
        emoji: '✅',
        label: '새 루틴',
        field_key: newFieldKey,
        sort_order: routineTemplates.length,
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
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 whitespace-nowrap">테마</h3>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-nowrap">화이트 모드</span>
                <button
                  onClick={() => setTheme('light')}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center min-h-[44px] transition-colors ${
                    mounted && theme === 'light'
                      ? 'bg-gray-900 dark:bg-gray-700 text-white'
                      : 'hover:bg-gray-500/20 dark:hover:bg-gray-400/20'
                  }`}
                  aria-label="화이트 모드"
                >
                  <span className="text-base">☀️</span>
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-nowrap">다크 모드</span>
                <button
                  onClick={() => setTheme('dark')}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center min-h-[44px] transition-colors ${
                    mounted && theme === 'dark'
                      ? 'bg-gray-900 dark:bg-gray-700 text-white'
                      : 'hover:bg-gray-500/20 dark:hover:bg-gray-400/20'
                  }`}
                  aria-label="다크 모드"
                >
                  <span className="text-base">🌙</span>
                </button>
              </div>
            </div>
          </div>

          {/* 루틴 설정 */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">루틴 설정</h3>
              <button
                onClick={handleAdd}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[36px] sm:min-h-[44px] whitespace-nowrap flex-shrink-0"
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

