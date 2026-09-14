'use client';

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { getSupabase } from '../../lib/supabase';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
/** 한 번에 첨부할 수 있는 최대 장수 */
const MAX_IMAGES_PER_UPLOAD = 10;
const MAX_IMAGE_EDGE = 1600;

type PreparedUpload = {
  blob: Blob;
  extension: string;
  contentType: string;
  width: number;
  height: number;
};

/** 업로드 전 긴 변 ≤1600px + webp(0.8). 실패 시 원본 폴백. */
async function prepareImageForUpload(file: File): Promise<PreparedUpload> {
  const readSize = async (): Promise<{ width: number; height: number }> => {
    try {
      const bmp = await createImageBitmap(file);
      const size = { width: bmp.width, height: bmp.height };
      bmp.close();
      return size;
    } catch {
      return { width: 0, height: 0 };
    }
  };

  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;
    const longest = Math.max(width, height);
    if (longest > MAX_IMAGE_EDGE) {
      const scale = MAX_IMAGE_EDGE / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      throw new Error('canvas unsupported');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const webpBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/webp', 0.8);
    });
    if (!webpBlob || webpBlob.size === 0) {
      throw new Error('webp encode failed');
    }

    return {
      blob: webpBlob,
      extension: 'webp',
      contentType: 'image/webp',
      width,
      height,
    };
  } catch {
    const size = await readSize();
    const extension = file.name.split('.').pop() || 'jpg';
    return {
      blob: file,
      extension,
      contentType: file.type || 'image/jpeg',
      width: size.width,
      height: size.height,
    };
  }
}

export interface MemoEditorCategory {
  id: string;
  name: string;
  parent_id?: string | null;
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
        // StarterKit v3 에 포함된 underline/link 는 아래에서 별도 설정하므로 중복 등록 방지
        underline: false,
        link: false,
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

  // v3 useEditor 는 기본적으로 트랜잭션마다 리렌더하지 않음 → 툴바 상태는 useEditorState 로 구독
  const tb = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e
        ? {
            canUndo: e.can().undo(),
            canRedo: e.can().redo(),
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            underline: e.isActive('underline'),
            h1: e.isActive('heading', { level: 1 }),
            h2: e.isActive('heading', { level: 2 }),
            h3: e.isActive('heading', { level: 3 }),
            bulletList: e.isActive('bulletList'),
            taskList: e.isActive('taskList'),
            blockquote: e.isActive('blockquote'),
            codeBlock: e.isActive('codeBlock'),
            link: e.isActive('link'),
          }
        : null,
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

