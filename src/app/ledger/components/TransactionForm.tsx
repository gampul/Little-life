'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { IconChevronDown, IconX } from '@tabler/icons-react';
import { getSupabase } from '../../../lib/supabase';
import { useAuth } from '../../components/AuthProvider';
import { categoryIcon } from '../ledgerUtils';

/** 최근 1년 사용 기록 — 자산·분류를 자주 쓴 순서로 보여 주기 위함 */
interface UsageRow {
  asset: string | null;
  transfer_asset: string | null;
  category: string | null;
  sub_category: string | null;
  transaction_type: string;
}

type PickerKind = 'asset' | 'transfer' | 'category';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TransactionData) => Promise<void>;
  /** 수정할 거래 (없으면 새로 추가) */
  editing?: EditableTransaction | null;
  /** 수정 모드에서 삭제 */
  onDelete?: (id: string) => Promise<void>;
  /** 새로 추가할 때 기본 날짜 (YYYY-MM-DD, KST) */
  defaultDate?: string;
}

export interface EditableTransaction {
  id: string;
  date: string;
  amount: number;
  transaction_type: '수입' | '지출' | '자산이체';
  is_transfer: boolean;
  asset: string;
  transfer_asset?: string | null;
  category: string;
  sub_category?: string | null;
  memo?: string | null;
}

/** KST 기준 YYYY-MM-DD */
export function kstDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

