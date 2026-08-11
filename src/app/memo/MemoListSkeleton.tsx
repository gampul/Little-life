'use client';

type ViewMode = 'grid' | 'list' | 'compact';

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className ?? ''}`}
    />
  );
}

function ListCardSkeleton() {
  return (
    <div className="py-4 border-b border-gray-200 dark:border-gray-700 -mx-2 px-2">
      <div className="flex gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <SkeletonPulse className="h-5 w-3/4" />
          <SkeletonPulse className="h-4 w-full" />
          <SkeletonPulse className="h-4 w-5/6" />
          <SkeletonPulse className="h-3 w-24 mt-1" />
          <div className="flex gap-4 mt-2">
            <SkeletonPulse className="h-4 w-10" />
            <SkeletonPulse className="h-4 w-10" />
          </div>
        </div>
        <div className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden">
          <SkeletonPulse className="absolute inset-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function GridCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="relative aspect-video">
        <SkeletonPulse className="absolute inset-0 rounded-none" />
      </div>
      <div className="p-3 space-y-2">
        <SkeletonPulse className="h-4 w-4/5" />
        <SkeletonPulse className="h-3 w-1/3" />
        <div className="flex gap-2 pt-1">
          <SkeletonPulse className="h-3 w-8" />
          <SkeletonPulse className="h-3 w-8" />
        </div>
      </div>
    </div>
  );
}

function CompactCardSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-200 dark:border-gray-700 -mx-2 px-2">
      <div className="flex-1 min-w-0 space-y-2">
        <SkeletonPulse className="h-4 w-2/3" />
        <SkeletonPulse className="h-3 w-24" />
      </div>
      <SkeletonPulse className="h-8 w-8 rounded-lg flex-shrink-0" />
    </div>
  );
}

export function MemoListSkeleton({
  viewMode,
  count,
}: {
  viewMode: ViewMode;
  count: number;
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label="목록 로딩 중">
        {items.map((i) => (
          <GridCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div aria-busy="true" aria-label="목록 로딩 중">
        {items.map((i) => (
          <CompactCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-label="목록 로딩 중">
      {items.map((i) => (
        <ListCardSkeleton key={i} />
      ))}
    </div>
  );
}
