'use client';

import { useState, useEffect, useCallback, useRef, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '../../lib/supabase';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { SwipeNav } from '../components/SwipeNav';
import { APP_CONTENT_CONTAINER, APP_HORIZONTAL_CONTAINER } from '../components/container';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 이미지 업로드 최대 크기 (5MB)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
  const [editorMode, setEditorMode] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 모바일 지원: 마지막 커서 위치 저장 (blur 시 손실 방지)
  const lastSelectionRef = useRef({ start: 0, end: 0 });
  
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

  // Textarea 내용 업데이트
  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    // onChange는 React의 input 이벤트와 매핑 → 한글 IME 포함 모든 입력에서 발생
    // 여기서 커서 위치를 저장해야 Android에서 정확한 위치에 삽입 가능
    lastSelectionRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
    setFormData(prev => ({
      ...prev,
      content: e.target.value,
    }));
  };

  // 툴바 버튼 공통 핸들러 (모바일: onTouchEnd, 데스크톱: onClick)
  const handleToolbarAction = (syntax: 'bold' | 'italic' | 'underline' | 'h1' | 'h2' | 'h3' | 'list' | 'quote' | 'code' | 'link' | 'checkbox') =>
    (e: React.TouchEvent | React.MouseEvent) => {
      e.preventDefault(); // 터치: click 합성 차단 + 포커스 이동 방지
      // onTouchEnd 시점에는 textarea가 아직 포커스 유지 → selectionStart 유효
      if (textareaRef.current) {
        lastSelectionRef.current = {
          start: textareaRef.current.selectionStart,
          end: textareaRef.current.selectionEnd,
        };
      }
      insertMarkdownSyntax(syntax);
    };

  // Textarea 마크다운 삽입 함수
  const insertMarkdownSyntax = (syntax: 'bold' | 'italic' | 'underline' | 'h1' | 'h2' | 'h3' | 'list' | 'quote' | 'code' | 'link' | 'checkbox') => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    
    // 모바일 지원: 저장된 마지막 커서 위치 사용 (blur로 손실된 selection 복구)
    const start = lastSelectionRef.current.start;
    const end = lastSelectionRef.current.end;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);
    
    let newText = '';
    let cursorOffset = 0;
    
    switch (syntax) {
      case 'bold':
        newText = `**${selectedText || '텍스트'}**`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'italic':
        newText = `*${selectedText || '텍스트'}*`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'underline':
        newText = `<u>${selectedText || '텍스트'}</u>`;
        cursorOffset = selectedText ? newText.length : 3;
        break;
      case 'h1':
        newText = `# ${selectedText || '제목 1'}`;
        cursorOffset = newText.length;
        break;
      case 'h2':
        newText = `## ${selectedText || '제목 2'}`;
        cursorOffset = newText.length;
        break;
      case 'h3':
        newText = `### ${selectedText || '제목 3'}`;
        cursorOffset = newText.length;
        break;
      case 'list':
        newText = `- ${selectedText || '목록 항목'}`;
        cursorOffset = newText.length;
        break;
      case 'quote':
        newText = `> ${selectedText || '인용구'}`;
        cursorOffset = newText.length;
        break;
      case 'code':
        if (selectedText.includes('\n')) {
          newText = `\`\`\`\n${selectedText || '코드'}\n\`\`\``;
        } else {
          newText = `\`${selectedText || '코드'}\``;
        }
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'link':
        const url = prompt('링크 URL을 입력하세요:', 'https://');
        if (url) {
          newText = `[${selectedText || '링크'}](${url})`;
          cursorOffset = newText.length;
        }
        break;
      case 'checkbox':
        newText = `- [ ] ${selectedText || '할 일'}`;
        cursorOffset = newText.length;
        break;
      default:
        return;
    }
    
    const updatedContent = beforeText + newText + afterText;
    setFormData(prev => ({ ...prev, content: updatedContent }));
    
    // 모바일 지원: requestAnimationFrame + setTimeout으로 확실한 커서 위치 설정
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = start + cursorOffset;
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 50);
    });
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

      // Textarea에 마크다운 이미지 삽입
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const beforeText = textarea.value.substring(0, start);
        const afterText = textarea.value.substring(end);
        
        const markdownImage = `![${file.name}](${imageUrl})\n`;
        const updatedContent = beforeText + markdownImage + afterText;
        
        setFormData(prev => ({ ...prev, content: updatedContent }));
        
        // 커서 위치 설정
        setTimeout(() => {
          if (textarea) {
            const newCursorPos = start + markdownImage.length;
            textarea.focus();
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
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
          setEditorMode('write');
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
    
    if (!formData.content.trim()) {
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
            content: formData.content,
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
            content: formData.content,
          }]);

        if (error) throw error;
        setMessage('✅ 저장되었습니다!');
      }

      setShowEditor(false);
      setFormData({ title: '', content: '' });
      setEditingId(null);
      setEditorMode('write');
      
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
    setShowEditor(true);
    setEditingId(null);
    setFormData({ title: '', content: '' });
    setEditorMode('write');
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  };

  const handleEdit = (memo: Memo) => {
    setShowEditor(true);
    setEditingId(memo.id || null);
    setFormData({
      title: memo.title,
      content: memo.content,
    });
    setEditorMode('write');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // HTML/마크다운 판별 및 미리보기 생성
    const isHtml = /<[a-z][\s\S]*>/i.test(memo.content);
    let textPreview = '';
    
    if (isHtml) {
      // 기존 HTML 글: HTML에서 텍스트 추출
      textPreview = extractText(memo.content).substring(0, 150);
    } else {
      // 새 마크다운 글: 마크다운 기호 제거하고 텍스트만
      textPreview = memo.content
        .replace(/[#*`>\-\[\]]/g, '')  // 마크다운 기호 제거
        .replace(/!\[.*?\]\(.*?\)/g, '[이미지]')  // 이미지 링크 → [이미지]
        .trim()
        .substring(0, 150);
    }
    
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
            {/* 제목 입력 */}
            <div className="mb-3">
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="제목을 입력하세요"
                className="w-full px-0 py-2 text-base sm:text-lg font-semibold bg-transparent text-gray-900 dark:text-white border-0 border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 작성/미리보기 탭 */}
            <div className="flex gap-2 mb-3 border-b border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setEditorMode('write')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  editorMode === 'write'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                ✏️ 작성
              </button>
              <button
                onClick={() => setEditorMode('preview')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  editorMode === 'preview'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                👁️ 미리보기
              </button>
            </div>

            {/* 툴바 (작성 모드에서만 표시) */}
            {editorMode === 'write' && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-2 mb-2 flex flex-wrap gap-1 items-center">
                <button type="button" onTouchEnd={handleToolbarAction('bold')} onClick={handleToolbarAction('bold')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="굵게">
                  <strong>B</strong>
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('italic')} onClick={handleToolbarAction('italic')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="기울임">
                  <em>I</em>
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('underline')} onClick={handleToolbarAction('underline')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="밑줄">
                  <u>U</u>
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('h1')} onClick={handleToolbarAction('h1')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 1">
                  H1
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('h2')} onClick={handleToolbarAction('h2')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 2">
                  H2
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('h3')} onClick={handleToolbarAction('h3')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 3">
                  H3
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('list')} onClick={handleToolbarAction('list')} className="p-2 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="목록">
                  • 목록
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('checkbox')} onClick={handleToolbarAction('checkbox')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="할일">
                  ☑ 할일
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('quote')} onClick={handleToolbarAction('quote')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="인용구">
                  " 인용
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('code')} onClick={handleToolbarAction('code')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="코드">
                  {'<>'} 코드
                </button>
                <button type="button" onTouchEnd={handleToolbarAction('link')} onClick={handleToolbarAction('link')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="링크">
                  🔗 링크
                </button>
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
                  onTouchEnd={(e) => { e.preventDefault(); fileInputRef.current?.click(); }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 disabled:opacity-50"
                  title="이미지 추가"
                >
                  {isUploading ? '⏳' : '📷'} 이미지
                </button>
              </div>
            )}

            {/* 에디터/미리보기 영역 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {editorMode === 'write' ? (
                <textarea
                  ref={textareaRef}
                  value={formData.content}
                  onChange={handleTextareaChange}
                  onSelect={(e) => {
                    // 모바일 지원: 커서 위치 변경 시 항상 저장 (blur 시 손실 방지)
                    const target = e.target as HTMLTextAreaElement;
                    lastSelectionRef.current = {
                      start: target.selectionStart,
                      end: target.selectionEnd,
                    };
                  }}
                  onClick={(e) => {
                    // 모바일 지원: 클릭 시에도 저장
                    const target = e.target as HTMLTextAreaElement;
                    lastSelectionRef.current = {
                      start: target.selectionStart,
                      end: target.selectionEnd,
                    };
                  }}
                  onKeyUp={(e) => {
                    // 타이핑 후 커서 이동 시에도 저장 (Android에서 onSelect 미발생 보완)
                    const target = e.target as HTMLTextAreaElement;
                    lastSelectionRef.current = {
                      start: target.selectionStart,
                      end: target.selectionEnd,
                    };
                  }}
                  placeholder="마크다운으로 작성하세요...&#10;&#10;# 제목&#10;## 부제목&#10;**굵게** *기울임*&#10;- 목록 항목&#10;> 인용구&#10;```코드```"
                  className="w-full min-h-[300px] p-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none resize-none"
                  style={{ fontFamily: 'inherit' }}
                />
              ) : (
                <div className="p-3 min-h-[300px] text-sm text-gray-900 dark:text-white prose prose-sm dark:prose-invert max-w-none">
                  {formData.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {formData.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-gray-400">미리보기할 내용이 없습니다.</p>
                  )}
                </div>
              )}
            </div>

            {/* 저장/취소 버튼 */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : (editingId ? '수정' : '저장')}
              </button>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setFormData({ title: '', content: '' });
                  setEditingId(null);
                  setEditorMode('write');
                }}
                className="px-4 py-2.5 text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                취소
              </button>
            </div>

            {/* 메시지 표시 */}
            {message && (
              <div className={`mt-2 text-sm text-center ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </div>
            )}
          </div>
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
