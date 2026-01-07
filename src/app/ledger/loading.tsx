export default function Loading() {
  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 pb-24">
      <div className="max-w-[412px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Month controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-8 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
          <div className="h-8 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3"
            >
              <div className="h-3 w-10 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
              <div className="h-5 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 mb-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-16 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 animate-pulse"
            />
          ))}
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, block) => (
            <div
              key={block}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {Array.from({ length: 4 }).map((_, row) => (
                  <div key={row} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="h-4 w-40 max-w-full rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-2" />
                        <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      </div>
                      <div className="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


