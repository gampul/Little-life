'use client';

import { useState, useEffect, useCallback, useRef, Suspense, type MouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '../../lib/supabase';

/** 저장 직후 AI 의미검색용 임베딩 갱신 (백그라운드, 실패해도 무시) */
const requestMemoEmbedding = (memoId: string) => {
  try {
    fetch('/api/ai/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memoId }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
};
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { useAuth } from '../components/AuthProvider';
import { SwipeNav } from '../components/SwipeNav';
import { APP_CONTENT_CONTAINER, APP_HORIZONTAL_CONTAINER } from '../components/container';
import {
  useMemos,
  useInvalidateMemos,
  usePatchMemoInCache,
  usePinnedCount,
  isMissingPinnedColumn,
  useMemoCategories,
  useInvalidateMemoCategories,
  type MemoCategoryItem,
} from '../../hooks/useMemos';
import { MemoListSkeleton } from './MemoListSkeleton';
import { MemoCard, type MemoCardData } from './MemoCard';
import { useScrollDirection } from '../../hooks/useScrollDirection';

const MemoEditor = dynamic(() => import('./MemoEditor'), {
  ssr: false,
  loading: () => (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 mb-4 text-center text-sm text-gray-400 animate-pulse">
      에디터 로딩 중...
    </div>
  ),
});

interface Memo {
  id?: string;
  title: string;
  content: string;
  excerpt?: string | null;
  cover_image?: string | null;
  created_at?: string;
  updated_at?: string;
  likes?: number;
  comments?: number;
  category_id?: string | null;
}

type MemoListCard = MemoCardData;

type MemoCategory = MemoCategoryItem;

type ViewMode = 'grid' | 'list' | 'compact';

// HTML에서 텍스트만 추출 (저장 시 excerpt 용)
const extractText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// HTML에서 첫 번째 이미지 URL 추출 (저장 시 cover_image 용)
const extractFirstImage = (html: string): string | null => {
  const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
  return imgMatch ? imgMatch[1] : null;
};

// 작성일자 — 로컬 기준 YYYY-MM-DD
const toLocalDateInput = (iso?: string | null): string => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return toLocalDateInput();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 사용자가 고른 작성일(YYYY-MM-DD)을 created_at ISO 로.
 * 시각은 기준 시각(원본 created_at 또는 지금)의 시:분:초를 그대로 써서
 * 날짜만 바꾸고 하루 안 정렬 순서는 유지한다.
 */
const composeCreatedAt = (dateStr: string, baseIso?: string | null): string => {
  const base = baseIso ? new Date(baseIso) : new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  const out = new Date(base);
  if (y && m && d) out.setFullYear(y, m - 1, d);
  return out.toISOString();
};

function MemoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabase();
  const { user } = useAuth();
  const invalidateMemos = useInvalidateMemos();
  const [showEditor, setShowEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // 좋아요 상태 (로컬)
  const [likedMemos, setLikedMemos] = useState<Set<string>>(new Set());
  
  // 링크 복사 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  
  // 카테고리 관련 상태
  // 카테고리 — React Query 단일 캐시 (초기 3회 중복 호출 제거)
  const { data: memoCategoriesData } = useMemoCategories(user?.id ?? null);
  const memoCategories: MemoCategory[] = memoCategoriesData ?? [];
  const invalidateMemoCategories = useInvalidateMemoCategories();
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  /** 중요공지 탭 — Diary 첫 진입 시 고정 글이 하나라도 있으면 이 탭이 먼저 열린다 */
  const [showPinnedOnly, setShowPinnedOnly] = useState(true);
  const { data: pinnedCount, isSuccess: pinnedCountReady } = usePinnedCount();
  const pinnedDefaultDecided = useRef(false);
  useEffect(() => {
    if (pinnedDefaultDecided.current || !pinnedCountReady) return;
    pinnedDefaultDecided.current = true;
    if (!pinnedCount) setShowPinnedOnly(false);
  }, [pinnedCountReady, pinnedCount]);
  const patchMemoInCache = usePatchMemoInCache();
  /** 편집 중인 글의 중요공지 여부 */
  const [isPinned, setIsPinned] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MemoCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  /** 서브카테고리 추가 시 상위 (null = 최상위). 후보에는 최상위만. */
  const [newCategoryParentId, setNewCategoryParentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);

  // 검색 (서버 — title/content ilike, 전체 글 대상)
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // 페이지네이션 — React Query (카테고리 + 검색은 서버 조건, count/range 동일 기준)
  const pageSize = 10;
  // 대분류 선택 시 자식 글까지 포함 (소분류/단독은 자기 자신만)
  const effectiveCategoryIds: string[] | null = selectedCategoryFilter
    ? (() => {
        const childIds = memoCategories
          .filter((c) => c.parent_id === selectedCategoryFilter)
          .map((c) => c.id);
        return childIds.length
          ? [selectedCategoryFilter, ...childIds]
          : [selectedCategoryFilter];
      })()
    : null;
  const { data: memosPage, isLoading } = useMemos(
    currentPage,
    showPinnedOnly ? null : effectiveCategoryIds,
    pageSize,
    debouncedQuery,
    showPinnedOnly
  );
  const displayedMemos = (memosPage?.memos ?? []) as MemoListCard[];
  const totalCount = memosPage?.totalCount ?? 0;
  const isSearchActive = debouncedQuery.length > 0;

  // 상세 라우트 prefetch — 카드 탭 시 즉시 열리도록 (RSC + loading.tsx)
  useEffect(() => {
    for (const m of displayedMemos) {
      if (m.id) router.prefetch(`/memo/${m.id}`);
    }
  }, [displayedMemos, router]);

  const [formData, setFormData] = useState<Memo>({
    title: '',
    content: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  /** 작성일자 (YYYY-MM-DD, 로컬). 새 글은 오늘, 편집은 원본 created_at */
  const [createdDate, setCreatedDate] = useState<string>(() => toLocalDateInput());
  /** 편집 중인 글의 원본 created_at (시각 유지·변경 여부 판단용) */
  const [originalCreatedAt, setOriginalCreatedAt] = useState<string | null>(null);

  // 카테고리 변경(추가/수정/삭제/순서) 후 캐시 갱신
  const loadCategories = () => invalidateMemoCategories();

  // 카테고리 변경은 selectCategory 에서 페이지를 함께 리셋(같은 렌더에 배치 → memos 1회 요청).
  // 검색어는 디바운스 콜백에서 함께 리셋.
  const selectCategory = useCallback((id: string | null) => {
    setShowPinnedOnly(false);
    setSelectedCategoryFilter(id);
    setCurrentPage(1);
  }, []);

  const selectPinned = useCallback(() => {
    setShowPinnedOnly(true);
    setSelectedCategoryFilter(null);
    setCurrentPage(1);
  }, []);

  // 설정/햄버거에서 ?manageCategories=1 로 진입 시 기존 모달만 연다 (로직 동일)
  useEffect(() => {
    if (searchParams.get('manageCategories') === '1') {
      setShowCategoryModal(true);
      router.replace('/memo', { scroll: false });
    }
  }, [searchParams, router]);

  // URL에서 edit 파라미터 처리 (상세 페이지에서 수정 버튼 클릭 시)
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && supabase) {
      // 해당 메모를 로드하고 수정 모드로 진입
      const loadMemoForEdit = async () => {
        const { data, error } = await supabase
          .from('memos')
          .select('*')
          .eq('id', editId)
          .single();
        
        if (!error && data) {
          setFormData({
            title: data.title || '',
            content: data.content || '',
          });
          setEditingId(data.id);
          setOriginalCreatedAt(data.created_at ?? null);
          setCreatedDate(toLocalDateInput(data.created_at));
          // 편집 진입 시 카테고리 폼 상태를 원본 category_id 로 초기화 (미설정 시 null)
          setSelectedCategoryId(data.category_id ?? null);
          setIsPinned(!!data.is_pinned);
          setShowEditor(true);
          // URL에서 edit 파라미터 제거
          router.replace('/memo', { scroll: false });
        }
      };
      loadMemoForEdit();
    }
  }, [searchParams, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // 좋아요 토글 — 부모는 리렌더되지만 MemoCard(memo)는 liked boolean 이 바뀐 카드만 리렌더
  const handleLike = useCallback((memoId: string) => {
    setLikedMemos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memoId)) {
        newSet.delete(memoId);
      } else {
        newSet.add(memoId);
      }
      return newSet;
    });
  }, []);

  const handleCopyLink = useCallback((e: MouseEvent, memoId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/memo/${memoId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(memoId);
      setCopyToast(true);
      setTimeout(() => {
        setCopiedId(null);
        setCopyToast(false);
      }, 1500);
    });
  }, []);

  const handleOpenMemo = useCallback(
    (memoId: string) => {
      router.push(`/memo/${memoId}`);
    },
    [router]
  );

  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    
    if (!formData.content.trim()) {
      setMessage('❌ 메모 내용을 입력해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setIsSaving(true);
    setMessage('');

    try {
      const excerpt = extractText(formData.content).substring(0, 150);
      const cover_image = extractFirstImage(formData.content);

      // selectedCategoryId: 편집 진입 시 원본으로 초기화됨.
      // '없음'을 고르면 null, 그 외에는 선택 UUID — || 로 덮어쓰지 않음.
      const categoryIdForSave = selectedCategoryId;

      // is_pinned 컬럼이 없는 DB(add_memo_pinned.sql 미실행)면 그 필드만 빼고 재시도
      const withPinnedFallback = async <T,>(run: (pinnedPatch: { is_pinned?: boolean }) => PromiseLike<{ data: T; error: any }>) => {
        const first = await run({ is_pinned: isPinned });
        if (first.error && isMissingPinnedColumn(first.error)) {
          const second = await run({});
          if (!second.error && isPinned) {
            alert('중요공지 설정은 저장되지 않았습니다. Supabase 에서 add_memo_pinned.sql 을 실행해 주세요.');
          }
          return second;
        }
        return first;
      };

      if (editingId) {
        const { error } = await withPinnedFallback((pinnedPatch) =>
          supabase
            .from('memos')
            .update({
              title: formData.title,
              content: formData.content,
              excerpt,
              cover_image,
              updated_at: new Date().toISOString(),
              category_id: categoryIdForSave,
              ...pinnedPatch,
              // 작성일을 바꾼 경우에만 created_at 갱신 (시각은 원본 유지)
              ...(createdDate !== toLocalDateInput(originalCreatedAt)
                ? { created_at: composeCreatedAt(createdDate, originalCreatedAt) }
                : {}),
            })
            .eq('id', editingId)
        );

        if (error) throw error;
        setMessage('✅ 수정되었습니다!');
        requestMemoEmbedding(editingId);
      } else {
        const { data: inserted, error } = await withPinnedFallback<{ id: string }[] | null>((pinnedPatch) =>
          supabase
            .from('memos')
            .insert([{
              title: formData.title,
              content: formData.content,
              excerpt,
              cover_image,
              category_id: categoryIdForSave,
              ...pinnedPatch,
              // 오늘이면 DB 기본값(now) 그대로, 다른 날짜를 골랐으면 그 날짜(시각은 지금)
              ...(createdDate !== toLocalDateInput() ? { created_at: composeCreatedAt(createdDate) } : {}),
            }])
            .select('id')
        );

        if (error) throw error;
        setMessage('✅ 저장되었습니다!');
        const newId = inserted?.[0]?.id;
        if (newId) requestMemoEmbedding(newId);
      }

      setShowEditor(false);
      setFormData({ title: '', content: '' });
      setEditingId(null);
      setSelectedCategoryId(null);
      setIsPinned(false);
      setOriginalCreatedAt(null);
      setCreatedDate(toLocalDateInput());
      setCurrentPage(1);
      
      await invalidateMemos();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      if (err?.message) {
        errorMessage = err.message;
      }
      setMessage(`❌ 저장 실패: ${errorMessage}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // 카드 액션과 동일: 아래로 스크롤 중엔 FAB 숨김, 위로 올리면 표시
  const fabVisible = useScrollDirection() === 'up';

  const handleWrite = () => {
    setShowEditor(true);
    setEditingId(null);
    setFormData({ title: '', content: '' });
    setSelectedCategoryId(null);
    setIsPinned(false);
    setOriginalCreatedAt(null);
    setCreatedDate(toLocalDateInput());
  };

  const handleCancelEditor = () => {
    setShowEditor(false);
    setFormData({ title: '', content: '' });
    setEditingId(null);
    setSelectedCategoryId(null);
    setIsPinned(false);
  };

  // 목록에는 content 가 없으므로 편집 진입 시 단건만 로드 (상세 페이지 select 와 동일 패턴)
  const handleEdit = useCallback(
    async (memo: MemoListCard) => {
      if (!supabase || !memo.id) return;

      // 목록에 있는 category_id 로 먼저 초기화(칩·저장 불일치 방지), 단건 fetch 후 확정
      setSelectedCategoryId(memo.category_id ?? null);

      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .eq('id', memo.id)
        .single();

      if (error || !data) {
        setMessage('❌ 글을 불러오지 못했습니다.');
        setTimeout(() => setMessage(''), 3000);
        return;
      }

      setShowEditor(true);
      setEditingId(data.id);
      setFormData({
        title: data.title || '',
        content: data.content || '',
      });
      setSelectedCategoryId(data.category_id ?? null);
      setIsPinned(!!data.is_pinned);
      setOriginalCreatedAt(data.created_at ?? null);
      setCreatedDate(toLocalDateInput(data.created_at));
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    },
    [supabase]
  );

  const handleDelete = useCallback(
    async (memo: MemoListCard) => {
      if (!supabase || !memo.id) return;

      const confirmed = window.confirm('정말 삭제하시겠습니까?');
      if (!confirmed) return;

      try {
        const { error } = await supabase.from('memos').delete().eq('id', memo.id);

        if (error) {
          alert('삭제에 실패했습니다.');
          return;
        }

        await invalidateMemos();
      } catch {
        alert('삭제에 실패했습니다.');
      }
    },
    [supabase, invalidateMemos]
  );

  /** 카드의 📌 버튼 — 중요공지 토글 */
  const handleTogglePin = useCallback(
    async (memo: MemoListCard) => {
      if (!supabase || !memo.id) return;
      const next = !memo.is_pinned;
      const { error } = await supabase.from('memos').update({ is_pinned: next }).eq('id', memo.id);
      if (error) {
        if (isMissingPinnedColumn(error)) {
          alert('중요공지 기능을 쓰려면 Supabase 에서 add_memo_pinned.sql 을 먼저 실행해 주세요.');
        } else {
          alert('중요공지 설정에 실패했습니다.');
        }
        return;
      }
      patchMemoInCache(memo.id, { is_pinned: next });
      await invalidateMemos();
    },
    [supabase, patchMemoInCache, invalidateMemos]
  );

  const handleAddCategory = async () => {
    if (!supabase || !newCategoryName.trim() || !user) return;
    // 1단계만: parent 는 최상위여야 함 (자식 id 선택 불가 — UI에서 제외)
    const parentId = newCategoryParentId;
    if (parentId) {
      const parent = memoCategories.find((c) => c.id === parentId);
      if (!parent || parent.parent_id) return;
    }
    const siblings = memoCategories.filter(
      (c) => (c.parent_id ?? null) === (parentId ?? null)
    );
    const { error } = await supabase.from('memo_categories').insert({
      name: newCategoryName.trim(),
      sort_order: siblings.length,
      user_id: user.id,
      parent_id: parentId,
    });
    if (error) {
      alert('카테고리 추가에 실패했습니다.');
      return;
    }
    setNewCategoryName('');
    setNewCategoryParentId(null);
    loadCategories();
  };

  const handleUpdateCategory = async (id: string, name: string) => {
    if (!supabase || !name.trim()) return;
    await supabase.from('memo_categories').update({ name: name.trim() }).eq('id', id);
    setEditingCategory(null);
    loadCategories();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!supabase) return;
    const confirmed = window.confirm(
      '카테고리를 삭제하면 해당 글은 미분류로 변경됩니다. 하위 카테고리는 최상위로 이동합니다. 삭제할까요?'
    );
    if (!confirmed) return;
    await supabase.from('memo_categories').delete().eq('id', id);
    if (selectedCategoryFilter === id) setSelectedCategoryFilter(null);
    if (newCategoryParentId === id) setNewCategoryParentId(null);
    loadCategories();
  };

  /** 같은 부모(형제) 내에서만 sort_order 교환 — 부모 간 이동은 미구현 */
  const handleReorderSibling = async (id: string, direction: 'up' | 'down') => {
    if (!supabase) return;
    const cat = memoCategories.find((c) => c.id === id);
    if (!cat) return;
    const parentKey = cat.parent_id ?? null;
    const siblings = memoCategories
      .filter((c) => (c.parent_id ?? null) === parentKey)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    const idx = siblings.findIndex((c) => c.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= siblings.length) return;
    const a = siblings[idx];
    const b = siblings[swapIdx];
    const [resA, resB] = await Promise.all([
      supabase.from('memo_categories').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('memo_categories').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    if (resA.error || resB.error) {
      alert('순서 변경에 실패했습니다.');
      return;
    }
    loadCategories();
  };

  const closeCategoryModal = () => {
    setShowCategoryModal(false);
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryParentId(null);
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

  const totalPages = Math.ceil(totalCount / pageSize);

  // 최상위만 상위 후보 (1단계 제한). 트리는 parent_id 기준, sort_order 유지
  const rootCategories = memoCategories
    .filter((c) => !c.parent_id)
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  // 필터 칩: 현재 선택이 하위면 그 부모, 상위면 자기 자신이 "펼쳐진 상위"
  const selectedCategory = selectedCategoryFilter
    ? memoCategories.find((c) => c.id === selectedCategoryFilter) ?? null
    : null;
  const activeRootId: string | null = selectedCategory
    ? selectedCategory.parent_id ?? selectedCategory.id
    : null;
  const activeRootChildren = activeRootId
    ? memoCategories
        .filter((c) => c.parent_id === activeRootId)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    : [];
  // 부모가 목록에 없는 하위(이상치)는 최상위 칩 줄에 함께 표시
  const orphanCategories = memoCategories.filter(
    (c) => c.parent_id && !memoCategories.some((p) => p.id === c.parent_id)
  );
  const rootChipCategories = [...rootCategories, ...orphanCategories];
  const categoryTreeRows: { cat: MemoCategory; depth: 0 | 1 }[] = [];
  for (const root of rootCategories) {
    categoryTreeRows.push({ cat: root, depth: 0 });
    const children = memoCategories
      .filter((c) => c.parent_id === root.id)
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const child of children) {
      categoryTreeRows.push({ cat: child, depth: 1 });
    }
  }
  // parent_id 가 있지만 부모가 목록에 없는 경우(이상치) → 최상위로 표시
  const listedIds = new Set(categoryTreeRows.map((r) => r.cat.id));
  for (const c of memoCategories) {
    if (!listedIds.has(c.id)) {
      categoryTreeRows.push({ cat: c, depth: 0 });
    }
  }

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
      <GlobalNav />
      
      <div className={APP_CONTENT_CONTAINER}>
        
        {/* 헤더: 필터 + 뷰모드 + 글쓰기 */}
        {!showEditor && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                {showPinnedOnly ? '📌 중요공지' : selectedCategory ? selectedCategory.name : '전체글'}
              </span>
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">({totalCount})</span>
            </div>
            
            <div className="flex items-center gap-2">
              {/* 뷰 모드 버튼 */}
              <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}
                  title="그리드"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}
                  title="리스트"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('compact')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${viewMode === 'compact' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500'}`}
                  title="컴팩트"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
            </div>
          </div>
        )}

        {/* 카테고리 필터 탭 + 검색 */}
        {!showEditor && (
          <div className="mb-4 space-y-3">
            {/* 상위 카테고리 칩 — 화면 폭 안에서 줄바꿈 (가로 스크롤 없음) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={selectPinned}
                style={{ touchAction: 'manipulation' }}
                aria-pressed={showPinnedOnly}
                className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  showPinnedOnly
                    ? 'bg-amber-500 text-white'
                    : 'border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                }`}
              >
                📌 중요공지
                {!!pinnedCount && (
                  <span className={`text-[11px] ${showPinnedOnly ? 'text-amber-100' : 'text-amber-500'}`}>{pinnedCount}</span>
                )}
              </button>
              <button
                onClick={() => selectCategory(null)}
                style={{ touchAction: 'manipulation' }}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategoryFilter && !showPinnedOnly
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                전체
              </button>
              {rootChipCategories.map((cat) => {
                const isActive = !showPinnedOnly && activeRootId === cat.id;
                const hasChildren = memoCategories.some((c) => c.parent_id === cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => selectCategory(cat.id)}
                    style={{ touchAction: 'manipulation' }}
                    aria-expanded={hasChildren ? isActive : undefined}
                    className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {cat.name}
                    {hasChildren && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        className={`transition-transform ${isActive ? 'rotate-180' : ''}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                style={{ touchAction: 'manipulation' }}
                className="ml-auto w-8 h-8 inline-flex items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="카테고리 관리"
                aria-label="카테고리 관리"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            </div>

            {/* 하위 카테고리 칩 — 선택된 상위에 하위가 있을 때만 펼침 */}
            {!showPinnedOnly && activeRootId && activeRootChildren.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-3 border-l-2 border-gray-200 dark:border-gray-700 animate-fade-in">
                <button
                  onClick={() => selectCategory(activeRootId)}
                  style={{ touchAction: 'manipulation' }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedCategoryFilter === activeRootId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  전체
                </button>
                {activeRootChildren.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => selectCategory(child.id)}
                    style={{ touchAction: 'manipulation' }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedCategoryFilter === child.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )}

            {memoCategories.length === 0 && (
              <button
                type="button"
                onClick={() => setShowCategoryModal(true)}
                style={{ touchAction: 'manipulation' }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 text-left"
              >
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  아직 카테고리가 없습니다. <span className="font-medium text-blue-600 dark:text-blue-400">카테고리 추가</span>
                </span>
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium flex-shrink-0">추가</span>
              </button>
            )}

            <label className="flex items-center gap-2 h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus-within:border-blue-400 dark:focus-within:border-blue-500 transition-colors">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 text-gray-400"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="제목·내용 검색"
                className="flex-1 min-w-0 h-full bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
                aria-label="다이어리 검색"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label="검색어 지우기"
                  style={{ touchAction: 'manipulation' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </label>
          </div>
        )}

        {showEditor && (
          <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/50 animate-fade-in">
            {/* 하단 고정 바(툴바+취소/저장) 높이만큼 pb 확보 → 본문 끝까지 스크롤 가능 */}
            <div className="min-h-full flex items-start justify-center px-3 sm:px-6 pt-3 sm:pt-6 pb-36">
              <div className="w-full max-w-2xl my-2 sm:my-6">
          <MemoEditor
            title={formData.title || ''}
            content={formData.content || ''}
            onTitleChange={(t) => setFormData((prev) => ({ ...prev, title: t }))}
            onContentChange={(c) => setFormData((prev) => ({ ...prev, content: c }))}
            categories={memoCategories}
            selectedCategoryId={selectedCategoryId}
            onCategoryChange={setSelectedCategoryId}
            createdDate={createdDate}
            onCreatedDateChange={setCreatedDate}
            isPinned={isPinned}
            onPinnedChange={setIsPinned}
            onSave={handleSave}
            onCancel={handleCancelEditor}
            isSaving={isSaving}
            message={message}
            isEditing={!!editingId}
            contentKey={editingId ?? (showEditor ? 'new' : null)}
          />
              </div>
            </div>
          </div>
        )}

        {/* FAB: 글쓰기 버튼 */}
        {!showEditor && (
          <button
            onClick={handleWrite}
            className={`fixed bottom-24 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ease-out ${
              fabVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
            }`}
            aria-hidden={!fabVisible}
            tabIndex={fabVisible ? 0 : -1}
            aria-label="글쓰기"
            style={{ touchAction: 'manipulation' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}

        {/* 메모 목록 — 뷰 전환 시 컨테이너 CSS만 변경, MemoCard key=id 유지 */}
        {isLoading ? (
          <MemoListSkeleton viewMode={viewMode} count={pageSize} />
        ) : displayedMemos.length > 0 ? (
          <div
            className={
              viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'flex flex-col'
            }
          >
            {displayedMemos.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                variant={viewMode}
                liked={likedMemos.has(memo.id || '')}
                copied={copiedId === memo.id}
                onLike={handleLike}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onCopyLink={handleCopyLink}
                onOpen={handleOpenMemo}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-12">
            {isSearchActive
              ? '검색 결과가 없습니다'
              : showPinnedOnly
                ? '중요공지로 지정된 글이 없습니다. 글 카드의 📌 버튼이나 글쓰기 화면에서 지정할 수 있어요.'
                : '작성된 글이 없습니다'}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
              className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
            >
              이전
            </button>
            
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* 토스트 메시지 */}
      {copyToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-2.5 rounded-xl shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5l10 -10" />
          </svg>
          링크가 복사되었습니다
        </div>
      )}

      {/* 카테고리 관리 모달 — FooterNav(z-[100])보다 위에 두어 추가 입력이 클릭 가능해야 함 */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40"
          onClick={closeCategoryModal}
        >
          <div
            className="w-full max-w-[412px] bg-white dark:bg-gray-900 rounded-t-2xl overflow-hidden pb-[env(safe-area-inset-bottom,0px)]"
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <span className="text-base font-semibold text-gray-900 dark:text-white">카테고리 관리</span>
              <button
                type="button"
                onClick={closeCategoryModal}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* 카테고리 목록 (트리) */}
            <div className="max-h-[50vh] overflow-y-auto">
              {categoryTreeRows.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">카테고리가 없습니다</p>
              )}
              {categoryTreeRows.map(({ cat, depth }) => {
                const parentKey = cat.parent_id ?? null;
                const siblings = memoCategories
                  .filter((c) => (c.parent_id ?? null) === parentKey)
                  .slice()
                  .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
                const sibIdx = siblings.findIndex((c) => c.id === cat.id);
                const canUp = sibIdx > 0;
                const canDown = sibIdx >= 0 && sibIdx < siblings.length - 1;

                return (
                  <div
                    key={cat.id}
                    className={`flex items-center gap-2 py-3 border-b border-gray-50 dark:border-gray-800 ${
                      depth === 0 ? 'px-5' : 'pl-10 pr-5 bg-gray-50/60 dark:bg-gray-800/30'
                    }`}
                  >
                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        aria-label="위로"
                        disabled={!canUp}
                        onClick={() => handleReorderSibling(cat.id, 'up')}
                        style={{ touchAction: 'manipulation' }}
                        className="w-7 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:pointer-events-none"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label="아래로"
                        disabled={!canDown}
                        onClick={() => handleReorderSibling(cat.id, 'down')}
                        style={{ touchAction: 'manipulation' }}
                        className="w-7 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:pointer-events-none"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                    {editingCategory?.id === cat.id ? (
                      <input
                        autoFocus
                        value={editingCategory.name}
                        onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateCategory(cat.id, editingCategory.name);
                          if (e.key === 'Escape') setEditingCategory(null);
                        }}
                        className="flex-1 text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg outline-none text-gray-900 dark:text-white"
                      />
                    ) : (
                      <span className={`flex-1 text-sm ${depth === 0 ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                        {depth === 1 && <span className="text-gray-400 mr-1" aria-hidden>└</span>}
                        {cat.name}
                      </span>
                    )}
                    {editingCategory?.id === cat.id ? (
                      <button
                        type="button"
                        onClick={() => handleUpdateCategory(cat.id, editingCategory.name)}
                        style={{ touchAction: 'manipulation' }}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg"
                      >
                        완료
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingCategory(cat)}
                          style={{ touchAction: 'manipulation' }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-1"/>
                            <path d="M20.385 6.585a2.1 2.1 0 0 0-2.97-2.97l-8.415 8.385v3h3l8.385-8.415z"/>
                            <path d="M16 5l3 3"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat.id)}
                          style={{ touchAction: 'manipulation' }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/>
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/>
                            <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 카테고리 추가 — 상위 드롭다운(최상위만) */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                상위 카테고리
              </label>
              <select
                value={newCategoryParentId ?? ''}
                onChange={(e) => setNewCategoryParentId(e.target.value || null)}
                style={{ touchAction: 'manipulation' }}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none"
              >
                <option value="">없음 (최상위)</option>
                {rootCategories.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                  placeholder="새 카테고리 이름"
                  className="flex-1 px-4 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-xl outline-none text-gray-900 dark:text-white placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  style={{ touchAction: 'manipulation' }}
                  className="px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40 transition-colors"
                >
                  추가
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FooterNav />

      <style jsx global>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

export default function MemoPage() {
  return (
    <AuthGuard>
      <SwipeNav>
        <Suspense fallback={
          <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
            <GlobalNav />
            <div className={`${APP_HORIZONTAL_CONTAINER} py-8`}>
              <div className="flex items-center justify-center py-20">
                <div className="text-gray-400">로딩 중...</div>
              </div>
            </div>
            <FooterNav />
          </div>
        }>
          <MemoPageContent />
        </Suspense>
      </SwipeNav>
    </AuthGuard>
  );
}
