'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconX, IconPencil, IconPhoto } from '@tabler/icons-react';

export interface GalleryPhoto {
  url: string;
  /** YYYY-MM-DD */
  date: string;
  /** 출처 라벨 (루틴명 / 체중 / 식사) */
  label: string;
  kind: 'routine' | 'weight' | 'meal';
  routineId?: string;
  /** 그날 그 기록에 남긴 메모 (뷰어 하단에 표시) */
  memo?: string;
}

interface Props {
  /** 최신 날짜 순으로 정렬된 사진 목록 */
  photos: GalleryPhoto[];
  /** 뷰어에서 "기록 열기"를 누르면 해당 기록 입력창을 연다 */
  onOpenRecord?: (photo: GalleryPhoto) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const PAGE_SIZE = 60;

const formatDate = (date: string): string => {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
};

export default function PhotoGallery({ photos, onOpenRecord }: Props) {
  const [filter, setFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 필터 칩: 사진이 있는 출처만, 사진 수가 많은 순
  const filters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of photos) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [photos]);

  // 선택한 필터가 사라지면(사진 삭제 등) 전체로 되돌림
  useEffect(() => {
    if (filter !== 'all' && !filters.some(([label]) => label === filter)) setFilter('all');
  }, [filter, filters]);

  const filtered = useMemo(
    () => (filter === 'all' ? photos : photos.filter((p) => p.label === filter)),
    [photos, filter]
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter]);

  // 스크롤이 바닥에 가까워지면 다음 묶음 렌더
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= filtered.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: '600px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, filtered.length]);

  // 월별 묶음 (사진첩처럼 달마다 헤더)
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: { photo: GalleryPhoto; index: number }[]; total: number }[] = [];
    const totals = new Map<string, number>();
    for (const p of filtered) {
      const key = p.date.slice(0, 7);
      totals.set(key, (totals.get(key) ?? 0) + 1);
    }
    filtered.slice(0, visibleCount).forEach((photo, index) => {
      const key = photo.date.slice(0, 7);
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        const [y, m] = key.split('-');
        g = { key, label: `${y}년 ${Number(m)}월`, items: [], total: totals.get(key) ?? 0 };
        out.push(g);
      }
      g.items.push({ photo, index });
    });
    return out;
  }, [filtered, visibleCount]);

  if (photos.length === 0) {
    return (
      <div className="bg-[rgb(254,252,247)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-400 dark:text-gray-500">
        <IconPhoto size={28} stroke={1.25} className="mx-auto mb-2 opacity-60" aria-hidden="true" />
        아직 사진이 없습니다. 루틴·체중 기록에 사진을 올리면 이곳에 모여요.
      </div>
    );
  }

  return (
    <div>
      {/* 출처 필터 */}
      {filters.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="사진 출처 필터">
          {[['all', photos.length] as [string, number], ...filters].map(([label, count]) => {
            const active = filter === label;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(label)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-[#1E3A5F] border-[#1E3A5F] text-white dark:bg-gray-100 dark:border-gray-100 dark:text-gray-900'
                    : 'bg-[rgb(254,252,247)] dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {label === 'all' ? '전체' : label}
                <span className={`ml-1 ${active ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="mb-3" aria-label={`${g.label} 사진`}>
          <div className="flex items-baseline gap-1.5 px-1 mb-1.5">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{g.label}</h4>
            <span className="text-xs text-gray-400 dark:text-gray-500">{g.total}장</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-0.5 rounded-xl overflow-hidden">
            {g.items.map(({ photo, index }) => {
              const d = new Date(`${photo.date}T00:00:00`);
              return (
                <button
                  key={`${photo.url}-${index}`}
                  type="button"
                  onClick={() => setViewerIndex(index)}
                  className="relative aspect-square bg-gray-100 dark:bg-gray-800 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-inset"
                  aria-label={`${formatDate(photo.date)} ${photo.label} 사진 크게 보기`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 hover:scale-[1.03]"
                  />
                  <span className="absolute left-1 top-1 px-1 py-0.5 rounded bg-black/45 text-white text-[10px] leading-none tabular-nums">
                    {d.getMonth() + 1}.{d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {visibleCount < filtered.length && <div ref={sentinelRef} className="h-8" aria-hidden="true" />}

      {viewerIndex !== null && filtered[viewerIndex] && (
        <PhotoViewer
          photos={filtered}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onOpenRecord={onOpenRecord}
        />
      )}
    </div>
  );
}

interface ViewerProps {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onOpenRecord?: (photo: GalleryPhoto) => void;
}

function PhotoViewer({ photos, index, onIndexChange, onClose, onOpenRecord }: ViewerProps) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  const [dragX, setDragX] = useState(0);
  const touchRef = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
  );

  // 키보드: ← → 이동, Esc 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // 뷰어가 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 이웃 사진 미리 로드 → 넘길 때 깜빡임 줄이기
  useEffect(() => {
    for (const i of [index - 1, index + 1]) {
      const p = photos[i];
      if (p) {
        const img = new Image();
        img.src = p.url;
      }
    }
  }, [index, photos]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, horizontal: null };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const s = touchRef.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) s.horizontal = Math.abs(dx) > Math.abs(dy);
    if (s.horizontal) {
      // 끝에서는 저항감 있게
      const edge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
      setDragX(edge ? dx * 0.3 : dx);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touchRef.current;
    touchRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    setDragX(0);
    if (s.horizontal && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    else if (s.horizontal === false && dy > 100) onClose(); // 아래로 쓸어내리면 닫기
  };

  const canOpen = !!onOpenRecord && photo.kind !== 'meal';

  return (
    <div
      className="fixed inset-0 z-[60] bg-black flex flex-col select-none"
      role="dialog"
      aria-modal="true"
      aria-label="사진 보기"
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-3 px-3 pt-[max(env(safe-area-inset-top),12px)] pb-2 text-white">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{formatDate(photo.date)}</p>
          <p className="text-xs text-white/60 truncate">
            {photo.label} · {index + 1} / {photos.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          aria-label="닫기"
        >
          <IconX size={20} stroke={1.75} />
        </button>
      </div>

      {/* 사진 */}
      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photo.url}
          src={photo.url}
          alt={`${photo.label} 사진`}
          draggable={false}
          className="max-w-full max-h-full object-contain"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragX === 0 ? 'transform 180ms ease-out' : 'none',
          }}
        />

        {hasPrev && (
          <button
            type="button"
            onClick={() => go(-1)}
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors"
            aria-label="이전 사진"
          >
            <IconChevronLeft size={24} stroke={1.75} />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => go(1)}
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors"
            aria-label="다음 사진"
          >
            <IconChevronRight size={24} stroke={1.75} />
          </button>
        )}
      </div>

      {/* 하단: 메모 + 기록 열기 */}
      {(photo.memo || canOpen) && (
        <div className="px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)] text-white bg-gradient-to-t from-black via-black/90 to-transparent">
          {photo.memo && (
            <p className="text-sm text-white/85 whitespace-pre-wrap break-words max-h-28 overflow-y-auto mb-2">{photo.memo}</p>
          )}
          {canOpen && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRecord!(photo);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs transition-colors"
            >
              <IconPencil size={14} stroke={1.75} aria-hidden="true" />이 날 기록 열기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
