'use client';

import { useState, useEffect, useCallback, useRef, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '../../lib/supabase';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { SwipeNav } from '../components/SwipeNav';
import { APP_CONTENT_CONTAINER, APP_HORIZONTAL_CONTAINER } from '../components/container';

// 이미지 업로드 최대 크기 (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 줄 시작 `컬러` + 스페이스 → 대표 색상 선택 */
const INLINE_COLOR_TRIGGER = '컬러';

/** 글자색 툴바 프리셋 */
const TEXT_COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: '#111827', label: '검정' },
  { hex: '#6b7280', label: '회색' },
  { hex: '#dc2626', label: '빨강' },
  { hex: '#ea580c', label: '주황' },
  { hex: '#ca8a04', label: '황토' },
  { hex: '#16a34a', label: '초록' },
  { hex: '#2563eb', label: '파랑' },
  { hex: '#7c3aed', label: '보라' },
];

interface Memo {
  id?: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
  likes?: number;
  comments?: number;
}

type ViewMode = 'grid' | 'list' | 'compact';

// HTML에서 텍스트만 추출
const extractText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
};

// HTML에서 첫 번째 이미지 URL 추출
const extractFirstImage = (html: string): string | null => {
  const imgMatch = html.match(/<img[^>]+src="([^">]+)"/);
  return imgMatch ? imgMatch[1] : null;
};