  /** 한 번에 최대 10장. 파일 검사 → 순서대로 리사이즈·업로드 → 본문에 순서대로 삽입 */
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0 || !supabase || !editor) return;

    const files = picked.slice(0, MAX_IMAGES_PER_UPLOAD);
    const skippedByCount = picked.length - files.length;

    const invalid = files.find((f) => !f.type.startsWith('image/'));
    if (invalid) {
      setUploadMessage('❌ 이미지 파일만 업로드 가능합니다.');
      setTimeout(() => setUploadMessage(''), 3000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_IMAGE_SIZE);
    if (tooBig) {
      setUploadMessage(
        `❌ 이미지 크기는 장당 5MB 이하만 가능합니다. (${tooBig.name})`
      );
      setTimeout(() => setUploadMessage(''), 3000);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    const total = files.length;
    let done = 0;
    let failed = 0;

    try {
      for (let i = 0; i < total; i++) {
        setUploadMessage(
          total > 1 ? `📷 이미지 업로드 중... (${i + 1}/${total})` : '📷 이미지 업로드 중...'
        );
        const file = files[i];
        try {
          const prepared = await prepareImageForUpload(file);
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 8);
          const fileName = `${timestamp}_${randomStr}.${prepared.extension}`;

          const { error } = await supabase.storage
            .from('diary-images')
            .upload(fileName, prepared.blob, {
              cacheControl: '3600',
              upsert: false,
              contentType: prepared.contentType,
            });

          if (error) throw error;

          const { data: urlData } = supabase.storage
            .from('diary-images')
            .getPublicUrl(fileName);

          const imageAttrs: { src: string; width?: number; height?: number } = {
            src: urlData.publicUrl,
          };
          if (prepared.width > 0 && prepared.height > 0) {
            imageAttrs.width = prepared.width;
            imageAttrs.height = prepared.height;
          }
          // 선택한 순서대로 커서 위치에 이어서 삽입
          editor.chain().focus().setImage(imageAttrs).run();
          done += 1;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('bucket')) {
            // 버킷 자체가 없으면 나머지도 전부 실패하므로 즉시 중단
            throw err;
          }
          failed += 1;
        }
      }

      if (failed === 0) {
        setUploadMessage(
          total > 1 ? `✅ 이미지 ${done}장이 추가되었습니다!` : '✅ 이미지가 추가되었습니다!'
        );
      } else {
        setUploadMessage(`⚠️ ${done}장 추가, ${failed}장 실패했습니다.`);
      }
      if (skippedByCount > 0) {
        setUploadMessage(
          (prev) =>
            `${prev} (최대 ${MAX_IMAGES_PER_UPLOAD}장까지만 업로드되어 ${skippedByCount}장은 제외됨)`
        );
      }
      setTimeout(() => setUploadMessage(''), skippedByCount > 0 || failed > 0 ? 5000 : 2000);
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
            {(() => {
              // 최상위 → 자식 순으로 정렬, 자식은 '— ' 들여쓰기 (부모·자식 모두 선택 가능)
              const roots = categories.filter((c) => !c.parent_id);
              const ordered: MemoEditorCategory[] = [];
              for (const root of roots) {
                ordered.push(root);
                for (const child of categories.filter((c) => c.parent_id === root.id)) {
                  ordered.push(child);
                }
              }
              for (const c of categories) {
                if (!ordered.some((o) => o.id === c.id)) ordered.push(c);
              }
              return ordered.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.parent_id ? `— ${cat.name}` : cat.name}
                </option>
              ));
            })()}
          </select>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-5" />

        {/* 본문 — 하단 고정 바(툴바+버튼)용 여백은 .ProseMirror padding 으로 확보 */}
        <div className="px-0">
          <p className="px-5 pt-3 text-xs font-medium text-gray-500 dark:text-gray-400">본문</p>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/*
        하단 고정 바 — 서식 툴바 + 취소/저장.
        스크롤 위치와 무관하게 항상 보이므로 긴 글 아래쪽을 편집할 때도 바로 서식 적용 가능.
        오버레이(z-[110]) 안에서 렌더되므로 FooterNav(z-[100]) 위에 놓임.
      */}
      <div className="fixed bottom-0 left-0 right-0 z-[120] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="max-w-2xl mx-auto">
          {/* 서식 툴바 (가로 스크롤) */}
          <div
            className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-2 pt-1.5 pb-1"
            style={{ touchAction: 'manipulation' }}
          >
            <ToolbarGroup label="실행 취소">
              <button
                type="button"
                title="되돌리기 (Ctrl+Z)"
                aria-label="되돌리기"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!tb?.canUndo}
                className={`${toolBtnClass(false)} disabled:opacity-30 disabled:pointer-events-none`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
                </svg>
              </button>
              <button
                type="button"
                title="다시 실행 (Ctrl+Shift+Z)"
                aria-label="다시 실행"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!tb?.canRedo}
                className={`${toolBtnClass(false)} disabled:opacity-30 disabled:pointer-events-none`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 14l5-5-5-5" />
                  <path d="M20 9H9a5 5 0 0 0 0 10h3" />
                </svg>
              </button>
            </ToolbarGroup>

            <ToolbarDivider />

            <ToolbarGroup label="텍스트 스타일">
              <button
                type="button"
                title="굵게"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={toolBtnClass(!!tb?.bold)}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                title="기울임"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={toolBtnClass(!!tb?.italic)}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                title="밑줄"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={toolBtnClass(!!tb?.underline)}
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
                className={toolBtnClass(!!tb?.h1)}
              >
                <span className="text-xs font-bold">H1</span>
              </button>
              <button
                type="button"
                title="제목 2"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={toolBtnClass(!!tb?.h2)}
              >
                <span className="text-xs font-bold">H2</span>
              </button>
              <button
                type="button"
                title="제목 3"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={toolBtnClass(!!tb?.h3)}
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
                className={toolBtnClass(!!tb?.bulletList)}
              >
                <span className="text-xs">•</span>
              </button>
              <button
                type="button"
                title="할 일"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={toolBtnClass(!!tb?.taskList)}
              >
                <span className="text-xs">☑</span>
              </button>
              <button
                type="button"
                title="인용"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={toolBtnClass(!!tb?.blockquote)}
              >
                <span className="text-xs">&quot;</span>
              </button>
              <button
                type="button"
                title="코드"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                className={toolBtnClass(!!tb?.codeBlock)}
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
                className={toolBtnClass(!!tb?.link)}
              >
                <span className="text-xs">🔗</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                title="이미지 (최대 10장)"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={`${toolBtnClass(false)} disabled:opacity-50`}
              >
                <span className="text-xs">{isUploading ? '⏳' : '📷'}</span>
              </button>
            </ToolbarGroup>
          </div>

          {/* 메시지 + 취소/저장 */}
          <div className="flex items-center gap-2 px-3 pb-2.5 pt-1 border-t border-gray-100 dark:border-gray-800">
            <p
              className={`flex-1 min-w-0 truncate text-xs ${
                displayMessage
                  ? displayMessage.includes('✅')
                    ? 'text-green-600'
                    : 'text-red-600'
                  : 'text-gray-400'
              }`}
              aria-live="polite"
            >
              {displayMessage}
            </p>
            <button
              type="button"
              onClick={onCancel}
              style={{ touchAction: 'manipulation' }}
              className="flex-shrink-0 h-10 px-4 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              style={{ touchAction: 'manipulation' }}
              className="flex-shrink-0 h-10 px-5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
            >
              {isSaving ? '저장 중...' : isEditing ? '수정 완료' : '저장'}
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .ProseMirror {
          outline: none;
          min-height: 280px;
          padding: 0.5rem 1.25rem 2rem;
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
