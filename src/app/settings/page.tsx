'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { getSupabase } from '../../lib/supabase';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { CategoryManager } from '../assets/components/CategoryManager';
import { APP_CONTENT_CONTAINER } from '../components/container';

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
  onSave,
  onDelete,
  canMoveUp,
  canMoveDown,
  isDirty,
  isSaving,
}: {
  template: RoutineTemplate;
  index: number;
  progress: number;
  onUpdate: (
    index: number,
    field: 'label' | 'type' | 'unit' | 'image_upload_enabled',
    value: string | boolean
  ) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onSave: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDirty: boolean;
  isSaving: boolean;
}) {
  return (
    <div className="bg-[rgb(254,252,247)] dark:bg-gray-700 rounded-lg p-1 sm:p-1.5 border border-gray-200 dark:border-gray-600">
      <div className="flex items-center gap-2 sm:gap-2 mb-1">
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
          className="flex-[1.5] min-w-0 px-2 sm:px-2.5 py-0 text-[11px] bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded min-h-[28px] sm:min-h-[30px]"
          placeholder="루틴 이름"
        />
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('저장 버튼 클릭:', { templateId: template.id, isDirty, isSaving });
              if (!isDirty) {
                console.warn('저장할 변경 사항이 없습니다.');
                return;
              }
              if (isSaving) {
                console.warn('이미 저장 중입니다.');
                return;
              }
              onSave(template.id);
            }}
            disabled={!isDirty || isSaving}
            className={`px-1.5 sm:px-2 py-0 text-[11px] rounded min-h-[26px] sm:min-h-[28px] whitespace-nowrap ${
              !isDirty || isSaving
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title={isDirty ? '저장' : '변경 없음'}
          >
            {isSaving ? '저장중' : '저장'}
          </button>
          <button
            onClick={() => onMove(index, 'up')}
            disabled={!canMoveUp}
            className="p-0 sm:px-0.5 text-sm text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 min-h-[22px] sm:min-h-[24px] min-w-[16px] sm:min-w-[18px]"
            title="위로"
          >
            ↑
          </button>
          <button
            onClick={() => onMove(index, 'down')}
            disabled={!canMoveDown}
            className="p-0 sm:px-0.5 text-sm text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 min-h-[22px] sm:min-h-[24px] min-w-[16px] sm:min-w-[18px]"
            title="아래로"
          >
            ↓
          </button>
          <button
            onClick={() => onDelete(template.id)}
            disabled={isSaving}
            className="px-1.5 sm:px-2 py-0 text-[11px] bg-red-500 hover:bg-red-600 text-white rounded min-h-[26px] sm:min-h-[28px] whitespace-nowrap"
            title="삭제"
          >
            삭제
          </button>
        </div>
      </div>
      {/* 타입 선택 */}
      <div className="pl-14">
          <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
          <div className="flex items-center gap-2 min-w-0 whitespace-nowrap">
            <span className="text-[11px] text-gray-600 dark:text-gray-400 shrink-0 whitespace-nowrap">타입:</span>
            <div className="flex gap-2 whitespace-nowrap">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`type-${template.id}`}
                  checked={template.type === 'checkbox'}
                  onChange={() => onUpdate(index, 'type', 'checkbox')}
                  className="w-4 h-4"
                />
                <span className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-nowrap">체크박스</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name={`type-${template.id}`}
                  checked={template.type === 'number'}
                  onChange={() => onUpdate(index, 'type', 'number')}
                  className="w-4 h-4"
                />
                <span className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-nowrap">숫자</span>
              </label>
            </div>
          </div>

          {/* 숫자 타입일 때 단위 선택 */}
          {template.type === 'number' && (
            <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
              <span className="text-[11px] text-gray-600 dark:text-gray-400">단위:</span>
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
                  className="w-[84px] sm:w-auto px-2 py-0 text-[11px] bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!!template.image_upload_enabled}
              onChange={(e) => onUpdate(index, 'image_upload_enabled', e.target.checked)}
              className="w-4 h-4"
              aria-label="사진업로드 사용"
            />
            <span className="text-[11px] text-gray-700 dark:text-gray-300 whitespace-nowrap">
              📷 사진업로드
            </span>
          </label>
        </div>
        {isDirty && (
          <div className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
            변경됨 (저장 필요)
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
  image_upload_enabled?: boolean;
}

export default function SettingsPage() {
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [message, setMessage] = useState('');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [routineProgress, setRoutineProgress] = useState<Record<string, number>>({});
  const [dirtyById, setDirtyById] = useState<Record<string, boolean>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [isRoutineSectionExpanded, setIsRoutineSectionExpanded] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [assetNames, setAssetNames] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, [supabase]);

  // 루틴 템플릿 로드
  const loadRoutineTemplates = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      // type, unit, deleted_at 컬럼 포함하여 조회 시도 (deleted_at은 soft delete 용)
      let { data, error } = await supabase
        .from('routine_templates')
        .select('id, emoji, label, field_key, sort_order, user_id, type, unit, deleted_at, image_upload_enabled')
        .eq('user_id', userId)
        .is('deleted_at', null)
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
        data = (result.data || []).map(t => ({ ...t, type: 'checkbox' as const, unit: undefined, deleted_at: null, image_upload_enabled: false }));
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
      const templatesWithType = (data || [])
        .filter((t: any) => !t.deleted_at)
        .map(t => ({
        ...t,
        type: t.type || 'checkbox' as 'checkbox' | 'number',
        unit: t.unit || undefined,
        image_upload_enabled: t.image_upload_enabled ?? false
      }));
      setRoutineTemplates(templatesWithType);
      setDirtyById(Object.fromEntries((templatesWithType || []).map(t => [t.id, false])));
    } catch (err) {
      console.error('예상치 못한 오류:', err);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadRoutineTemplates();
  }, [loadRoutineTemplates]);

  // 자산 이름 목록 로드 (카테고리 관리용)
  const loadAssetNames = useCallback(async () => {
    if (!supabase || !userId) return;
    try {
      const { data, error } = await supabase.rpc('get_asset_balances', {
        p_user_id: userId,
      });
      if (!error && data) {
        setAssetNames(data.map((item: { asset_name: string }) => item.asset_name));
      }
    } catch (err) {
      console.log('자산 이름 로드 오류:', err);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) {
      loadAssetNames();
    }
  }, [userId, loadAssetNames]);

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

  const upsertTemplates = async (templates: RoutineTemplate[]) => {
    if (!supabase) {
      throw new Error('Supabase 연결이 설정되지 않았습니다.');
    }
    if (!userId) {
      throw new Error('로그인 정보가 없습니다.');
    }

    try {
      const templatesPayload: any[] = templates.map((t, index) => ({
        id: t.id, // id 유지가 핵심
        user_id: userId,
        emoji: t.emoji,
        label: t.label,
        field_key: t.field_key,
        sort_order: index,
        type: t.type || 'checkbox',
        unit: t.unit || null,
        deleted_at: null,
        image_upload_enabled: t.image_upload_enabled ?? false,
      }));

      // 3) upsert (id 기준). 컬럼/제약이 없는 구버전 DB는 기존 fallback 로직으로 처리
      let { error: upsertError } = await supabase
        .from('routine_templates')
        .upsert(templatesPayload, { onConflict: 'id' });

      if (upsertError && (upsertError.message.includes('column') || upsertError.code === '42703')) {
        console.warn('⚠️ type/unit 컬럼 또는 onConflict 제약이 없을 수 있어 fallback으로 재시도합니다.');

        // unit이 없는 경우: unit 제거하고 upsert 재시도
        if (upsertError.message.includes('unit')) {
          const payloadNoUnit = templates.map((t, index) => ({
            id: t.id,
            user_id: userId,
            emoji: t.emoji,
            label: t.label,
            field_key: t.field_key,
            sort_order: index,
            type: t.type || 'checkbox',
            image_upload_enabled: t.image_upload_enabled ?? false,
          }));

          const result = await supabase
            .from('routine_templates')
            .upsert(payloadNoUnit, { onConflict: 'id' });
          upsertError = result.error;
        } else if (upsertError.message.includes('image_upload_enabled')) {
          const payloadNoImageFlag = templates.map((t, index) => ({
            id: t.id,
            user_id: userId,
            emoji: t.emoji,
            label: t.label,
            field_key: t.field_key,
            sort_order: index,
            type: t.type || 'checkbox',
            unit: t.unit || null,
            deleted_at: null,
          }));

          const result = await supabase
            .from('routine_templates')
            .upsert(payloadNoImageFlag, { onConflict: 'id' });
          upsertError = result.error;
        } else if (upsertError.message.includes('type')) {
          // type이 없는 경우: type, unit 모두 제거하고 upsert 재시도
          const payloadBasic = templates.map((t, index) => ({
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
    } catch (err: any) {
      throw err;
    }
  };

  const handleUpdate = (
    index: number,
    field: 'label' | 'type' | 'unit' | 'image_upload_enabled',
    value: string | boolean
  ) => {
    const updated = [...routineTemplates];
    updated[index] = { ...updated[index], [field]: value };
    setRoutineTemplates(updated);
    setDirtyById(prev => ({ ...prev, [updated[index].id]: true }));
  };

  const persistSortOrder = async (templates: RoutineTemplate[]) => {
    await upsertTemplates(
      templates.map((t, idx) => ({ ...t, sort_order: idx }))
    );
  };

  // UUID v4 생성 함수 (crypto.randomUUID가 없는 경우 대비)
  const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    // UUID v4 형식: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // UUID 형식 검증 함수
  const isValidUUID = (str: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  const handleSaveOne = async (templateId: string) => {
    console.log('=== 저장 시작 ===', { templateId });
    const idx = routineTemplates.findIndex(t => t.id === templateId);
    if (idx < 0) {
      console.error('템플릿을 찾을 수 없습니다:', templateId);
      setMessage('❌ 저장 실패: 템플릿을 찾을 수 없습니다.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }
    let template = routineTemplates[idx];
    console.log('저장할 템플릿:', template);
    
    // ID가 UUID 형식이 아닌 경우, 새 UUID 생성 (새로 추가한 루틴인 경우)
    if (!isValidUUID(template.id)) {
      console.warn('ID가 UUID 형식이 아닙니다. 새 UUID를 생성합니다:', template.id);
      template = { ...template, id: generateUUID() };
      // 상태 업데이트
      const updated = [...routineTemplates];
      updated[idx] = template;
      setRoutineTemplates(updated);
      setDirtyById(prev => ({ ...prev, [template.id]: true }));
    }

    if (!supabase) {
      console.error('Supabase 연결이 없습니다.');
      setMessage('❌ 저장 실패: Supabase 연결이 설정되지 않았습니다.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    if (!userId) {
      console.error('사용자 ID가 없습니다.');
      setMessage('❌ 저장 실패: 로그인 정보가 없습니다.');
      setTimeout(() => setMessage(''), 5000);
      return;
    }

    // UUID가 새로 생성된 경우 templateId 업데이트
    const finalTemplateId = template.id;
    setSavingById(prev => ({ ...prev, [finalTemplateId]: true }));
    // 원래 templateId가 변경된 경우 dirtyById도 업데이트
    if (templateId !== finalTemplateId) {
      setDirtyById(prev => {
        const newDirty = { ...prev };
        delete newDirty[templateId];
        newDirty[finalTemplateId] = true;
        return newDirty;
      });
    }
    setMessage('');
    try {
      // 항목 1개만 저장하되, sort_order는 현재 index 기준으로 저장
      console.log('upsertTemplates 호출 전', { template });
      await upsertTemplates([{ ...template, sort_order: idx }]);
      console.log('upsertTemplates 성공');
      setDirtyById(prev => ({ ...prev, [finalTemplateId]: false }));
      setMessage('✅ 저장되었습니다!');
      setTimeout(() => setMessage(''), 2000);
      // 저장 후 DB 기준으로 재로딩(서버 default/trigger 등 반영)
      await loadRoutineTemplates();
    } catch (err: any) {
      console.error('=== 저장 에러 ===', err);
      const msg = err?.message || '저장 실패';
      setMessage(`❌ 저장 실패: ${msg}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setSavingById(prev => {
        const newSaving = { ...prev };
        delete newSaving[templateId];
        if (finalTemplateId !== templateId) {
          delete newSaving[finalTemplateId];
        }
        return newSaving;
      });
    }
  };

  const handleDeleteOne = async (templateId: string) => {
    if (!supabase || !userId) return;
    setSavingById(prev => ({ ...prev, [templateId]: true }));
    setMessage('');
    try {
      // Prefer soft delete to preserve historical daily_routine_checks
      let { error } = await supabase
        .from('routine_templates')
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('id', templateId);

      // Fallback: if deleted_at column doesn't exist yet, hard delete as before
      if (error && (error.message.includes('column') || error.code === '42703')) {
        console.warn('⚠️ deleted_at 컬럼이 없습니다. 임시로 hard delete로 처리합니다.');
        const result = await supabase
          .from('routine_templates')
          .delete()
          .eq('user_id', userId)
          .eq('id', templateId);
        error = result.error;
      }
      if (error) throw error;

      const next = routineTemplates.filter(t => t.id !== templateId);
      setRoutineTemplates(next);
      setDirtyById(prev => {
        const n = { ...prev };
        delete n[templateId];
        return n;
      });

      // 삭제 후 남은 항목들의 sort_order 정리 (즉시 반영)
      if (next.length > 0) {
        await persistSortOrder(next);
      }

      setMessage('✅ 삭제되었습니다!');
      setTimeout(() => setMessage(''), 2000);
      await loadRoutineTemplates();
    } catch (err: any) {
      const msg = err?.message || '삭제 실패';
      setMessage(`❌ 삭제 실패: ${msg}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setSavingById(prev => ({ ...prev, [templateId]: false }));
    }
  };

  const handleAdd = () => {
    if (routineTemplates.length >= 12) {
      setMessage('⚠️ 루틴은 최대 12개까지만 추가할 수 있습니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    const newFieldKey = `routine_${Date.now()}`;
    const newId = generateUUID(); // 항상 유효한 UUID 생성
    setRoutineTemplates([
      ...routineTemplates,
      {
        id: newId,
        emoji: '✅',
        label: '새 루틴',
        field_key: newFieldKey,
        sort_order: routineTemplates.length,
        type: 'checkbox',
        image_upload_enabled: false,
      },
    ]);
    setDirtyById(prev => ({ ...prev, [newId]: true }));
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newTemplates = [...routineTemplates];
    if (direction === 'up' && index > 0) {
      [newTemplates[index], newTemplates[index - 1]] = [newTemplates[index - 1], newTemplates[index]];
    } else if (direction === 'down' && index < newTemplates.length - 1) {
      [newTemplates[index], newTemplates[index + 1]] = [newTemplates[index + 1], newTemplates[index]];
    }
    setRoutineTemplates(newTemplates);
    try {
      await persistSortOrder(newTemplates);
    } catch (err: any) {
      const msg = err?.message || '순서 저장 실패';
      setMessage(`❌ ${msg}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (!supabase) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-[412px] w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 sm:p-6">
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
      
      <div className={APP_CONTENT_CONTAINER}>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white whitespace-nowrap">⚙️ 설정</h2>
          </div>

          {/* 테마 설정 */}
          <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">테마</h3>
              {/* 테마 토글 (회색 배경 제거 + 1/2 사이즈 축소) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setTheme('light')}
                  className={`px-1.5 py-0.5 rounded-md flex items-center justify-center gap-1 transition-all min-h-[20px] min-w-[46px] ${
                    mounted && theme === 'light'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : 'hover:bg-gray-300/50 dark:hover:bg-gray-600/50'
                  }`}
                  aria-label="화이트 모드"
                >
                  <span className="text-[10px]">☀️</span>
                  <span className="text-[9px] font-medium text-gray-900 dark:text-white">라이트</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`px-1.5 py-0.5 rounded-md flex items-center justify-center gap-1 transition-all min-h-[20px] min-w-[46px] bg-black text-white hover:bg-black/90 ${
                    mounted && theme === 'dark'
                      ? 'shadow-sm ring-1 ring-white/15'
                      : ''
                  }`}
                  aria-label="다크 모드"
                >
                  <span className="text-[10px]">🌙</span>
                  <span className="text-[9px] font-medium text-white">다크</span>
                </button>
              </div>
            </div>
          </div>

          {/* 자산 카테고리 설정 */}
          <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">자산 카테고리</h3>
              <button
                onClick={() => setShowCategoryManager(true)}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                관리
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              자산과 부채를 카테고리별로 그룹화하여 관리할 수 있습니다.
            </p>
          </div>

          {/* 루틴 설정 */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-2 sm:mb-2.5">
              <h3
                className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap cursor-pointer select-none flex items-center gap-2"
                onClick={() => setIsRoutineSectionExpanded(v => !v)}
                aria-label="루틴 설정 펼치기/접기"
                title={isRoutineSectionExpanded ? '접기' : '펼치기'}
              >
                루틴 설정 ({routineTemplates.length}/12)
              </h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* 펼침/접힘 화살표 ( + 버튼 왼쪽 ) */}
                <button
                  type="button"
                  onClick={() => setIsRoutineSectionExpanded(v => !v)}
                  className="rounded-lg transition-colors min-h-[28px] sm:min-h-[30px] px-2 py-0.5 hover:bg-gray-100 dark:hover:bg-gray-700"
                  aria-label={isRoutineSectionExpanded ? '접기' : '펼치기'}
                  title={isRoutineSectionExpanded ? '접기' : '펼치기'}
                >
                  <img
                    src="/화살표 아래.png"
                    alt={isRoutineSectionExpanded ? '접기' : '펼치기'}
                    className="h-[18px] w-auto object-contain select-none"
                    draggable={false}
                  />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd();
                  }}
                  disabled={routineTemplates.length >= 12}
                  className={`rounded-lg transition-colors min-h-[28px] sm:min-h-[30px] flex-shrink-0 px-2 py-0.5 ${
                    routineTemplates.length >= 12
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  aria-label="추가"
                >
                  <img
                    src="/플러스.png"
                    alt="추가"
                    className="h-[18px] w-auto object-contain select-none"
                    draggable={false}
                  />
                </button>
              </div>
            </div>

            {isRoutineSectionExpanded && (
              <>
                <div className="space-y-1 sm:space-y-1.5 mb-2 sm:mb-2.5">
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
                        onSave={handleSaveOne}
                        onDelete={handleDeleteOne}
                        canMoveUp={index > 0}
                        canMoveDown={index < routineTemplates.length - 1}
                        isDirty={!!dirtyById[template.id]}
                        isSaving={!!savingById[template.id]}
                      />
                    );
                  })}
                </div>

                {routineTemplates.length === 0 && (
                  <div className="text-center text-sm sm:text-base text-gray-400 dark:text-gray-500 py-6 sm:py-8">
                    루틴이 없습니다. 추가 버튼을 눌러 루틴을 추가하세요.
                  </div>
                )}
              </>
            )}

            {message && (
              <div className={`mt-2 sm:mt-3 text-xs sm:text-sm text-center ${message.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <FooterNav />

      {/* 카테고리 관리 모달 */}
      {userId && (
        <CategoryManager
          isOpen={showCategoryManager}
          onClose={() => setShowCategoryManager(false)}
          userId={userId}
          assetNames={assetNames}
          onUpdate={loadAssetNames}
        />
      )}
    </div>
  );
}

