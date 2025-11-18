'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '../../lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GlobalNav } from '../components/GlobalNav';
import { FooterNav } from '../components/FooterNav';

interface Memo {
  id?: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

export default function MemoPage() {
  const supabase = getSupabase();
  const pathname = usePathname();
  const [showEditor, setShowEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);
  
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

  // 에디터 내용 업데이트
  const handleEditorInput = () => {
    if (editorRef.current) {
      setFormData(prev => ({
        ...prev,
        content: editorRef.current?.innerHTML || '',
      }));
    }
  };

  // 에디터 포맷 버튼 핸들러
  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  };

  // 메모 목록 로드
  const loadMemos = useCallback(async (pageNum: number = 1) => {
    if (!supabase) {
      console.warn('Supabase 클라이언트가 없습니다.');
      return;
    }
    
    setIsLoading(true);
    try {
      // 전체 개수 조회
      const { count, error: countError } = await supabase
        .from('memos')
        .select('*', { count: 'exact', head: true });

      if (countError) {
        console.error('전체 개수 조회 오류');
      } else {
        setTotalCount(count || 0);
      }

      // 페이지네이션으로 데이터 로드
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

  // 초기 메모 목록 로드
  useEffect(() => {
    loadMemos(1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        // 수정 모드
        const { error } = await supabase
          .from('memos')
          .update({
            title: formData.title,
            content: editorContent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) {
          console.error('업데이트 에러');
          throw error;
        }

        setMessage('✅ 수정되었습니다!');
      } else {
        // 새 글 작성
        const { error } = await supabase
          .from('memos')
          .insert([{
            title: formData.title,
            content: editorContent,
          }]);

        if (error) {
          console.error('삽입 에러');
          throw error;
        }

        setMessage('✅ 저장되었습니다!');
      }

      setShowEditor(false);
      setFormData({ title: '', content: '' });
      setEditingId(null);
      
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      
      await loadMemos(1);
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      console.error('저장 실패');
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
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
        editorRef.current.focus();
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
        console.error('삭제 에러');
        alert('삭제에 실패했습니다.');
        return;
      }
      
      await loadMemos(currentPage);
    } catch (err) {
      console.error('삭제 실패');
      alert('삭제에 실패했습니다.');
    }
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

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pb-20">
      <GlobalNav />
      
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">

        {!showEditor && (
          <div className="mb-2">
            <button
              onClick={handleWrite}
              className="w-full px-4 py-3 text-base font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              <span>✏️</span>
              <span>글쓰기</span>
            </button>
          </div>
        )}

        {showEditor && (
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-2">
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                제목
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="제목을 입력하세요"
                className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[44px]"
              />
            </div>
            
            <div className="mb-2">
              <label className="block text-lg sm:text-xl font-medium text-gray-700 dark:text-gray-300 mb-1">
                📝 Diary 작성
              </label>
            </div>

            <div className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-t-lg p-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => formatText('bold')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="굵게"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                onClick={() => formatText('italic')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="기울임"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                onClick={() => formatText('underline')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="밑줄"
              >
                <u>U</u>
              </button>
              <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
              <button
                type="button"
                onClick={() => formatText('insertUnorderedList')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] flex items-center justify-center"
                title="글머리 기호"
              >
                • 목록
              </button>
              <button
                type="button"
                onClick={() => formatText('insertOrderedList')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] flex items-center justify-center"
                title="번호 목록"
              >
                1. 목록
              </button>
              <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
              <button
                type="button"
                onClick={() => formatText('formatBlock', '<h2>')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] flex items-center justify-center"
                title="제목"
              >
                제목
              </button>
              <button
                type="button"
                onClick={() => formatText('removeFormat')}
                className="px-4 py-3 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 min-h-[44px] flex items-center justify-center"
                title="서식 제거"
              >
                서식 제거
              </button>
            </div>

            <div className="bg-white dark:bg-gray-700 border-x border-b border-gray-300 dark:border-gray-600 rounded-b-lg overflow-hidden">
              <div
                ref={editorRef}
                contentEditable
                onInput={handleEditorInput}
                className="min-h-[200px] p-3 text-base text-gray-900 dark:text-white focus:outline-none"
                style={{ whiteSpace: 'pre-wrap' }}
                suppressContentEditableWarning
                data-placeholder="오늘 하루를 기록해보세요..."
              />
            </div>

            <div className="mt-2 flex gap-2 sm:gap-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-3 text-base font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>{isSaving ? '⏳' : '💾'}</span>
                <span>{isSaving ? '저장 중...' : (editingId ? '수정' : '저장')}</span>
              </button>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setFormData({ title: '', content: '' });
                  setEditingId(null);
                }}
                className="px-4 py-3 text-base font-medium bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]"
              >
                취소
              </button>
            </div>
            
            {message && (
              <div className={`mt-2 text-base text-center ${message.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {message}
              </div>
            )}
          </div>
        )}

        {totalCount > 0 && (
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-400 text-center">
            전체 {totalCount}개의 글
          </div>
        )}

        <div className="space-y-2">
          {displayedMemos.length > 0 ? (
            <>
              {displayedMemos.map((memo) => (
                <div
                  key={memo.id}
                  className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex-1">
                      {memo.title || '제목 없음'}
                    </h3>
                    <div className="flex -mr-4 sm:-mr-5">
                      <button
                        onClick={() => handleEdit(memo)}
                        className="px-0 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -mr-4"
                        aria-label="수정"
                      >
                        <span>✏️</span>
                      </button>
                      <button
                        onClick={() => handleDelete(memo)}
                        className="px-0 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="삭제"
                      >
                        <span>🗑️</span>
                      </button>
                    </div>
                  </div>
                  <div 
                    className="text-base text-gray-700 dark:text-gray-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                    dangerouslySetInnerHTML={{ __html: memo.content }}
                  />
                </div>
              ))}
              
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2 mb-2">
                  <button
                    onClick={() => loadMemos(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                    className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    이전
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(pageNum => {
                        return pageNum === 1 || 
                               pageNum === totalPages ||
                               (pageNum >= currentPage - 2 && pageNum <= currentPage + 2);
                      })
                      .map((pageNum, index, array) => {
                        const showEllipsis = index > 0 && pageNum - array[index - 1] > 1;
                        return (
                          <div key={pageNum} className="flex items-center gap-1">
                            {showEllipsis && (
                              <span className="px-2 text-gray-400 dark:text-gray-500">...</span>
                            )}
                            <button
                              onClick={() => loadMemos(pageNum)}
                              disabled={isLoading}
                              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {pageNum}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                  
                  <button
                    onClick={() => loadMemos(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                    className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                  >
                    다음
                  </button>
                </div>
              )}
              
              {isLoading && (
                <div className="h-10 flex items-center justify-center">
                  <div className="text-gray-400 dark:text-gray-500 text-base">
                    로딩 중...
                  </div>
                </div>
              )}
            </>
          ) : (
            !isLoading && (
              <div className="text-center text-base text-gray-400 dark:text-gray-500 py-8">
                작성된 메모가 없습니다
              </div>
            )
          )}
        </div>
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
      `}</style>
    </div>
  );
}