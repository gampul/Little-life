'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GlobalNav } from '../components/GlobalNav';
import { AIAgentModal } from '../components/AIAgentModal';

interface DailyRecord {
  id?: string;
  date: string;
  daily_memo: string;
  title?: string;
}

export default function MemoPage() {
  const supabase = getSupabase();
  const [showEditor, setShowEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [memoViewMode, setMemoViewMode] = useState<'edit' | 'preview'>('edit');
  const [isAIAgentOpen, setIsAIAgentOpen] = useState(false);
  
  // 무한 스크롤 관련 상태
  const [displayedRecords, setDisplayedRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const observerTarget = useRef<HTMLDivElement>(null);

  const todayDate = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState<DailyRecord>({
    date: todayDate,
    daily_memo: '',
    title: '',
  });

  const handleInputChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      daily_memo: value,
    }));
  };

  // Tiptap 에디터 설정
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        link: false,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Placeholder.configure({
        placeholder: '오늘 하루를 기록해보세요...',
      }),
    ],
    content: formData.daily_memo || '',
    editable: showEditor,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      handleInputChange(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
  });

  // 에디터 내용 동기화
  useEffect(() => {
    if (editor) {
      const currentContent = editor.getHTML();
      const newContent = formData.daily_memo || '';
      
      if (currentContent !== newContent) {
        if (newContent.trim().startsWith('<')) {
          editor.commands.setContent(newContent);
        } else if (!newContent.trim()) {
          editor.commands.setContent('');
        }
      }
    }
  }, [formData.daily_memo, editor]);

  // 편집 모드 변경 시 에디터 활성화/비활성화
  useEffect(() => {
    if (editor) {
      editor.setEditable(showEditor);
    }
  }, [showEditor, editor]);

  // 무한 스크롤로 메모 목록 로드
  const loadMoreRecords = useCallback(async (pageNum: number, reset: boolean = false) => {
    if (!supabase) {
      console.warn('Supabase 클라이언트가 없습니다.');
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_records')
        .select('id, date, daily_memo, title')
        .not('daily_memo', 'is', null)
        .neq('daily_memo', '')
        .order('date', { ascending: false })
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (error && error.code === 'PGRST204') {
        const { data: retryData, error: retryError } = await supabase
          .from('daily_records')
          .select('id, date, daily_memo')
          .not('daily_memo', 'is', null)
          .neq('daily_memo', '')
          .order('date', { ascending: false })
          .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);
        
        if (retryError) {
          console.error('메모 목록 조회 오류');
          setIsLoading(false);
          return;
        }
        
        if (retryData && retryData.length > 0) {
          if (reset) {
            setDisplayedRecords(retryData);
          } else {
            setDisplayedRecords(prev => [...prev, ...retryData]);
          }
          setHasMore(retryData.length === pageSize);
          setPage(pageNum);
        } else {
          setHasMore(false);
        }
        setIsLoading(false);
        return;
      }

      if (error) {
        console.error('메모 목록 조회 오류');
        setIsLoading(false);
        return;
      }

      if (data && data.length > 0) {
        if (reset) {
          setDisplayedRecords(data);
        } else {
          setDisplayedRecords(prev => [...prev, ...data]);
        }
        setHasMore(data.length === pageSize);
        setPage(pageNum);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('예상치 못한 오류');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, pageSize]);

  // 초기 메모 목록 로드
  useEffect(() => {
    loadMoreRecords(0, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 무한 스크롤 감지
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreRecords(page + 1, false);
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasMore, isLoading, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!supabase) {
      setMessage('❌ Supabase 연결이 설정되지 않았습니다.');
      return;
    }
    
    setIsSaving(true);
    setMessage('');

    try {
      const { data: existingData, error: checkError } = await supabase
        .from('daily_records')
        .select('id')
        .eq('date', formData.date)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('체크 에러');
        throw checkError;
      }

      if (existingData) {
        const updateData: any = {
          daily_memo: formData.daily_memo,
          updated_at: new Date().toISOString(),
        };
        
        if (formData.title) {
          updateData.title = formData.title;
        }

        const { error } = await supabase
          .from('daily_records')
          .update(updateData)
          .eq('date', formData.date);

        if (error) {
          if (error.code === 'PGRST204') {
            const { error: retryError } = await supabase
              .from('daily_records')
              .update({
                daily_memo: formData.daily_memo,
                updated_at: new Date().toISOString(),
              })
              .eq('date', formData.date);
            
            if (retryError) {
              console.error('업데이트 에러');
              throw retryError;
            }
          } else {
            console.error('업데이트 에러');
            throw error;
          }
        }
      } else {
        const insertData: any = {
          date: formData.date,
          daily_memo: formData.daily_memo,
          weight: null,
          meal_breakfast: false,
          meal_lunch: false,
          meal_dinner: false,
          meal_memo: '',
        };
        
        if (formData.title) {
          insertData.title = formData.title;
        }

        const { error } = await supabase
          .from('daily_records')
          .insert([insertData]);

        if (error) {
          if (error.code === 'PGRST204') {
            const { error: retryError } = await supabase
              .from('daily_records')
              .insert([{
                date: formData.date,
                daily_memo: formData.daily_memo,
                weight: null,
                meal_breakfast: false,
                meal_lunch: false,
                meal_dinner: false,
                meal_memo: '',
              }]);
            
            if (retryError) {
              console.error('삽입 에러');
              throw retryError;
            }
          } else {
            console.error('삽입 에러');
            throw error;
          }
        }
      }

      setMessage('✅ 저장되었습니다!');
      
      const { data: savedData } = await supabase
        .from('daily_records')
        .select('id, date, daily_memo, title')
        .eq('date', formData.date)
        .maybeSingle();
      
      setShowEditor(false);
      setFormData({ date: todayDate, daily_memo: '', title: '' });
      if (editor) {
        editor.commands.setContent('');
      }
      
      try {
        await loadMoreRecords(0, true);
      } catch (refreshError) {
        console.warn('목록 새로고침 실패');
      }
      
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
    setFormData({ date: todayDate, daily_memo: '', title: '' });
    if (editor) {
      editor.commands.setContent('');
    }
    setMemoViewMode('edit');
  };

  const handleEdit = (record: DailyRecord) => {
    setShowEditor(true);
    setFormData({
      date: record.date,
      daily_memo: record.daily_memo,
      title: record.title || '',
    });
    if (editor) {
      editor.commands.setContent(record.daily_memo || '');
    }
    setMemoViewMode('edit');
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
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
      <GlobalNav onAIAgentClick={() => setIsAIAgentOpen(true)} />
      
      <div className="max-w-[480px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {isAIAgentOpen && (
          <AIAgentModal
            onClose={() => setIsAIAgentOpen(false)}
          />
        )}

        {!showEditor && (
          <div className="mb-4">
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
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-3 sm:mb-4 shadow-sm">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
            <div className="flex items-center justify-between mb-3">
              <label className="block text-base font-medium text-gray-700 dark:text-gray-300">
                📝 Diary 작성
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMemoViewMode('edit')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    memoViewMode === 'edit'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  편집
                </button>
                <button
                  type="button"
                  onClick={() => setMemoViewMode('preview')}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    memoViewMode === 'preview'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  미리보기
                </button>
              </div>
            </div>
            {memoViewMode === 'edit' ? (
              <>
                {editor && (
                  <div className="flex flex-wrap gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 ${
                      editor.isActive('bold') ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="굵게"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 ${
                      editor.isActive('italic') ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="기울임"
                  >
                    <em>I</em>
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    disabled={!editor.can().chain().focus().toggleCode().run()}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 font-mono ${
                      editor.isActive('code') ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="코드"
                  >
                    {'</>'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = window.prompt('링크 URL을 입력하세요:');
                      if (url) {
                        editor.chain().focus().setLink({ href: url }).run();
                      }
                    }}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 ${
                      editor.isActive('link') ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="링크 삽입"
                  >
                    🔗
                  </button>
                  <label className="px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 cursor-pointer">
                    📷
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          alert('이미지 크기는 5MB 이하여야 합니다.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          if (editor) {
                            editor.chain().focus().setImage({ src: base64 }).run();
                          }
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 ${
                      editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="제목 1"
                  >
                    H1
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    disabled={!editor.can().chain().focus().toggleBulletList().run()}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 ${
                      editor.isActive('bulletList') ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="리스트"
                  >
                    •
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    disabled={!editor.can().chain().focus().toggleOrderedList().run()}
                    className={`px-2 py-1 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-500 disabled:opacity-50 ${
                      editor.isActive('orderedList') ? 'bg-blue-100 dark:bg-blue-900/30' : ''
                    }`}
                    title="번호 리스트"
                  >
                    1.
                  </button>
                </div>
              )}
                <div className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg min-h-[200px] overflow-y-auto">
                  <EditorContent 
                    editor={editor}
                    className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:px-4 [&_.ProseMirror]:py-3 [&_.ProseMirror]:prose [&_.ProseMirror]:prose-sm [&_.ProseMirror]:dark:prose-invert [&_.ProseMirror]:max-w-none [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:text-gray-400 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:h-0"
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-3 text-base font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <span>{isSaving ? '⏳' : '💾'}</span>
                    <span>{isSaving ? '저장 중...' : '저장'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowEditor(false);
                      setFormData({ date: todayDate, daily_memo: '', title: '' });
                      if (editor) {
                        editor.commands.setContent('');
                      }
                    }}
                    className="px-4 py-3 text-base font-medium bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors min-h-[44px]"
                  >
                    취소
                  </button>
                </div>
                {message && (
                  <div className={`mt-3 text-sm text-center ${message.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {message}
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  💡 리치 텍스트 에디터: 툴바 버튼을 사용하여 텍스트를 서식화할 수 있습니다.
                </div>
              </>
            ) : (
              <div className="w-full px-4 py-3 text-base bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg min-h-[200px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                {formData.daily_memo ? (
                  <div dangerouslySetInnerHTML={{ __html: formData.daily_memo }} />
                ) : (
                  <p className="text-gray-400 dark:text-gray-500">메모를 작성하면 미리보기가 표시됩니다.</p>
                )}
              </div>
            )}
        </div>
        )}

        <div className="space-y-4">
          {displayedRecords.length > 0 ? (
            <>
              {(() => {
                const groupedByDate = displayedRecords.reduce((acc, record) => {
                  const date = record.date;
                  if (!acc[date]) {
                    acc[date] = [];
                  }
                  acc[date].push(record);
                  return acc;
                }, {} as Record<string, DailyRecord[]>);

                const sortedDates = Object.keys(groupedByDate).sort((a, b) => 
                  new Date(b).getTime() - new Date(a).getTime()
                );

                return sortedDates.map((date) => (
                  <div key={date} className="space-y-2">
                    {groupedByDate[date].map((record) => (
                      <div
                        key={record.id || record.date}
                        className="bg-gray-50 dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex-1">
                            {record.title || '제목 없음'}
                          </h3>
                          <button
                            onClick={() => handleEdit(record)}
                            className="px-3 py-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors min-h-[36px] flex items-center gap-1.5"
                          >
                            <span>✏️</span>
                            <span>수정</span>
                          </button>
                        </div>
                        <div className="text-base text-gray-700 dark:text-gray-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                          {record.daily_memo.trim().startsWith('<') ? (
                            <div dangerouslySetInnerHTML={{ __html: record.daily_memo }} />
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {record.daily_memo}
                            </ReactMarkdown>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
              
              <div ref={observerTarget} className="h-10 flex items-center justify-center">
                {isLoading && (
                  <div className="text-gray-400 dark:text-gray-500 text-sm">
                    로딩 중...
                  </div>
                )}
                {!hasMore && displayedRecords.length > 0 && (
                  <div className="text-gray-400 dark:text-gray-500 text-sm">
                    모든 메모를 불러왔습니다
                  </div>
                )}
              </div>
            </>
          ) : (
            !isLoading && (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                작성된 메모가 없습니다
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}