export function TransactionForm({ isOpen, onClose, onSubmit, editing = null, onDelete, defaultDate }: TransactionFormProps) {
  const { user: authUser } = useAuth();
  const [formData, setFormData] = useState<TransactionData>({
    date: kstDateString(),
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
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [picker, setPickerState] = useState<PickerKind | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [showStale, setShowStale] = useState(false);
  // 선택판은 시트 맨 위에 덮어 보이게 — 열 때 시트 스크롤을 맨 위로
  const setPicker = (k: PickerKind | null) => {
    if (k) sheetRef.current?.scrollTo({ top: 0 });
    setPickerState(k);
  };

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
        const user = authUser;
        
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
            if (expenseCategories.length > 0) {
              setFormData(prev => (prev.category ? prev : { ...prev, category: expenseCategories[0].category }));
            }
          }
          
          // 자산 목록 로드
          const { data: assetData, error: assetError } = await supabase.rpc('get_asset_balances', {
            p_user_id: user.id
          });
          
          // 최근 1년 사용 기록 (자주 쓴 자산·분류 순서)
          const since = new Date(Date.now() - 365 * 86400000).toISOString();
          const rows: UsageRow[] = [];
          for (let off = 0; off < 5000; off += 1000) {
            const { data: page, error: uErr } = await supabase
              .from('transactions')
              .select('asset, transfer_asset, category, sub_category, transaction_type')
              .eq('user_id', user.id)
              .gte('date', since)
              .order('date', { ascending: false })
              .range(off, off + 999);
            if (uErr || !page) break;
            rows.push(...(page as UsageRow[]));
            if (page.length < 1000) break;
          }
          setUsage(rows);

          if (assetError) {
            console.error('자산 로드 실패:', assetError);
          } else {
            setAssets(assetData || []);
            
            // 초기 자산 설정 (첫 번째 자산)
            if (assetData && assetData.length > 0) {
              setFormData(prev => (prev.asset ? prev : { ...prev, asset: assetData[0].asset_name }));
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
      // 열 때마다 수정 대상 / 새 거래로 초기화
      setError(null);
      if (editing) {
        setFormData({
          date: kstDateString(new Date(editing.date)),
          amount: Number(editing.amount) || 0,
          transaction_type: editing.transaction_type,
          is_transfer: editing.transaction_type === '자산이체',
          asset: editing.asset || '',
          transfer_asset: editing.transfer_asset || undefined,
          category: editing.category || '',
          sub_category: editing.sub_category || '',
          memo: editing.memo || '',
        });
      } else {
        setFormData({
          date: defaultDate || kstDateString(),
          amount: 0,
          transaction_type: '지출',
          is_transfer: false,
          asset: '',
          category: '',
          sub_category: '',
          memo: '',
        });
      }
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editing?.id]);

  // ── 한 화면 선택판용 목록 (자주 쓴 순서) ──
  const assetOptions = useMemo(() => {
    const cnt = new Map<string, number>();
    for (const u of usage) {
      for (const a of [u.asset, u.transfer_asset]) {
        const k = (a || '').trim();
        if (k) cnt.set(k, (cnt.get(k) ?? 0) + 1);
      }
    }
    const info = new Map(assets.map((a) => [a.asset_name.trim(), a]));
    const names = new Set<string>([...info.keys(), ...cnt.keys()]);
    return [...names]
      .map((name) => ({ name, used: cnt.get(name) ?? 0, balance: Number(info.get(name)?.balance ?? 0), isDebt: !!info.get(name)?.is_debt }))
      // 최근에 안 쓰고 잔액도 0인 자산은 뒤로
      .sort((a, b) => b.used - a.used || Number(b.balance !== 0) - Number(a.balance !== 0) || a.name.localeCompare(b.name, 'ko'));
  }, [assets, usage]);

  const categoryOptions = useMemo(() => {
    const dbType = formData.transaction_type === '수입' ? 'income' : 'expense';
    const mains = new Map<string, { used: number; subs: Map<string, number> }>();
    const touch = (main: string, sub: string | null, used: number) => {
      const m = main.trim();
      if (!m || m === '자산이체') return;
      const e = mains.get(m) ?? { used: 0, subs: new Map<string, number>() };
      e.used += used;
      const sk = (sub || '').trim();
      if (sk) e.subs.set(sk, (e.subs.get(sk) ?? 0) + used);
      mains.set(m, e);
    };
    for (const c of categories) if (c.type === dbType) touch(c.category, c.subcategory, 0);
    for (const u of usage) if (u.transaction_type === formData.transaction_type) touch(u.category || '', u.sub_category, 1);
    return [...mains.entries()]
      .map(([name, e]) => ({
        name,
        used: e.used,
        subs: [...e.subs.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n),
      }))
      // 잔액수정은 일반 입력용이 아니라 맨 뒤로
      .sort((a, b) => Number(a.name === '잔액수정') - Number(b.name === '잔액수정') || b.used - a.used || a.name.localeCompare(b.name, 'ko'));
  }, [categories, usage, formData.transaction_type]);

  // 새 거래: 자산·분류가 비어 있으면 가장 자주 쓴 것으로
  useEffect(() => {
    if (!isOpen || editing) return;
    setFormData((prev) => {
      let next = prev;
      if (!prev.asset && assetOptions[0]) next = { ...next, asset: assetOptions[0].name };
      if (prev.transaction_type !== '자산이체' && !prev.category && categoryOptions[0]) next = { ...next, category: categoryOptions[0].name };
      return next;
    });
  }, [isOpen, editing, assetOptions, categoryOptions]);

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
    const usedFirst = usage.find((u) => u.transaction_type === type && u.category && !['자산이체', '잔액수정'].includes(u.category.trim()))?.category?.trim();
    const firstCategory = usedFirst || (mainCats.length > 0 ? mainCats[0].category : '');
    
    setFormData({
      ...formData,
      transaction_type: type,
      is_transfer: isTransfer,
      category: isTransfer ? '자산이체' : firstCategory,
      sub_category: '',
      transfer_asset: isTransfer ? formData.transfer_asset : undefined,
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
        date: kstDateString(),
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

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDelete = async () => {
    if (!editing || !onDelete) return;
    if (!window.confirm('이 거래를 삭제할까요?')) return;
    setIsDeleting(true);
    try {
      await onDelete(editing.id);
      onClose();
    } catch (err) {
      setError('삭제 중 오류가 발생했습니다');
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const isTransfer = formData.transaction_type === '자산이체';

  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-end justify-center" onClick={onClose}>
      <div ref={sheetRef} className={`relative w-full max-w-[412px] bg-white dark:bg-gray-800 rounded-t-2xl p-4 pb-6 max-h-[88vh] ${picker ? 'h-[88vh] overflow-hidden' : 'overflow-y-auto'}`} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {editing ? '거래 수정' : '거래 추가'}
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
            <PickerField
              loading={isLoadingAssets}
              value={formData.asset}
              placeholder="자산 선택"
              onClick={() => setPicker('asset')}
            />
          </div>

          {/* 이체 대상 자산 (자산이체일 때만) */}
          {isTransfer && (
            <div className="mb-3">
              <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">
                입금 자산
              </label>
              <PickerField value={formData.transfer_asset || ''} placeholder="선택하세요" onClick={() => setPicker('transfer')} />
            </div>
          )}

          {/* 분류 (자산이체가 아닐 때만) */}
          {!isTransfer && (
            <>
              <div className="mb-3">
                <label className="text-sm text-gray-700 dark:text-gray-300 mb-1 block">분류</label>
                <PickerField
                  loading={isLoadingCategories}
                  value={formData.category ? `${categoryIcon(formData.category)} ${formData.category}${formData.sub_category ? ` · ${formData.sub_category}` : ''}` : ''}
                  placeholder="분류 선택"
                  onClick={() => setPicker('category')}
                />
              </div>
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
            {editing && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting || isSubmitting}
                className="px-4 py-3 text-base bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium rounded-xl disabled:opacity-50"
              >
                {isDeleting ? '삭제 중…' : '삭제'}
              </button>
            )}
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

        {/* 자산·분류 선택판 — 한 화면에 모두 보이게 촘촘한 격자 */}
        {picker && (
          <div className="absolute inset-0 z-10 flex flex-col rounded-t-2xl bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-[15px] font-bold text-gray-900 dark:text-white">
                {picker === 'asset' ? (isTransfer ? '출금 자산' : '자산') : picker === 'transfer' ? '입금 자산' : '분류'}
              </p>
              <button type="button" onClick={() => setPicker(null)} aria-label="닫기" className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700">
                <IconX size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {picker !== 'category' ? (
                <>
                <div className="grid grid-cols-3 gap-1">
                  {assetOptions
                    .filter((o) => picker !== 'transfer' || o.name !== formData.asset)
                    // 1년간 안 쓰고 잔액 0인 자산은 접어 둠 (지금 고른 자산은 항상 보임)
                    .filter((o) => showStale || o.used > 0 || o.balance !== 0 || o.name === (picker === 'transfer' ? formData.transfer_asset : formData.asset))
                    .map((o) => {
                      const current = picker === 'transfer' ? formData.transfer_asset : formData.asset;
                      const active = current === o.name;
                      const stale = o.used === 0 && o.balance === 0;
                      return (
                        <button
                          key={o.name}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => (picker === 'transfer' ? { ...prev, transfer_asset: o.name } : { ...prev, asset: o.name }));
                            setPicker(null);
                          }}
                          title={o.name}
                          className={`flex min-h-[36px] items-center justify-center rounded-lg px-1 py-1 text-center text-[11.5px] leading-tight break-keep ${
                            active
                              ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                              : `bg-gray-50 dark:bg-gray-700/60 ${stale ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`
                          }`}
                        >
                          <span className="line-clamp-2">
                            {o.name}
                            {o.isDebt && <span className="ml-0.5 text-[10px] opacity-60">(부채)</span>}
                          </span>
                        </button>
                      );
                    })}
                </div>
                {(() => {
                  const stale = assetOptions.filter((o) => o.used === 0 && o.balance === 0).length;
                  if (!stale) return null;
                  return (
                    <button type="button" onClick={() => setShowStale((v) => !v)} className="mt-2 w-full py-1.5 text-center text-[12px] text-gray-500 dark:text-gray-400">
                      {showStale ? '안 쓰는 자산 접기' : `안 쓰는 자산 ${stale}개 더 보기`}
                    </button>
                  );
                })()}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-1">
                    {categoryOptions.map((c) => {
                      const active = formData.category === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, category: c.name, sub_category: prev.category === c.name ? prev.sub_category : '' }));
                            if (c.subs.length === 0) setPicker(null);
                          }}
                          className={`flex min-h-[48px] flex-col items-center justify-center rounded-lg px-1 py-1 text-[11px] leading-tight ${
                            active ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-50 text-gray-800 dark:bg-gray-700/60 dark:text-gray-100'
                          }`}
                        >
                          <span className="text-[15px] leading-none">{categoryIcon(c.name)}</span>
                          <span className="mt-0.5 line-clamp-2 break-keep text-center">{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const cur = categoryOptions.find((c) => c.name === formData.category);
                    if (!cur || cur.subs.length === 0) return null;
                    return (
                      <div className="mt-3">
                        <p className="mb-1 text-[12px] text-gray-500 dark:text-gray-400">{cur.name} 세부 분류</p>
                        <div className="flex flex-wrap gap-1">
                          {['', ...cur.subs].map((sub) => {
                            const active = (formData.sub_category || '') === sub;
                            return (
                              <button
                                key={sub || '__none'}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, sub_category: sub }));
                                  setPicker(null);
                                }}
                                className={`rounded-full px-2.5 py-1 text-[12px] ${
                                  active ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                                }`}
                              >
                                {sub || '선택 안함'}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 선택 칸 (누르면 선택판이 열림) */
function PickerField({ value, placeholder, onClick, loading }: { value: string; placeholder: string; onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-base outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
    >
      <span className={`min-w-0 truncate ${value ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{loading ? '로딩 중...' : value || placeholder}</span>
      <IconChevronDown size={16} className="shrink-0 text-gray-400" />
    </button>
  );
}
