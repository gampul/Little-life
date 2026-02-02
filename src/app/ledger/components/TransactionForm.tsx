'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '../../../lib/supabase';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionData) => Promise<void>;
}

export interface TransactionData {
  date: string;
  amount: number;
  transaction_type: '수입' | '지출' | '자산이체';
  is_transfer: boolean;
  asset: string;
  transfer_asset?: string;
  category: string;
  sub_category?: string;
  memo?: string;
}

interface Category {
  id: string;
  type: string;
  category: string;
  subcategory: string | null;
  is_system: boolean;
  sort_order: number;
  is_active: boolean;
}

interface AssetItem {
  asset_name: string;
  balance: number;
  is_debt: boolean;
}

export function TransactionForm({ isOpen, onClose, onSubmit }: TransactionFormProps) {
  const [formData, setFormData] = useState<TransactionData>({
    date: new Date().toISOString().split('T')[0],
    amount: 0,
    transaction_type: '지출',
    is_transfer: false,
    asset: '',
    category: '',
    sub_category: '',
    memo: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 카테고리 관련 상태
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  
  // 자산 관련 상태
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);

  // 카테고리 및 자산 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoadingCategories(true);
      setIsLoadingAssets(true);
      try {
        const supabase = getSupabase();
        if (!supabase) {
          console.error('Supabase 클라이언트 초기화 실패');
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // 카테고리 로드
          const { data: categoryData, error: categoryError } = await supabase.rpc('get_active_categories', {
            p_user_id: user.id,
            p_type: null
          });
          
          if (categoryError) {
            console.error('카테고리 로드 실패:', categoryError);
          } else {
            setCategories(categoryData || []);
            
            // 초기 카테고리 설정 (지출의 첫 번째 대분류)
            const expenseCategories = (categoryData || []).filter(
              (c: Category) => c.type === 'expense' && c.subcategory === null
            );
            if (expenseCategories.length > 0 && !formData.category) {
              setFormData(prev => ({ ...prev, category: expenseCategories[0].category }));
            }
          }
          
          // 자산 목록 로드
          const { data: assetData, error: assetError } = await supabase.rpc('get_asset_balances', {
            p_user_id: user.id
          });
          
          if (assetError) {
            console.error('자산 로드 실패:', assetError);
          } else {
            setAssets(assetData || []);
            
            // 초기 자산 설정 (첫 번째 자산)
            if (assetData && assetData.length > 0 && !formData.asset) {
              setFormData(prev => ({ ...prev, asset: assetData[0].asset_name }));
            }
          }
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      } finally {
        setIsLoadingCategories(false);
        setIsLoadingAssets(false);
      }
    };
    
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // 현재 타입에 맞는 대분류 목록
  const getMainCategories = () => {
    const typeMap: Record<string, string> = {
      '수입': 'income',
      '지출': 'expense',
      '자산이체': 'transfer'
    };
    const dbType = typeMap[formData.transaction_type];
    return categories.filter(c => c.type === dbType && c.subcategory === null);
  };

  // 선택된 대분류에 맞는 소분류 목록
  const getSubcategories = () => {
    const typeMap: Record<string, string> = {
      '수입': 'income',
      '지출': 'expense',
      '자산이체': 'transfer'
    };
    const dbType = typeMap[formData.transaction_type];
    return categories.filter(
      c => c.type === dbType && c.category === formData.category && c.subcategory !== null
    );
  };

  const handleTypeChange = (type: '수입' | '지출' | '자산이체') => {
    const isTransfer = type === '자산이체';
    const typeMap: Record<string, string> = {
      '수입': 'income',
      '지출': 'expense',
      '자산이체': 'transfer'
    };
    const dbType = typeMap[type];
    
    // 해당 타입의 첫 번째 대분류 가져오기
    const mainCats = categories.filter(c => c.type === dbType && c.subcategory === null);
    const firstCategory = mainCats.length > 0 ? mainCats[0].category : '';
    
    setFormData({
      ...formData,
      transaction_type: type,
      is_transfer: isTransfer,
      category: isTransfer ? '자산이체' : firstCategory,
      sub_category: '',
      transfer_asset: isTransfer ? formData.transfer_asset : undefined,
    });
  };

  const handleCategoryChange = (category: string) => {
    setFormData({
      ...formData,
      category,
      sub_category: '', // 대분류 변경 시 소분류 초기화
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.amount <= 0) {
      setError('금액을 입력해주세요');
      return;
    }

    if (formData.transaction_type === '자산이체' && !formData.transfer_asset) {
      setError('이체 대상 자산을 선택해주세요');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // 폼 초기화
      setFormData({
        date: new Date().toISOString().split('T')[0],
        amount: 0,
        transaction_type: '지출',
        is_transfer: false,
        asset: assets.length > 0 ? assets[0].asset_name : '',
        category: '',
        sub_category: '',
        memo: '',
      });
      onClose();
    } catch (err) {
      setError('저장 중 오류가 발생했습니다');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isTransfer = formData.transaction_type === '자산이체';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="w-full max-w-[412px] bg-white dark:bg-gray-800 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            거래 추가
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 거래 유형 선택 */}
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-2">
              {(['수입', '지출', '자산이체'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    formData.transaction_type === type
                      ? type === '수입'
                        ? 'bg-green-600 text-white shadow-md'
                        : type === '지출'
                        ? 'bg-red-600 text-white shadow-md'
                        : 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 금액 */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              금액
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="flex-1 px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-base text-gray-500 dark:text-gray-400">원</span>
            </div>
          </div>

          {/* 날짜 */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              날짜
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 자산 */}
          <div className="mb-3">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              {isTransfer ? '출금 자산' : '자산'}
            </label>
            {isLoadingAssets ? (
              <div className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-400">
                로딩 중...
              </div>
            ) : (
              <select
                value={formData.asset}
                onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                {assets.map((item) => (
                  <option key={item.asset_name} value={item.asset_name}>
                    {item.asset_name} {item.is_debt ? '(부채)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 이체 대상 자산 (자산이체일 때만) */}
          {isTransfer && (
            <div className="mb-3">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                입금 자산
              </label>
              <select
                value={formData.transfer_asset || ''}
                onChange={(e) => setFormData({ ...formData, transfer_asset: e.target.value })}
                className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                {assets.filter(a => a.asset_name !== formData.asset).map((item) => (
                  <option key={item.asset_name} value={item.asset_name}>
                    {item.asset_name} {item.is_debt ? '(부채)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 분류 (자산이체가 아닐 때만) */}
          {!isTransfer && (
            <>
              {/* 대분류 */}
              <div className="mb-3">
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                  분류
                </label>
                {isLoadingCategories ? (
                  <div className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-400">
                    로딩 중...
                  </div>
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getMainCategories().map((cat) => (
                      <option key={cat.id} value={cat.category}>{cat.category}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* 소분류 (있는 경우만) */}
              {getSubcategories().length > 0 && (
                <div className="mb-3">
                  <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                    세부 분류 <span className="text-gray-400">(선택)</span>
                  </label>
                  <select
                    value={formData.sub_category || ''}
                    onChange={(e) => setFormData({ ...formData, sub_category: e.target.value || undefined })}
                    className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">선택 안함</option>
                    {getSubcategories().map((cat) => (
                      <option key={cat.id} value={cat.subcategory || ''}>{cat.subcategory}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* 메모 */}
          <div className="mb-4">
            <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
              메모 (선택)
            </label>
            <input
              type="text"
              value={formData.memo || ''}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="메모를 입력하세요"
              className="w-full px-3 py-2.5 text-base bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-sm text-red-500 mb-3">{error}</p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-base bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 text-base bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
