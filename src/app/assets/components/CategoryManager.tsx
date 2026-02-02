'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '../../../lib/supabase';

interface Category {
  id: string;
  name: string;
  type: 'asset' | 'debt';
  sort_order: number;
}

interface CategoryMapping {
  id: string;
  asset_name: string;
  category_id: string | null;
}

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  assetNames: string[];
  onUpdate: () => void;
}

export function CategoryManager({ isOpen, onClose, userId, assetNames, onUpdate }: CategoryManagerProps) {
  const supabase = getSupabase();
  const [activeTab, setActiveTab] = useState<'asset' | 'debt'>('asset');
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // 데이터 로드
  useEffect(() => {
    if (isOpen && userId) {
      loadData();
    }
  }, [isOpen, userId]);

  const loadData = async () => {
    if (!supabase) return;
    setIsLoading(true);

    try {
      // 카테고리 로드
      const { data: catData } = await supabase
        .from('asset_categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (catData) setCategories(catData);

      // 매핑 로드
      const { data: mapData } = await supabase
        .from('asset_category_mappings')
        .select('*')
        .eq('user_id', userId);

      if (mapData) setMappings(mapData);
    } catch (err) {
      console.error('데이터 로드 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 카테고리 추가
  const addCategory = async () => {
    if (!supabase || !newCategoryName.trim()) return;

    const maxOrder = categories.filter(c => c.type === activeTab).length;
    
    const { error } = await supabase
      .from('asset_categories')
      .insert({
        user_id: userId,
        name: newCategoryName.trim(),
        type: activeTab,
        sort_order: maxOrder,
      });

    if (!error) {
      setNewCategoryName('');
      loadData();
      onUpdate();
    }
  };

  // 카테고리 삭제
  const deleteCategory = async (categoryId: string) => {
    if (!supabase) return;
    if (!confirm('이 카테고리를 삭제하시겠습니까?')) return;

    await supabase
      .from('asset_categories')
      .delete()
      .eq('id', categoryId);

    loadData();
    onUpdate();
  };

  // 카테고리 이름 수정
  const updateCategoryName = async (categoryId: string) => {
    if (!supabase || !editName.trim()) return;

    await supabase
      .from('asset_categories')
      .update({ name: editName.trim() })
      .eq('id', categoryId);

    setEditingCategory(null);
    setEditName('');
    loadData();
    onUpdate();
  };

  // 카테고리 순서 변경
  const moveCategory = async (categoryId: string, direction: 'up' | 'down') => {
    if (!supabase) return;

    const typeCategories = categories
      .filter(c => c.type === activeTab)
      .sort((a, b) => a.sort_order - b.sort_order);

    const currentIndex = typeCategories.findIndex(c => c.id === categoryId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= typeCategories.length) return;

    const currentCategory = typeCategories[currentIndex];
    const swapCategory = typeCategories[newIndex];

    // 순서 교환
    await Promise.all([
      supabase
        .from('asset_categories')
        .update({ sort_order: swapCategory.sort_order })
        .eq('id', currentCategory.id),
      supabase
        .from('asset_categories')
        .update({ sort_order: currentCategory.sort_order })
        .eq('id', swapCategory.id),
    ]);

    loadData();
    onUpdate();
  };

  // 자산을 카테고리에 매핑
  const mapAssetToCategory = async (assetName: string, categoryId: string | null) => {
    if (!supabase) return;

    const existingMapping = mappings.find(m => m.asset_name === assetName);

    if (existingMapping) {
      if (categoryId === null) {
        // 매핑 삭제
        await supabase
          .from('asset_category_mappings')
          .delete()
          .eq('id', existingMapping.id);
      } else {
        // 매핑 업데이트
        await supabase
          .from('asset_category_mappings')
          .update({ category_id: categoryId })
          .eq('id', existingMapping.id);
      }
    } else if (categoryId) {
      // 새 매핑 생성
      await supabase
        .from('asset_category_mappings')
        .insert({
          user_id: userId,
          asset_name: assetName,
          category_id: categoryId,
        });
    }

    loadData();
    onUpdate();
  };

  // 현재 탭의 카테고리 필터링
  const filteredCategories = categories
    .filter(c => c.type === activeTab)
    .sort((a, b) => a.sort_order - b.sort_order);

  // 미분류 자산 목록
  const unmappedAssets = assetNames.filter(name => 
    !mappings.find(m => m.asset_name === name && m.category_id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">카테고리 관리</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('asset')}
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'asset'
                ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            자산 카테고리
          </button>
          <button
            onClick={() => setActiveTab('debt')}
            className={`flex-1 py-2 text-sm font-medium ${
              activeTab === 'debt'
                ? 'text-red-600 dark:text-red-400 border-b-2 border-red-600 dark:border-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            부채 카테고리
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">로딩 중...</div>
          ) : (
            <>
              {/* 새 카테고리 추가 */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="새 카테고리 이름"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                />
                <button
                  onClick={addCategory}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${
                    activeTab === 'asset' 
                      ? 'bg-emerald-600 hover:bg-emerald-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  추가
                </button>
              </div>

              {/* 카테고리 목록 */}
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  카테고리 목록
                </h3>
                {filteredCategories.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    카테고리가 없습니다
                  </p>
                ) : (
                  filteredCategories.map((category, index) => (
                    <div
                      key={category.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      {/* 순서 버튼 */}
                      <div className="flex flex-col">
                        <button
                          onClick={() => moveCategory(category.id, 'up')}
                          disabled={index === 0}
                          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveCategory(category.id, 'down')}
                          disabled={index === filteredCategories.length - 1}
                          className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>

                      {/* 카테고리 이름 */}
                      {editingCategory === category.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && updateCategoryName(category.id)}
                          onBlur={() => updateCategoryName(category.id)}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="flex-1 text-sm text-gray-900 dark:text-white cursor-pointer"
                          onClick={() => {
                            setEditingCategory(category.id);
                            setEditName(category.name);
                          }}
                        >
                          {category.name}
                        </span>
                      )}

                      {/* 매핑된 자산 수 */}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {mappings.filter(m => m.category_id === category.id).length}개
                      </span>

                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => deleteCategory(category.id)}
                        className="p-1 text-red-500 hover:text-red-700"
                      >
                        🗑
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* 자산 매핑 */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {activeTab === 'asset' ? '자산' : '부채'} 분류
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {assetNames.map((assetName) => {
                    const mapping = mappings.find(m => m.asset_name === assetName);
                    const currentCategoryId = mapping?.category_id || '';

                    return (
                      <div
                        key={assetName}
                        className="flex items-center gap-2 py-1"
                      >
                        <select
                          value={currentCategoryId}
                          onChange={(e) => mapAssetToCategory(assetName, e.target.value || null)}
                          className="w-32 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">미분류</option>
                          {filteredCategories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate flex-1">
                          {assetName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
