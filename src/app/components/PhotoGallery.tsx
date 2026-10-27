'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const GAP = 16; // 사진 사이 간격(px)
const SLIDE_MS = 300;
const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

function PhotoViewer({ photos, index, onIndexChange, onClose, onOpenRecord }: ViewerProps) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<{
    x: number;
    y: number;
    t: number;
    lastX: number;
    lastT: number;
    vx: number;
    axis: 'x' | 'y' | null;
  } | null>(null);
  // 진행 중인 넘김 애니메이션 (새 터치가 오면 즉시 마무리)
  const pendingRef = useRef<{ timer: number; finish: () => void } | null>(null);
  const rafRef = useRef<number | null>(null);

  const width = () => (stageRef.current?.clientWidth ?? window.innerWidth) + GAP;

  const setTrack = (x: number, y = 0, animate = false) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? `transform ${SLIDE_MS}ms ${EASE}` : 'none';
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  };
  const setBackdrop = (opacity: number, animate = false) => {
    const el = backdropRef.current;
    if (!el) return;
    el.style.transition = animate ? `opacity ${SLIDE_MS}ms ${EASE}` : 'none';
    el.style.opacity = String(opacity);
  };

  const flushPending = () => {
    const p = pendingRef.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pendingRef.current = null;
    p.finish();
  };

  /** 옆 사진까지 미끄러지듯 이동한 뒤 index 를 바꾼다 */
  const slideTo = useCallback(
    (delta: -1 | 0 | 1) => {
      flushPending();
      const target = index + delta;
      if (delta !== 0 && (target < 0 || target >= photos.length)) delta = 0;
      setTrack(-delta * width(), 0, true);
      setBackdrop(1, true);
      if (delta === 0) return;
      const finish = () => onIndexChange(index + delta);
      pendingRef.current = { timer: window.setTimeout(() => flushPending(), SLIDE_MS + 20), finish };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, photos.length, onIndexChange]
  );

  // index 가 바뀌면 트랙을 애니메이션 없이 가운데로 (새 가운데 = 방금 들어온 사진이라 화면은 그대로)
  useLayoutEffect(() => {
    setTrack(0, 0, false);
  }, [index]);

  useEffect(() => () => {
    if (pendingRef.current) window.clearTimeout(pendingRef.current.timer);
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  // 키보드: ← → 이동, Esc 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') slideTo(-1);
      else if (e.key === 'ArrowRight') slideTo(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slideTo, onClose]);

  // 뷰어가 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 두 장 앞뒤까지 미리 로드
  useEffect(() => {
    for (const i of [index - 2, index + 2]) {
      const p = photos[i];
      if (p) {
        const img = new Image();
        img.src = p.url;
      }
    }
  }, [index, photos]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      gestureRef.current = null; // 두 손가락(확대)은 넘기기로 보지 않음
      return;
    }
    flushPending();
    const t = e.touches[0];
    const now = performance.now();
    gestureRef.current = { x: t.clientX, y: t.clientY, t: now, lastX: t.clientX, lastT: now, vx: 0, axis: null };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    if (!g || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    const now = performance.now();
    if (now > g.lastT) {
      // 속도는 최근 움직임에 가중 (손을 떼는 순간의 빠르기)
      g.vx = 0.7 * ((t.clientX - g.lastX) / (now - g.lastT)) + 0.3 * g.vx;
      g.lastX = t.clientX;
      g.lastT = now;
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (g.axis === 'x') {
        // 첫/마지막 사진에서는 고무줄처럼 저항
        const edge = (dx > 0 && !hasPrev) || (dx < 0 && !hasNext);
        setTrack(edge ? dx * 0.3 : dx);
      } else if (dy > 0) {
        // 아래로 끌면 사진이 따라 내려가며 배경이 옅어짐
        setTrack(0, dy);
        setBackdrop(Math.max(0.3, 1 - dy / 500));
      }
    });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || !g.axis) return;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const t = e.changedTouches[0];
    const dx = t.clientX - g.x;
    const dy = t.clientY - g.y;
    if (g.axis === 'x') {
      const w = width();
      const fast = Math.abs(g.vx) > 0.35 && Math.sign(g.vx) === Math.sign(dx); // 빠르게 튕기면 짧게 끌어도 넘김
      if ((Math.abs(dx) > w * 0.22 || fast) && Math.abs(dx) > 12) slideTo(dx < 0 ? 1 : -1);
      else slideTo(0);
    } else {
      if (dy > 120) onClose();
      else {
        setTrack(0, 0, true);
        setBackdrop(1, true);
      }
    }
  };

  const canOpen = !!onOpenRecord && photo.kind !== 'meal';
  const slides = [-1, 0, 1]
    .map((offset) => ({ offset, p: photos[index + offset] }))
    .filter((s): s is { offset: number; p: GalleryPhoto } => !!s.p);

  return (
    <div className="fixed inset-0 z-[60] select-none" role="dialog" aria-modal="true" aria-label="사진 보기">
      <div ref={backdropRef} className="absolute inset-0 bg-black" aria-hidden="true" />

      {/* 상단 바 */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between gap-3 px-3 pt-[max(env(safe-area-inset-top),12px)] pb-6 text-white bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{formatDate(photo.date)}</p>
          <p className="text-xs text-white/60 truncate">
            {photo.label} · {index + 1} / {photos.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto shrink-0 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
          aria-label="닫기"
        >
          <IconX size={20} stroke={1.75} />
        </button>
      </div>

      {/* 사진: 이전·현재·다음을 나란히 놓은 트랙을 손가락에 맞춰 움직인다 */}
      <div
        ref={stageRef}
        className="absolute inset-0 overflow-hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          gestureRef.current = null;
          slideTo(0);
        }}
      >
        <div ref={trackRef} className="absolute inset-0" style={{ willChange: 'transform', transform: 'translate3d(0,0,0)' }}>
          {slides.map(({ offset, p }) => (
            <div
              key={`${p.url}-${index + offset}`}
              className="absolute inset-0 flex items-center justify-center"
              style={{ transform: `translate3d(calc(${offset * 100}% + ${offset * GAP}px), 0, 0)` }}
              onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`${p.label} 사진`}
                draggable={false}
                decoding="async"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ))}
        </div>

        {hasPrev && (
          <button
            type="button"
            onClick={() => slideTo(-1)}
            className="hidden sm:flex absolute z-10 left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors"
            aria-label="이전 사진"
          >
            <IconChevronLeft size={24} stroke={1.75} />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => slideTo(1)}
            className="hidden sm:flex absolute z-10 right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white items-center justify-center transition-colors"
            aria-label="다음 사진"
          >
            <IconChevronRight size={24} stroke={1.75} />
          </button>
        )}
      </div>

      {/* 하단: 메모 + 기록 열기 */}
      {(photo.memo || canOpen) && (
        <div className="absolute bottom-0 inset-x-0 z-10 px-4 pt-8 pb-[max(env(safe-area-inset-bottom),16px)] text-white bg-gradient-to-t from-black/80 via-black/50 to-transparent">
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
