import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { createSupabaseServer } from '../../../lib/supabase_ssr';
import { GlobalNav } from '../../components/GlobalNav';
import { FooterNav } from '../../components/FooterNav';
import { APP_HORIZONTAL_CONTAINER } from '../../components/container';
import { MemoDetailTopBar, MemoDetailFooter } from './MemoDetailClient';

interface MemoDetail {
  id: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

// 서버 렌더 — 하이드레이션 불일치 방지를 위해 KST 고정 포맷
const DATE_TIME_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '';
  return DATE_TIME_FMT.format(new Date(dateStr));
}

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();

  // 상세는 본문(content)까지 필요. 실존 컬럼만 select (likes/comments 컬럼 없음 — 400 방지)
  const { data: memo, error } = await supabase
    .from('memos')
    .select('id, title, content, created_at, updated_at')
    .eq('id', id)
    .single<MemoDetail>();

  if (error || !memo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GlobalNav />
        <div className={`${APP_HORIZONTAL_CONTAINER} py-8`}>
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500 dark:text-gray-400">글을 찾을 수 없습니다</p>
            <Link
              href="/memo"
              className="inline-block mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              목록으로 돌아가기
            </Link>
          </div>
        </div>
        <FooterNav />
      </div>
    );
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(memo.content);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <GlobalNav />

      {/* 상단 네비게이션 — 인터랙션은 client 섬 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className={`${APP_HORIZONTAL_CONTAINER} py-3 flex items-center justify-between`}>
          <MemoDetailTopBar id={memo.id} />
        </div>
      </div>

      {/* 본문 */}
      <div className={`${APP_HORIZONTAL_CONTAINER} py-6`}>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
          {memo.title || '제목 없음'}
        </h1>

        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <span>{formatDateTime(memo.created_at)}</span>
          {memo.updated_at && memo.updated_at !== memo.created_at && (
            <span className="text-xs text-gray-400">(수정됨)</span>
          )}
        </div>

        <div
          className="memo-content prose prose-sm dark:prose-invert max-w-none mb-8 text-[14px]"
          style={{ lineHeight: 1.8 }}
        >
          {isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: memo.content }} />
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo.content}</ReactMarkdown>
          )}
        </div>

        <MemoDetailFooter id={memo.id} title={memo.title} />
      </div>

      <FooterNav />
    </div>
  );
}
