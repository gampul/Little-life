'use client';

import { useState, useEffect, useCallback, useRef, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '../../lib/supabase';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';
import { AuthGuard } from '../components/AuthGuard';
import { SwipeNav } from '../components/SwipeNav';
import { APP_CONTENT_CONTAINER, APP_HORIZONTAL_CONTAINER } from '../components/container';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

// 아이콘 컴포넌트
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 7H6a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
    <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
    <path d="M16 5l3 3" />
  </svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 7l16 0" />
    <path d="M10 11l0 6" />
    <path d="M14 11l0 6" />
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 뷰 모드 상태
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  // 좋아요 상태 (로컬)
  const [likedMemos, setLikedMemos] = useState<Set<string>>(new Set());
  
  // 링크 복사 상태
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  
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

  // Tiptap 에디터 초기화
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-700',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded my-2',
        },
      }),
      Placeholder.configure({
        placeholder: '오늘의 생각을 기록하세요...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setFormData(prev => ({ ...prev, content: editor.getHTML() }));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200',
      },
    },
  });

  // 에디터 내용 업데이트 (편집 모드 진입 시)
  useEffect(() => {
    if (editor && showEditor) {
      editor.commands.setContent(formData.content || '');
    }
  }, [editor, showEditor]);

  // 이미지 업로드 핸들러
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !editor) return;

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

      // Tiptap 에디터에 이미지 삽입
      editor.chain().focus().setImage({ src: imageUrl }).run();

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

  // 링크 복사
  const handleCopyLink = (e: React.MouseEvent, memoId: string) => {
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
      
      if (editor) {
        editor.commands.setContent('');
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
    setShowEditor(true);
    setEditingId(null);
    setFormData({ title: '', content: '' });
    if (editor) {
      editor.commands.setContent('');
      setTimeout(() => {
        editor.commands.focus();
      }, 100);
    }
  };

  const handleEdit = (memo: Memo) => {
    setShowEditor(true);
    setEditingId(memo.id || null);
    setFormData({
      title: memo.title,
      content: memo.content,
    });
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
    // HTML 텍스트 추출 및 미리보기 생성
    const textPreview = extractText(memo.content).substring(0, 150);
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
              onClick={(e) => handleCopyLink(e, memo.id || '')}
              className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              style={{ touchAction: 'manipulation' }}
              title="링크 복사"
            >
              {copiedId === memo.id ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5l10 -10" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 15l6 -6" />
                  <path d="M11 6l.463 -.536a5 5 0 0 1 7.072 7.072l-.535 .464" />
                  <path d="M13 18l-.464 .536a5 5 0 0 1 -7.071 -7.071l.535 -.465" />
                </svg>
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleEdit(memo); }}
              className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <IconEdit />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(memo); }}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              style={{ touchAction: 'manipulation' }}
            >
              <IconTrash />
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
                <button
                  onClick={(e) => handleCopyLink(e, memo.id || '')}
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                  title="링크 복사"
                >
                  {copiedId === memo.id ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                      fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5l10 -10" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 15l6 -6" />
                      <path d="M11 6l.463 -.536a5 5 0 0 1 7.072 7.072l-.535 .464" />
                      <path d="M13 18l-.464 .536a5 5 0 0 1 -7.071 -7.071l.535 -.465" />
                    </svg>
                  )}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEdit(memo); }} 
                  className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <IconEdit />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(memo); }} 
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  style={{ touchAction: 'manipulation' }}
                >
                  <IconTrash />
                </button>
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
                onClick={(e) => handleCopyLink(e, memo.id || '')}
                className="ml-auto p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                style={{ touchAction: 'manipulation' }}
                title="링크 복사"
              >
                {copiedId === memo.id ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5l10 -10" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 15l6 -6" />
                    <path d="M11 6l.463 -.536a5 5 0 0 1 7.072 7.072l-.535 .464" />
                    <path d="M13 18l-.464 .536a5 5 0 0 1 -7.071 -7.071l.535 -.465" />
                  </svg>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleEdit(memo); }}
                className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <IconEdit />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(memo); }}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                style={{ touchAction: 'manipulation' }}
              >
                <IconTrash />
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
              
            </div>
          </div>
        )}

        {/* Tiptap 에디터 */}
        {showEditor && editor && (
          <>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-4">
            {/* 제목 입력 */}
            <input
              type="text"
              value={formData.title || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="제목"
              className="w-full px-5 pt-5 pb-3 text-xl font-bold bg-transparent text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 border-0 outline-none"
            />
            <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />

            {/* 툴바 */}
            <div 
              className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-hide"
              style={{ touchAction: 'manipulation' }}
            >
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${editor.isActive('bold') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="굵게 (Ctrl+B)"
              >
                <strong>B</strong>
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${editor.isActive('italic') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="기울임 (Ctrl+I)"
              >
                <em>I</em>
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                disabled={!editor.can().chain().focus().toggleUnderline().run()}
                className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${editor.isActive('underline') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="밑줄 (Ctrl+U)"
              >
                <u>U</u>
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="제목 1"
              >
                H1
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="제목 2"
              >
                H2
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="제목 3"
              >
                H3
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('bulletList') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="목록"
              >
                • 목록
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('taskList') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="할일"
              >
                ☑ 할일
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('blockquote') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="인용구"
              >
                " 인용
              </button>
              <button 
                type="button" 
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('codeBlock') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="코드"
              >
                {'<>'} 코드
              </button>
              <button 
                type="button" 
                onClick={() => {
                  const url = prompt('링크 URL을 입력하세요:', 'https://');
                  if (url) {
                    editor.chain().focus().setLink({ href: url }).run();
                  }
                }}
                className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${editor.isActive('link') ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                title="링크"
              >
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
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex-shrink-0 h-11 px-3 flex items-center justify-center gap-1 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                title="이미지 추가"
              >
                {isUploading ? '⏳' : '📷'} 이미지
              </button>
            </div>

            {/* Tiptap 에디터 */}
            <EditorContent editor={editor} />

            {/* 저장/취소 버튼 */}
            <div className="flex gap-2 px-4 py-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : (editingId ? '수정 완료' : '저장')}
              </button>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setFormData({ title: '', content: '' });
                  setEditingId(null);
                  if (editor) {
                    editor.commands.setContent('');
                  }
                }}
                className="h-12 px-6 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl transition-colors"
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

        {/* FAB: 글쓰기 버튼 */}
        {!showEditor && (
          <button
            onClick={handleWrite}
            className="fixed bottom-24 right-4 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-lg flex items-center justify-center transition-all"
            style={{ touchAction: 'manipulation' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
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

      <FooterNav />

      <style jsx global>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* Tiptap 에디터 스타일 */
        .ProseMirror {
          outline: none;
          min-height: 280px;
          padding: 1rem 1.25rem;
          font-size: 0.875rem;
          line-height: 1.75;
        }
        
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #d1d5db;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        
        .dark .ProseMirror p.is-editor-empty:first-child::before {
          color: #4b5563;
        }
        
        /* 가로 스크롤바 숨기기 */
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .ProseMirror h1 {
          font-size: 2em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        
        .ProseMirror ul[data-type="taskList"] li > label {
          flex: 0 0 auto;
          margin-right: 0.5rem;
          user-select: none;
        }
        
        .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1 1 auto;
        }
        
        .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {
          cursor: pointer;
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
