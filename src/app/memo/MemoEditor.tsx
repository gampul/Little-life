'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
    content: content || '',
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200',
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
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-4">
        <input
          type="text"
          value={title || ''}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="제목"
          className="w-full px-5 pt-5 pb-3 text-xl font-bold bg-transparent text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 border-0 outline-none"
        />
        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-4" />

        {categories.length > 0 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap px-5 pt-3">
            <button
              onClick={() => onCategoryChange(null)}
              style={{ touchAction: 'manipulation' }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                !selectedCategoryId
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'border border-gray-200 dark:border-gray-700 text-gray-500'
              }`}
            >
              없음
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(cat.id)}
                style={{ touchAction: 'manipulation' }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategoryId === cat.id
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'border border-gray-200 dark:border-gray-700 text-gray-500'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div
          className="flex items-center gap-0.5 px-3 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-hide"
          style={{ touchAction: 'manipulation' }}
        >
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
              editor.isActive('bold')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
              editor.isActive('italic')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
              editor.isActive('underline')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <u>U</u>
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            H3
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('bulletList')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            • 목록
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('taskList')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            ☑ 할일
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('blockquote')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            &quot; 인용
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('codeBlock')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {'<>'} 코드
          </button>
          <button
            type="button"
            onClick={() => {
              const url = prompt('링크 URL을 입력하세요:', 'https://');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={`flex-shrink-0 h-11 px-3 flex items-center justify-center rounded-xl text-xs font-medium ${
              editor.isActive('link')
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            🔗 링크
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
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-shrink-0 h-11 px-3 flex items-center justify-center gap-1 rounded-xl text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            {isUploading ? '⏳' : '📷'} 이미지
          </button>
        </div>

        <EditorContent editor={editor} />

        <div className="flex gap-2 px-4 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : isEditing ? '수정 완료' : '저장'}
          </button>
          <button
            onClick={onCancel}
            className="h-12 px-6 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl"
          >
            취소
          </button>
        </div>

        {displayMessage && (
          <div
            className={`mt-2 mb-3 text-sm text-center ${
              displayMessage.includes('✅') ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {displayMessage}
          </div>
        )}
      </div>

      <style jsx global>{`
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
