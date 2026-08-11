import { GlobalNav } from '../../components/GlobalNav';
import { FooterNav } from '../../components/FooterNav';
import { APP_HORIZONTAL_CONTAINER } from '../../components/container';

// 상세 진입 시 즉시 뼈대 표시 (레이아웃 점프 방지)
export default function Loading() {
  const lineWidths = ['95%', '88%', '92%', '70%', '85%', '90%', '60%', '80%'];
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <GlobalNav />

      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className={`${APP_HORIZONTAL_CONTAINER} py-3 flex items-center justify-between`}>
          <div className="h-5 w-14 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <div className="h-8 w-8 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
          </div>
        </div>
      </div>

      <div className={`${APP_HORIZONTAL_CONTAINER} py-6`}>
        <div className="h-7 w-3/4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse mb-3" />
        <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800 animate-pulse mb-6" />
        <div className="space-y-3">
          {lineWidths.map((w, i) => (
            <div
              key={i}
              className="h-4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse"
              style={{ width: w }}
            />
          ))}
        </div>
      </div>

      <FooterNav />
    </div>
  );
}