// 날짜 포맷 (2025. 12. 24. 형식)
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}. ${month}. ${day}.`;
};

function MemoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabase();
  const [showEditor, setShowEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textColorInputRef = useRef<HTMLInputElement>(null);
  
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // 좋아요 상태 (로컬)
  const [likedMemos, setLikedMemos] = useState<Set<string>>(new Set());
  
  // 페이지네이션 관련 상태
  const [displayedMemos, setDisplayedMemos] = useState<Memo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [formData, setFormData] = useState<Memo>({
    title: '',
    content: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [inlineColorPickerPos, setInlineColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const inlineColorPickerRef = useRef<HTMLDivElement>(null);

  // 에디터 내용 업데이트
  const handleEditorInput = () => {
    if (editorRef.current) {
      setFormData(prev => ({
        ...prev,
        content: editorRef.current?.innerHTML || '',
      }));
    }
  };

  /** 라인 시작 `#` / `##` / `###` + 스페이스 → 헤딩 (GitHub 스타일 마크다운 쇼트컷) */
  const headingStyles: Record<1 | 2 | 3, string> = {
    1: 'font-size: 2em; font-weight: bold; margin: 0.67em 0;',
    2: 'font-size: 1.5em; font-weight: bold; margin: 0.75em 0;',
    3: 'font-size: 1.17em; font-weight: bold; margin: 0.83em 0;',
  };

  const getBlockElementForCaret = (root: HTMLElement, sel: Selection): HTMLElement | null => {
    let n: Node | null = sel.anchorNode;
    if (!n || !root.contains(n)) return null;
    while (n && n !== root) {
      if (n.nodeType === Node.ELEMENT_NODE) {
        const tag = (n as HTMLElement).tagName;
        if (tag === 'DIV' || tag === 'P' || tag === 'LI') {
          return n as HTMLElement;
        }
      }
      n = n.parentNode;
    }
    return root;
  };

  const textFromBlockStartToCaret = (block: HTMLElement, sel: Selection): string => {
    const r = document.createRange();
    try {
      r.setStart(block, 0);
      r.setEnd(sel.anchorNode!, sel.anchorOffset);
      return r.toString();
    } catch {
      return '';
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (inlineColorPickerPos && e.key === 'Escape') {
      e.preventDefault();
      setInlineColorPickerPos(null);
      return;
    }
    if (e.key !== ' ' || !editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.anchorNode) return;

    const root = editorRef.current;
    const block = getBlockElementForCaret(root, sel);
    if (!block) return;
    if (/^H[1-6]$/i.test(block.tagName)) return;

    const before = textFromBlockStartToCaret(block, sel);

    if (before === INLINE_COLOR_TRIGGER) {
      e.preventDefault();
      setInlineColorPickerPos(null);

      const del = document.createRange();
      try {
        del.setStart(block, 0);
        del.setEnd(sel.anchorNode, sel.anchorOffset);
        del.deleteContents();
      } catch {
        return;
      }

      const caret = document.createRange();
      try {
        caret.setStart(block, 0);
        caret.collapse(true);
      } catch {
        editorRef.current.focus();
        handleEditorInput();
        return;
      }
      if (block.childNodes.length === 0) {
        block.appendChild(document.createElement('br'));
        caret.setStart(block, 0);
        caret.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(caret);

      const rect = caret.getBoundingClientRect();
      const pad = 4;
      let left = rect.left;
      const top = rect.bottom + pad;
      const panelW = 216;
      if (left + panelW > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - panelW - 8);
      }

      setInlineColorPickerPos({ top, left });
      handleEditorInput();
      return;
    }

    const hm = before.match(/^(#{1,3})$/);
    if (hm) {
      e.preventDefault();

      const level = hm[1].length as 1 | 2 | 3;
      const h = document.createElement(`h${level}`);
      h.setAttribute('style', headingStyles[level]);

      const parent = block.parentNode;
      if (parent) {
        parent.replaceChild(h, block);
      } else {
        root.appendChild(h);
      }

      h.appendChild(document.createElement('br'));

      const newRange = document.createRange();
      newRange.setStart(h, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      handleEditorInput();
      return;
    }

    // 라인 시작 `-` 또는 `*` + 스페이스 → 글머리(점) 목록
    if (
      (before === '-' || before === '*') &&
      (block.tagName === 'DIV' || block.tagName === 'P')
    ) {
      e.preventDefault();

      const ul = document.createElement('ul');
      ul.setAttribute('style', 'margin: 0.5em 0; padding-left: 1.25em; list-style-type: disc;');
      const li = document.createElement('li');
      li.appendChild(document.createElement('br'));
      ul.appendChild(li);

      const parent = block.parentNode;
      if (parent) {
        parent.replaceChild(ul, block);
      } else {
        root.appendChild(ul);
      }

      const newRange = document.createRange();
      newRange.setStart(li, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);

      handleEditorInput();
    }
  };

  // 에디터 포맷 버튼 핸들러
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  };

  const applyTextColor = (color: string) => {
    if (!editorRef.current) return;
    document.execCommand('foreColor', false, color);
    editorRef.current.focus();
    handleEditorInput();
  };

  /** 라이트/다크에 맞는 에디터 기본 글자색으로 맞춤 */
  const applyDefaultTextColor = () => {
    if (!editorRef.current) return;
    const inherited = getComputedStyle(editorRef.current).color;
    document.execCommand('foreColor', false, inherited);
    editorRef.current.focus();
    handleEditorInput();
  };

  const pickInlineColor = (hex: string) => {
    if (!editorRef.current) return;
    document.execCommand('foreColor', false, hex);
    editorRef.current.focus();
    setInlineColorPickerPos(null);
    handleEditorInput();
  };

  const pickInlineDefaultColor = () => {
    if (!editorRef.current) return;
    const inherited = getComputedStyle(editorRef.current).color;
    document.execCommand('foreColor', false, inherited);
    editorRef.current.focus();
    setInlineColorPickerPos(null);
    handleEditorInput();
  };

  useEffect(() => {
    if (!inlineColorPickerPos) return;
    const handlePointerDown = (ev: PointerEvent) => {
      const pop = inlineColorPickerRef.current;
      if (pop && ev.target instanceof Node && pop.contains(ev.target)) return;
      setInlineColorPickerPos(null);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [inlineColorPickerPos]);

  // 마크다운 삽입 핸들러
  const insertMarkdown = (type: string) => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    
    let markdownText = '';
    
    switch (type) {
      case 'heading1':
        markdownText = `<h1 style="font-size: 2em; font-weight: bold; margin: 0.67em 0;">${selectedText || '제목 1'}</h1>`;
        break;
      case 'heading2':
        markdownText = `<h2 style="font-size: 1.5em; font-weight: bold; margin: 0.75em 0;">${selectedText || '제목 2'}</h2>`;
        break;
      case 'heading3':
        markdownText = `<h3 style="font-size: 1.17em; font-weight: bold; margin: 0.83em 0;">${selectedText || '제목 3'}</h3>`;
        break;
      case 'quote':
        markdownText = `<blockquote style="border-left: 4px solid #3B82F6; padding-left: 1em; margin: 1em 0; color: #6B7280;">${selectedText || '인용구'}</blockquote>`;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          // 여러 줄 코드 블록
          markdownText = `<pre style="background-color: #1F2937; color: #E5E7EB; padding: 1em; border-radius: 0.5em; overflow-x: auto; margin: 1em 0;"><code>${selectedText || '코드 블록'}</code></pre>`;
        } else {
          // 인라인 코드
          markdownText = `<code style="background-color: #E5E7EB; color: #1F2937; padding: 0.2em 0.4em; border-radius: 0.25em; font-family: monospace;">${selectedText || '코드'}</code>`;
        }
        break;
      case 'link':
        const url = prompt('링크 URL을 입력하세요:', 'https://');
        if (url) {
          markdownText = `<a href="${url}" style="color: #3B82F6; text-decoration: underline;" target="_blank" rel="noopener noreferrer">${selectedText || '링크'}</a>`;
        }
        break;
      case 'checkbox':
        markdownText = `<div style="margin: 0.5em 0;"><input type="checkbox" style="margin-right: 0.5em;"><span>${selectedText || '할 일'}</span></div>`;
        break;
      default:
        return;
    }
    
    if (markdownText) {
      document.execCommand('insertHTML', false, markdownText);
      editorRef.current.focus();
      handleEditorInput();
    }
  };

  // 이미지 업로드 핸들러
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;

    // 파일 크기 체크
    if (file.size > MAX_IMAGE_SIZE) {
      setMessage('❌ 이미지 크기는 5MB 이하만 가능합니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // 이미지 파일인지 체크
    if (!file.type.startsWith('image/')) {
      setMessage('❌ 이미지 파일만 업로드 가능합니다.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setIsUploading(true);
    setMessage('📷 이미지 업로드 중...');

    try {
      // 파일명 생성 (timestamp + random)
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}_${randomStr}.${extension}`;

      // Supabase Storage에 업로드
      const { data, error } = await supabase.storage
        .from('diary-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('업로드 에러:', error);
        throw error;
      }

      // Public URL 가져오기
      const { data: urlData } = supabase.storage
        .from('diary-images')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      // 에디터에 이미지 삽입
      if (editorRef.current) {
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = file.name;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        
        // 현재 커서 위치에 삽입
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.insertNode(img);
          range.collapse(false);
        } else {
          editorRef.current.appendChild(img);
        }
        
        // 줄바꿈 추가
        const br = document.createElement('br');
        editorRef.current.appendChild(br);
        
        handleEditorInput();
      }

      setMessage('✅ 이미지가 추가되었습니다!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err: any) {
      console.error('이미지 업로드 실패:', err);
      let errorMessage = '이미지 업로드에 실패했습니다.';
      if (err?.message?.includes('bucket')) {
        errorMessage = 'Storage 버킷이 없습니다. Supabase에서 diary-images 버킷을 생성해주세요.';
      }
      setMessage(`❌ ${errorMessage}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsUploading(false);
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 메모 목록 로드
  const loadMemos = useCallback(async (pageNum: number = 1) => {
    if (!supabase) {
      console.warn('Supabase 클라이언트가 없습니다.');
      return;
    }
    
    setIsLoading(true);
    try {
      const { count, error: countError } = await supabase
        .from('memos')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('전체 개수 조회 오류');
      } else {
        setTotalCount(count || 0);
      }

      const startIndex = (pageNum - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;

      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .order('created_at', { ascending: false })
        .range(startIndex, endIndex);

      if (error) {
        console.error('메모 목록 조회 오류');
        setIsLoading(false);
        return;
      }

      if (data) {
        setDisplayedMemos(data);
        setCurrentPage(pageNum);
      } else {
        setDisplayedMemos([]);
      }
    } catch (err) {
      console.error('예상치 못한 오류');
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadMemos(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          setShowEditor(true);
          // 에디터에 내용 설정
          setTimeout(() => {
            if (editorRef.current) {
              editorRef.current.innerHTML = data.content || '';
            }
          }, 100);
          // URL에서 edit 파라미터 제거
          router.replace('/memo', { scroll: false });
        }
      };
      loadMemoForEdit();
    }
  }, [searchParams, supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // 좋아요 토글
  const handleLike = (memoId: string) => {
    setLikedMemos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memoId)) {
        newSet.delete(memoId);
      } else {
        newSet.add(memoId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    
    const editorContent = editorRef.current?.innerHTML || formData.content || '';
    const textContent = editorRef.current?.textContent || '';
    
    if (!textContent.trim()) {
      setMessage('❌ 메모 내용을 입력해주세요.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    
    setIsSaving(true);
    setMessage('');

    try {
      if (editingId) {
        const { error } = await supabase
          .from('memos')
          .update({
            title: formData.title,
            content: editorContent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;
        setMessage('✅ 수정되었습니다!');
      } else {
        const { error } = await supabase
          .from('memos')
          .insert([{
            title: formData.title,
            content: editorContent,
          }]);

        if (error) throw error;
        setMessage('✅ 저장되었습니다!');
      }

      setShowEditor(false);
      setInlineColorPickerPos(null);
      setFormData({ title: '', content: '' });
      setEditingId(null);
      
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      
      await loadMemos(1);
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

  const handleWrite = () => {
    setInlineColorPickerPos(null);
    setShowEditor(true);
    setEditingId(null);
    setFormData({ title: '', content: '' });
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        editorRef.current.focus();
      }
    }, 100);
  };

  const handleEdit = (memo: Memo) => {
    setInlineColorPickerPos(null);
    setShowEditor(true);
    setEditingId(memo.id || null);
    setFormData({
      title: memo.title,
      content: memo.content,
    });
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (editorRef.current) {
        editorRef.current.innerHTML = memo.content || '';
      }
    }, 100);
  };

  const handleDelete = async (memo: Memo) => {
    if (!supabase || !memo.id) return;
    
    const confirmed = window.confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;
    
    try {
      const { error } = await supabase
        .from('memos')
        .delete()
        .eq('id', memo.id);
      
      if (error) {
        alert('삭제에 실패했습니다.');
        return;
      }
      
      await loadMemos(currentPage);
    } catch (err) {
      alert('삭제에 실패했습니다.');
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

  const totalPages = Math.ceil(totalCount / pageSize);

  // 메모 카드 렌더링
  const renderMemoCard = (memo: Memo) => {
    const textPreview = extractText(memo.content);
    const thumbnail = extractFirstImage(memo.content);
    const isLiked = likedMemos.has(memo.id || '');
    const likeCount = (memo.likes || 0) + (isLiked ? 1 : 0);

    // 카드 클릭 시 상세 페이지로 이동
    const handleCardClick = () => {
      if (memo.id) {
        router.push(`/memo/${memo.id}`);
      }
    };

    if (viewMode === 'compact') {
      // 컴팩트 뷰
      return (
        <div
          key={memo.id}
          onClick={handleCardClick}
          className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors -mx-2 px-2 rounded-lg"
        >
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate">
              {memo.title || '제목 없음'}
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              {formatDate(memo.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(memo); }}
              className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
            >
              ✏️
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(memo); }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
            >
              🗑️
            </button>
          </div>
        </div>
      );
    }

    if (viewMode === 'grid') {
      // 그리드 뷰
      return (
        <div
          key={memo.id}
          onClick={handleCardClick}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        >
          {thumbnail && (
            <div className="aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1">
              {memo.title || '제목 없음'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {formatDate(memo.created_at)}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <button
                  onClick={(e) => { e.stopPropagation(); handleLike(memo.id || ''); }}
                  className={`flex items-center gap-1 ${isLiked ? 'text-red-500' : ''}`}
                >
                  {isLiked ? '❤️' : '🤍'} {likeCount}
                </button>
                <span>💬 {memo.comments || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(memo); }} className="p-1 text-gray-400 hover:text-blue-500">✏️</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(memo); }} className="p-1 text-gray-400 hover:text-red-500">🗑️</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 리스트 뷰 (기본)
    return (
      <div
        key={memo.id}
        onClick={handleCardClick}
        className="py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors -mx-2 px-2 rounded-lg"
      >
        <div className="flex gap-3">
          {/* 콘텐츠 영역 */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-2">
              {memo.title || '제목 없음'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
              {textPreview}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
              {formatDate(memo.created_at)}
            </p>
            <div className="flex items-center gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <button
                onClick={(e) => { e.stopPropagation(); handleLike(memo.id || ''); }}
                className={`flex items-center gap-1 transition-colors ${isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
              >
                {isLiked ? '❤️' : '🤍'} {likeCount}
              </button>
              <span className="flex items-center gap-1">
                💬 {memo.comments || 0}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(memo); }}
                className="ml-auto text-gray-400 hover:text-blue-500 transition-colors"
              >
                ✏️
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(memo); }}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                🗑️
              </button>
            </div>
          </div>
          
          {/* 썸네일 영역 */}
          {thumbnail && (
            <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img src={thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-20">
      <GlobalNav />
      
      <div className={APP_CONTENT_CONTAINER}>
        
        {/* 헤더: 필터 + 뷰모드 + 글쓰기 */}
        {!showEditor && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">전체글</span>
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
              
              {/* 글쓰기 버튼 */}
              <button
                onClick={handleWrite}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                ✏️ 글쓰기
              </button>
            </div>
          </div>
        )}

        {/* 에디터 */}
        {showEditor && (
          <>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 mb-4">
            <div className="-mx-4 sm:-mx-5">
              <div className="mb-3 px-2">
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="제목을 입력하세요"
                  className="w-full px-0 py-2 text-base sm:text-lg font-semibold bg-transparent text-gray-900 dark:text-white border-0 border-b border-transparent focus:border-blue-500 outline-none"
                />
              </div>

              {/* 포맷 툴바 */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-t-lg px-2 py-2 flex flex-wrap gap-1 items-center">
                <button type="button" onClick={() => formatText('bold')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="굵게">
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => formatText('italic')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="기울임">
                  <em>I</em>
                </button>
                <button type="button" onClick={() => formatText('underline')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="밑줄">
                  <u>U</u>
                </button>
                <button
                  type="button"
                  onClick={applyDefaultTextColor}
                  className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold text-gray-800 dark:text-gray-100"
                  title="기본 글자색 (테마)"
                >
                  A
                </button>
                {TEXT_COLOR_PRESETS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => applyTextColor(hex)}
                    title={label}
                    className="w-6 h-6 min-w-[1.5rem] rounded border border-gray-300 dark:border-gray-500 shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <input
                  ref={textColorInputRef}
                  type="color"
                  defaultValue="#2563eb"
                  className="sr-only"
                  aria-label="글자 색 직접 선택"
                  onChange={(e) => {
                    applyTextColor(e.target.value);
                    setInlineColorPickerPos(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => textColorInputRef.current?.click()}
                  className="px-2 py-1.5 text-xs rounded border border-dashed border-gray-400 dark:border-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
                  title="색 직접 선택"
                >
                  🎨
                </button>
                {/* 마크다운 헤딩 */}
                <button type="button" onClick={() => insertMarkdown('heading1')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 1">
                  H1
                </button>
                <button type="button" onClick={() => insertMarkdown('heading2')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 2">
                  H2
                </button>
                <button type="button" onClick={() => insertMarkdown('heading3')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 3">
                  H3
                </button>
                <button type="button" onClick={() => formatText('insertUnorderedList')} className="p-2 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="글머리">
                  • 목록
                </button>
                <button type="button" onClick={() => formatText('insertOrderedList')} className="p-2 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="번호">
                  1. 목록
                </button>
                <button type="button" onClick={() => insertMarkdown('checkbox')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="체크박스">
                  ☑ 할일
                </button>
                {/* 마크다운 추가 기능 */}
                <button type="button" onClick={() => insertMarkdown('quote')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="인용구">
                  " 인용
                </button>
                <button type="button" onClick={() => insertMarkdown('code')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="코드">
                  {'<>'} 코드
                </button>
                <button type="button" onClick={() => insertMarkdown('link')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="링크">
                  🔗 링크
                </button>
                {/* 이미지 업로드 버튼 */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 disabled:opacity-50"
                  title="이미지 추가"
                >
                  {isUploading ? '⏳' : '📷'} 이미지
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-b-lg overflow-hidden px-2">
                <div
                  ref={editorRef}
                  contentEditable
                  onKeyDown={handleEditorKeyDown}
                  onInput={handleEditorInput}
                  className="min-h-[200px] py-3 text-[14px] text-gray-900 dark:text-white focus:outline-none"
                  style={{ whiteSpace: 'pre-wrap' }}
                  suppressContentEditableWarning
                  data-placeholder="오늘 하루를 기록해보세요..."
                />
              </div>
            </div>

            <div className="mt-3 -mx-4 sm:-mx-5 px-2 flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : (editingId ? '수정' : '저장')}
              </button>
              <button
                onClick={() => {
                  setInlineColorPickerPos(null);
                  setShowEditor(false);
                  setFormData({ title: '', content: '' });
                  setEditingId(null);
                }}
                className="px-4 py-2.5 text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소
              </button>
            </div>
            
            {message && (
              <div className={`mt-2 text-sm text-center ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </div>
            )}
          </div>

          {inlineColorPickerPos && (
            <div
              ref={inlineColorPickerRef}
              role="dialog"
              aria-label="글자 색 선택"
              className="fixed z-[200] rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl p-2.5 w-[200px]"
              style={{ top: inlineColorPickerPos.top, left: inlineColorPickerPos.left }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">대표 색상</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  title="기본 글자색"
                  onClick={() => pickInlineDefaultColor()}
                  className="px-2 py-1 text-[11px] rounded-md border border-gray-300 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100"
                >
                  기본
                </button>
                {TEXT_COLOR_PRESETS.map(({ hex, label }) => (
                  <button
                    key={`inline-${hex}`}
                    type="button"
                    title={label}
                    onClick={() => pickInlineColor(hex)}
                    className="w-7 h-7 min-w-[1.75rem] rounded-md border border-gray-300 dark:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ backgroundColor: hex }}
                  />
                ))}
                <button
                  type="button"
                  title="색 직접 선택"
                  onClick={() => textColorInputRef.current?.click()}
                  className="px-2 py-1 text-[11px] rounded-md border border-dashed border-gray-400 dark:border-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  🎨 직접
                </button>
              </div>
            </div>
          )}
          </>
        )}

        {/* 메모 목록 */}
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : ''}>
          {displayedMemos.length > 0 ? (
            displayedMemos.map(renderMemoCard)
          ) : (
            !isLoading && (
              <div className="text-center text-sm text-gray-400 dark:text-gray-500 py-12 col-span-2">
                작성된 글이 없습니다
              </div>
            )
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => loadMemos(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
            >
              이전
            </button>
            
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={() => loadMemos(currentPage + 1)}
              disabled={currentPage >= totalPages || isLoading}
              className="px-3 py-2 text-xs sm:text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-50"
            >
              다음
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-gray-400">로딩 중...</div>
          </div>
        )}
      </div>

      <FooterNav />

      <style jsx global>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: rgb(156 163 175);
          pointer-events: none;
        }
        
        .dark [contenteditable][data-placeholder]:empty:before {
          color: rgb(107 114 128);
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
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
