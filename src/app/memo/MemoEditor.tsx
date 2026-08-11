'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { getSupabase } from '../../lib/supabase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface MemoEditorCategory {
  id: string;
  name: string;
}

export interface MemoEditorProps {
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  categories: MemoEditorCategory[];
  selectedCategoryId: string | null;
  onCategoryChange: (id: string | null) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  message: string;
  isEditing: boolean;
  /** 편집 대상이 바뀔 때 에디터 본문 리셋용 */
  contentKey: string | null;
}

function ToolbarDivider() {
  return (
    <div
      className="w-px h-6 mx-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-700 self-center"
      aria-hidden
    />
  );
}

function ToolbarGroup({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" role="group" aria-label={label}>
      {children}
    </div>
  );
}

function toolBtnClass(active: boolean) {
  return `flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800'
      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
  }`;
}

export default function MemoEditor({
  title,
  content,
  onTitleChange,
  onContentChange,
  categories,
  selectedCategoryId,
  onCategoryChange,
  onSave,
  onCancel,
  isSaving,
  message,
  isEditing,
  contentKey,
}: MemoEditorProps) {
  const supabase = getSupabase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class:
            'text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-700',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded my-2',
        },
      }),
      Placeholder.configure({
        placeholder: '본문을 입력하세요...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
      }),
    ],
    content: content || '',
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none bg-transparent text-gray-800 dark:text-gray-200',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = content || '';
    if (current !== next) {
      editor.commands.setContent(next);
    }
    // contentKey 변경(새 글/다른 글 편집) 시에만 동기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, contentKey]);

  useEffect(() => {
    if (editor) {
      setTimeout(() => editor.commands.focus('end'), 100);
    }
  }, [editor]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !editor) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadMessage('❌ 이미지 크기는 5MB 이하만 가능합니다.');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setUploadMessage('❌ 이미지 파일만 업로드 가능합니다.');
      setTimeout(() => setUploadMessage(''), 3000);
      return;
    }

    setIsUploading(true);
    setUploadMessage('📷 이미지 업로드 중...');

    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const extension = file.name.split('.').pop() || 'jpg';
      const fileName = `${timestamp}_${randomStr}.${extension}`;

      const { error } = await supabase.storage
        .from('diary-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('diary-images')
        .getPublicUrl(fileName);

      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
      setUploadMessage('✅ 이미지가 추가되었습니다!');
      setTimeout(() => setUploadMessage(''), 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      let errorMessage = '이미지 업로드에 실패했습니다.';
      if (msg.includes('bucket')) {
        errorMessage =
          'Storage 버킷이 없습니다. Supabase에서 diary-images 버킷을 생성해주세요.';
      }
      setUploadMessage(`❌ ${errorMessage}`);
      setTimeout(() => setUploadMessage(''), 5000);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const displayMessage = uploadMessage || message;

  if (!editor) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 mb-4 text-center text-sm text-gray-400">
        에디터 로딩 중...
      </div>
    );
  }

  return (
    <>
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-4">
        {/* 제목 */}
        <div className="px-5 pt-5 pb-4">
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            제목
          </label>
          <input
            type="text"
            value={title || ''}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="글 제목을 입력하세요"
            className="w-full text-2xl sm:text-[1.65rem] font-bold leading-snug tracking-tight bg-transparent text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 border-0 outline-none"
          />
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-5" />

        {/* 카테고리 — select (값 처리: null / id 동일) */}
        <div className="px-5 py-4">
          <label
            htmlFor="memo-editor-category"
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2"
          >
            카테고리
          </label>
          <select
            id="memo-editor-category"
            value={selectedCategoryId ?? ''}
            onChange={(e) => onCategoryChange(e.target.value ? e.target.value : null)}
            style={{ touchAction: 'manipulation' }}
            className="w-full h-11 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          >
            <option value="">없음 (미분류)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-5" />

        {/* 서식 툴바 */}
        <div className="px-5 pt-3 pb-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">본문 서식</p>
          <div
            className="flex items-center gap-0 overflow-x-auto scrollbar-hide -mx-1 px-1"
            style={{ touchAction: 'manipulation' }}
          >
            <ToolbarGroup label="텍스트 스타일">
              <button
                type="button"
                title="굵게"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={toolBtnClass(editor.isActive('bold'))}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                title="기울임"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={toolBtnClass(editor.isActive('italic'))}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                title="밑줄"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={toolBtnClass(editor.isActive('underline'))}
              >
                <u>U</u>
              </button>
            </ToolbarGroup>

            <ToolbarDivider />

            <ToolbarGroup label="제목">
              <button
                type="button"
                title="제목 1"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={toolBtnClass(editor.isActive('heading', { level: 1 }))}
              >
                <span className="text-xs font-bold">H1</span>
              </button>
              <button
                type="button"
                title="제목 2"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={toolBtnClass(editor.isActive('heading', { level: 2 }))}
              >
                <span className="text-xs font-bold">H2</span>
              </button>
              <button
                type="button"
                title="제목 3"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={toolBtnClass(editor.isActive('heading', { level: 3 }))}
              >
                <span className="text-xs font-bold">H3</span>
              </button>
            </ToolbarGroup>

            <ToolbarDivider />

            <ToolbarGroup label="목록·인용">
              <button
                type="button"
                title="목록"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={toolBtnClass(editor.isActive('bulletList'))}
              >
                <span className="text-xs">•</span>
              </button>
              <button
                type="button"
                title="할 일"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={toolBtnClass(editor.isActive('taskList'))}
              >
                <span className="text-xs">☑</span>
              </button>
              <button
                type="button"
                title="인용"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={toolBtnClass(editor.isActive('blockquote'))}
              >
                <span className="text-xs">&quot;</span>
              </button>
              <button
                type="button"
                title="코드"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={toolBtnClass(editor.isActive('codeBlock'))}
              >
                <span className="text-[10px] font-mono">{'<>'}</span>
              </button>
            </ToolbarGroup>

            <ToolbarDivider />

            <ToolbarGroup label="링크·이미지">
              <button
                type="button"
                title="링크"
                onClick={() => {
                  const url = prompt('링크 URL을 입력하세요:', 'https://');
                  if (url) editor.chain().focus().setLink({ href: url }).run();
                }}
                className={toolBtnClass(editor.isActive('link'))}
              >
                <span className="text-xs">🔗</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                title="이미지"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`${toolBtnClass(false)} disabled:opacity-50`}
              >
                <span className="text-xs">{isUploading ? '⏳' : '📷'}</span>
              </button>
            </ToolbarGroup>
          </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-5" />

        {/* 본문 — 하단 플로팅 버튼용 여백 */}
        <div className="px-0">
          <p className="px-5 pt-3 text-xs font-medium text-gray-500 dark:text-gray-400">본문</p>
          <EditorContent editor={editor} />
        </div>

        {displayMessage && (
          <div
            className={`px-5 pb-3 text-sm text-center ${
              displayMessage.includes('✅') ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {displayMessage}
          </div>
        )}
      </div>

      {/* 저장/취소 — FooterNav·FAB(목록용)와 겹치지 않게 bottom-24, z-[60] */}
      <div className="fixed bottom-24 right-4 z-[60] flex items-center gap-2 pointer-events-none">
        <button
          type="button"
          onClick={onCancel}
          style={{ touchAction: 'manipulation' }}
          className="pointer-events-auto h-11 px-4 rounded-xl text-sm font-medium bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 shadow-lg backdrop-blur-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          style={{ touchAction: 'manipulation' }}
          className="pointer-events-auto h-11 px-5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg disabled:opacity-50 transition-colors"
        >
          {isSaving ? '저장 중...' : isEditing ? '수정 완료' : '저장'}
        </button>
      </div>

      <style jsx global>{`
        .ProseMirror {
          outline: none;
          min-height: 280px;
          padding: 0.5rem 1.25rem 6.5rem;
          font-size: 0.9375rem;
          line-height: 1.8;
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
        .ProseMirror ul[data-type='taskList'] {
          list-style: none;
          padding: 0;
        }
        .ProseMirror ul[data-type='taskList'] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        .ProseMirror ul[data-type='taskList'] li > label {
          flex: 0 0 auto;
          margin-right: 0.5rem;
          user-select: none;
        }
        .ProseMirror ul[data-type='taskList'] li > div {
          flex: 1 1 auto;
        }
        .ProseMirror ul[data-type='taskList'] input[type='checkbox'] {
          cursor: pointer;
        }
      `}</style>
    </>
  );
}
