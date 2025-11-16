'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '../../lib/supabase';
import { GlobalNav } from '../components/GlobalNav';
import { ThemeToggle } from '../components/ThemeToggle';

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

  const handleUpdate = (index: number, field: 'emoji' | 'label', value: string) => {
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
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-white dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors">
      <GlobalNav />
      
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">⚙️ 설정</h2>
          </div>

          {/* 테마 설정 */}
          <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">테마</h3>
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300">다크 모드</span>
              <ThemeToggle />
            </div>
          </div>

          {/* 루틴 설정 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">루틴 설정</h3>
              <button
                onClick={handleAdd}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                + 추가
              </button>
            </div>

            <div className="space-y-3 mb-4">
              {routineTemplates.map((template, index) => (
                <div
                  key={template.id}
                  className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={template.emoji}
                      onChange={(e) => handleUpdate(index, 'emoji', e.target.value)}
                      className="w-12 px-2 py-1 text-center bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded"
                      placeholder="이모지"
                    />
                    <input
                      type="text"
                      value={template.label}
                      onChange={(e) => handleUpdate(index, 'label', e.target.value)}
                      className="flex-1 px-3 py-1 bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-500 rounded"
                      placeholder="루틴 이름"
                    />
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
                      title="위로"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === routineTemplates.length - 1}
                      className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50"
                      title="아래로"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="px-2 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {routineTemplates.length === 0 && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                루틴이 없습니다. 추가 버튼을 눌러 루틴을 추가하세요.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>

            {message && (
              <div className={`mt-3 text-sm text-center ${message.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

