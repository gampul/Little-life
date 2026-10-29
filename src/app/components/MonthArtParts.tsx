'use client';

/**
 * 이달의 그림 — 그림 바꾸기 시트 / 완성 축하 / 컬렉션
 */
import { useEffect, useRef, useState } from 'react';
import { IconPhotoPlus, IconArrowsShuffle, IconX, IconTrophy } from '@tabler/icons-react';
import type { MonthArt } from '../../lib/monthArtStore';

export interface PoolPhoto {
  key: string;
  src: string;
  image_url?: string | null;
  storage_path?: string | null;
}

/** 사진이 하나도 없을 때 쓰는 기본 그림 (흑백 → 컬러가 잘 보이는 그라데이션) */
export const FALLBACK_ART =
  'radial-gradient(circle at 25% 30%, #ffd166 0 18%, transparent 19%), radial-gradient(circle at 75% 65%, #ef476f 0 22%, transparent 23%), conic-gradient(from 200deg at 50% 50%, #06d6a0, #118ab2, #8338ec, #ff006e, #fb5607, #ffbe0b, #06d6a0)';

const monthLabel = (month: string) => `${Number(month.slice(0, 4))}년 ${Number(month.slice(5, 7))}월`;

function Backdrop({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[rgb(254,252,247)] dark:bg-gray-800 shadow-xl animate-[artIn_0.22s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
      <style>{`@keyframes artIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

/** 그림 바꾸기: 사진첩에서 올리기 / 내 사진에서 고르기 / 랜덤 */
export function ChangeArtSheet({
  month,
  current,
  pool,
  onUpload,
  onPick,
  onRandom,
  onClose,
}: {
  month: string;
  current: MonthArt | undefined;
  pool: PoolPhoto[];
  onUpload: (file: File) => Promise<void>;
  onPick: (p: PoolPhoto) => Promise<void>;
  onRandom: () => Promise<void>;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
      onClose();
    } catch (e) {
      alert(`그림을 바꾸지 못했어요: ${(e as Error)?.message || '알 수 없는 오류'}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Backdrop onClose={onClose} label={`${monthLabel(month)} 그림 바꾸기`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">{monthLabel(month)} 그림</h3>
        <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <IconX size={18} />
        </button>
      </div>
      <div className="px-4">
        <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700">
          {current?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.src} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ backgroundImage: FALLBACK_ART }} />
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
          {current?.source === 'upload' ? '내가 고른 그림' : current ? '랜덤으로 고른 그림' : '아직 그림이 없어요'} · 루틴을 할수록 칸마다 색이 살아나요
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) run('upload', () => onUpload(f));
          }}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-900 dark:bg-gray-100 px-3 py-2.5 text-[13px] font-semibold text-white dark:text-gray-900 disabled:opacity-50"
          >
            <IconPhotoPlus size={17} stroke={1.8} />
            {busy === 'upload' ? '올리는 중…' : '사진첩에서 올리기'}
          </button>
          <button
            type="button"
            disabled={!!busy || !pool.some((p) => (p.storage_path ?? p.image_url) !== (current?.storage_path ?? current?.image_url))}
            onClick={() => run('random', onRandom)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-[13px] font-medium text-gray-700 dark:text-gray-200 disabled:opacity-40"
          >
            <IconArrowsShuffle size={17} stroke={1.8} />
            {busy === 'random' ? '고르는 중…' : '다른 사진 랜덤'}
          </button>
        </div>
      </div>
      {pool.length > 0 && (
        <div className="px-4 pt-4 pb-5">
          <div className="mb-2 text-[12px] font-medium text-gray-600 dark:text-gray-300">내가 올린 사진에서 고르기</div>
          <div className="grid grid-cols-4 gap-1.5">
            {pool.slice(0, 24).map((p) => {
              const active = !!current && ((p.storage_path && p.storage_path === current.storage_path) || (p.image_url && p.image_url === current.image_url));
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={!!busy}
                  onClick={() => run(p.key, () => onPick(p))}
                  aria-label="이 사진으로 바꾸기"
                  className={`aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 ${active ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      {pool.length === 0 && <div className="h-5" />}
    </Backdrop>
  );
}

const CONFETTI = ['🎉', '✨', '🌈', '🎨', '⭐', '🌸', '💫', '🎊'];

/** 그림 완성 축하 */
export function CompleteCelebration({
  month,
  art,
  progress,
  perfectDays,
  collectionCount,
  onOpenCollection,
  onClose,
}: {
  month: string;
  art: MonthArt | undefined;
  progress: number;
  perfectDays: number;
  collectionCount: number;
  onOpenCollection: () => void;
  onClose: () => void;
}) {
  return (
    <Backdrop onClose={onClose} label={`${monthLabel(month)} 그림 완성`}>
      <div className="relative overflow-hidden px-5 pt-6 pb-5 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {Array.from({ length: 18 }, (_, i) => (
            <span
              key={i}
              className="absolute text-[18px] animate-[artConfetti_2.4s_ease-in_forwards]"
              style={{ left: `${(i * 53) % 100}%`, top: '-10%', animationDelay: `${(i % 6) * 0.12}s` }}
            >
              {CONFETTI[i % CONFETTI.length]}
            </span>
          ))}
        </div>
        <div className="text-[13px] font-medium text-amber-600 dark:text-amber-300">그림 완성!</div>
        <h3 className="mt-1 text-[20px] font-bold text-gray-900 dark:text-white">🎉 {Number(month.slice(5, 7))}월 그림을 다 칠했어요</h3>
        <div className="mx-auto mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-md">
          {art?.src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art.src} alt={`${monthLabel(month)} 완성 그림`} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ backgroundImage: FALLBACK_ART }} />
          )}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
          한 달 동안 꾸준히 해낸 덕분이에요. 정말 축하해요!
          <br />
          <span className="text-gray-500 dark:text-gray-400">
            진행률 {Math.round(progress * 100)}% · 만점 날 {perfectDays}일 · 컬렉션 {collectionCount}번째 그림
          </span>
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenCollection}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-[13px] font-medium text-gray-700 dark:text-gray-200"
          >
            <IconTrophy size={16} stroke={1.8} />
            컬렉션 보기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-900 dark:bg-gray-100 px-3 py-2.5 text-[13px] font-semibold text-white dark:text-gray-900"
          >
            좋아요!
          </button>
        </div>
      </div>
      <style>{`@keyframes artConfetti { 0% { transform: translateY(0) rotate(0); opacity: 1; } 100% { transform: translateY(520px) rotate(320deg); opacity: 0; } }`}</style>
    </Backdrop>
  );
}

/** 완성한 달 모음 */
export function ArtCollection({ arts, onClose }: { arts: MonthArt[]; onClose: () => void }) {
  const [open, setOpen] = useState<MonthArt | null>(null);
  return (
    <Backdrop onClose={open ? () => setOpen(null) : onClose} label="그림 컬렉션">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
          🏆 그림 컬렉션 <span className="ml-1 text-[12px] font-normal text-gray-500">{arts.length}점</span>
        </h3>
        <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <IconX size={18} />
        </button>
      </div>
      {open ? (
        <div className="px-4 pb-5">
          <button type="button" onClick={() => setOpen(null)} className="mb-2 text-[12px] text-blue-600 dark:text-blue-400">
            ‹ 모아 보기
          </button>
          <div className="overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {open.src ? <img src={open.src} alt="" className="w-full object-cover" /> : <div className="aspect-[4/3]" style={{ backgroundImage: FALLBACK_ART }} />}
          </div>
          <p className="mt-2 text-center text-[13px] text-gray-600 dark:text-gray-300">{monthLabel(open.month)} 완성</p>
        </div>
      ) : arts.length === 0 ? (
        <p className="px-4 pb-6 pt-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-400">
          아직 완성한 그림이 없어요. 한 달 진행률이 80%를 넘으면 그 달 그림이 여기에 모여요.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 px-4 pb-5 pt-1">
          {arts.map((a) => (
            <button key={a.month} type="button" onClick={() => setOpen(a)} className="text-left">
              <div className="aspect-[4/3] overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-700">
                {a.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.src} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ backgroundImage: FALLBACK_ART }} />
                )}
              </div>
              <div className="mt-1 text-[12px] text-gray-600 dark:text-gray-300">{monthLabel(a.month)}</div>
            </button>
          ))}
        </div>
      )}
    </Backdrop>
  );
}
