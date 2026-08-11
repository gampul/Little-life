'use client';

import { memo, type MouseEvent } from 'react';
import NextImage from 'next/image';

export type MemoCardVariant = 'grid' | 'list' | 'compact';

export interface MemoCardData {
  id?: string;
  title: string;
  content?: string | null;
  excerpt?: string | null;
  cover_image?: string | null;
  created_at?: string;
  likes?: number;
  comments?: number;
  category_id?: string | null;
  memo_categories?: { name: string } | null;
}

export interface MemoCardProps {
  memo: MemoCardData;
  variant: MemoCardVariant;
  /** 이 카드의 좋아요 여부만 — 다른 카드 변경과 무관 */
  liked: boolean;
  copied: boolean;
  onLike: (memoId: string) => void;
  onEdit: (memo: MemoCardData) => void;
  onDelete: (memo: MemoCardData) => void;
  onCopyLink: (e: MouseEvent, memoId: string) => void;
  onOpen: (memoId: string) => void;
}

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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`;
}

function previewFromContent(html?: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
}

function firstImageFromContent(html?: string | null): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src="([^">]+)"/);
  return m ? m[1] : null;
}

/** variant별 대략 높이 — content-visibility intrinsic size */
const INTRINSIC_SIZE: Record<MemoCardVariant, string> = {
  list: '120px',
  grid: '220px',
  compact: '56px',
};

function MemoCardComponent({
  memo,
  variant,
  liked,
  copied,
  onLike,
  onEdit,
  onDelete,
  onCopyLink,
  onOpen,
}: MemoCardProps) {
  // excerpt/cover 컬럼이 없는 환경에서는 content 로 폴백
  const textPreview = memo.excerpt || previewFromContent(memo.content);
  const thumbnail = memo.cover_image || firstImageFromContent(memo.content);
  const likeCount = (memo.likes || 0) + (liked ? 1 : 0);
  const title = memo.title || '제목 없음';

  const rootClass =
    variant === 'grid'
      ? 'memo-card bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col'
      : variant === 'compact'
        ? 'memo-card flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors -mx-2 px-2 rounded-lg'
        : 'memo-card py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors -mx-2 px-2 rounded-lg';

  const bodyWrapClass =
    variant === 'grid'
      ? 'flex flex-col'
      : 'flex flex-row gap-3 items-stretch';

  const mediaClass =
    variant === 'compact'
      ? 'hidden'
      : variant === 'grid'
        ? 'relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden w-full'
        : 'relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 order-2';

  const contentClass =
    variant === 'grid'
      ? 'p-3'
      : variant === 'compact'
        ? 'flex-1 min-w-0'
        : 'flex-1 min-w-0 order-1';

  const titleClass =
    variant === 'grid'
      ? 'text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1'
      : variant === 'compact'
        ? 'text-sm sm:text-base font-semibold text-gray-900 dark:text-white truncate'
        : 'text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-1 line-clamp-2';

  return (
    <article
      onClick={() => {
        if (memo.id) onOpen(memo.id);
      }}
      className={rootClass}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: INTRINSIC_SIZE[variant],
      }}
    >
      <div className={bodyWrapClass}>
        {/* 미디어 — compact 에선 CSS hidden. 커버 없어도 aspect/고정 박스로 CLS 방지 */}
        <div className={mediaClass} aria-hidden={!thumbnail}>
          {thumbnail ? (
            <NextImage
              src={thumbnail}
              alt={title}
              fill
              sizes={
                variant === 'grid'
                  ? '(max-width: 640px) 50vw, 200px'
                  : '96px'
              }
              loading="lazy"
              quality={70}
              className="object-cover"
            />
          ) : (
            variant !== 'compact' && (
              <div className="absolute inset-0 bg-gray-100 dark:bg-gray-700" />
            )
          )}
        </div>

        <div className={contentClass}>
          <h3 className={titleClass}>{title}</h3>

          {/* 미리보기: list 만 */}
          <p
            className={
              variant === 'list'
                ? 'text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2'
                : 'hidden'
            }
          >
            {textPreview}
          </p>

          <p
            className={
              variant === 'compact'
                ? 'text-xs sm:text-sm text-gray-500 dark:text-gray-400'
                : variant === 'grid'
                  ? 'text-xs text-gray-500 dark:text-gray-400 mb-2'
                  : 'hidden'
            }
          >
            {formatDate(memo.created_at)}
          </p>

          {/* list 메타: 날짜 + 카테고리 */}
          <div
            className={
              variant === 'list'
                ? 'flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-2'
                : 'hidden'
            }
          >
            <span>{formatDate(memo.created_at)}</span>
            {memo.memo_categories?.name && (
              <span className="px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500">
                {memo.memo_categories.name}
              </span>
            )}
          </div>

          {/* list/grid 좋아요·액션 (compact 에선 숨김 — 트리는 유지) */}
          <div
            className={
              variant === 'compact'
                ? 'hidden'
                : variant === 'grid'
                  ? 'flex items-center justify-between'
                  : 'flex items-center gap-4 text-xs sm:text-sm text-gray-500 dark:text-gray-400'
            }
          >
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (memo.id) onLike(memo.id);
                }}
                className={`flex items-center gap-1 transition-colors ${
                  liked ? 'text-red-500' : 'hover:text-red-500'
                }`}
              >
                {liked ? '❤️' : '🤍'} {likeCount}
              </button>
              <span>💬 {memo.comments || 0}</span>
            </div>
            <div className={variant === 'grid' ? 'flex items-center gap-1' : 'flex items-center gap-1 ml-auto'}>
              <CopyEditDelete
                copied={copied}
                memo={memo}
                onCopyLink={onCopyLink}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          </div>
        </div>

        {/* compact 전용 액션 열 */}
        <div
          className={
            variant === 'compact'
              ? 'flex items-center gap-2 flex-shrink-0'
              : 'hidden'
          }
        >
          <CopyEditDelete
            copied={copied}
            memo={memo}
            onCopyLink={onCopyLink}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

function CopyEditDelete({
  copied,
  memo,
  onCopyLink,
  onEdit,
  onDelete,
}: {
  copied: boolean;
  memo: MemoCardData;
  onCopyLink: MemoCardProps['onCopyLink'];
  onEdit: MemoCardProps['onEdit'];
  onDelete: MemoCardProps['onDelete'];
}) {
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (memo.id) onCopyLink(e, memo.id);
        }}
        className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        style={{ touchAction: 'manipulation' }}
        title="링크 복사"
      >
        {copied ? (
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
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit(memo);
        }}
        className="p-2 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <IconEdit />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(memo);
        }}
        className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <IconTrash />
      </button>
    </>
  );
}

function propsAreEqual(prev: MemoCardProps, next: MemoCardProps) {
  return (
    prev.memo === next.memo &&
    prev.variant === next.variant &&
    prev.liked === next.liked &&
    prev.copied === next.copied &&
    prev.onLike === next.onLike &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onCopyLink === next.onCopyLink &&
    prev.onOpen === next.onOpen
  );
}

export const MemoCard = memo(MemoCardComponent, propsAreEqual);
