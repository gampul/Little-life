'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';
import { GlobalNav } from '../../components/GlobalNav';
import { FooterNav } from '../../components/FooterNav';
import { APP_HORIZONTAL_CONTAINER } from '../../components/container';

interface Memo {
  id?: string;
  title: string;
  content: string;
  created_at?: string;
  updated_at?: string;
  likes?: number;
  comments?: number;
}

// 날짜 포맷 (2025년 12월 24일 형식)
const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
};

// 시간 포함 포맷
const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? '오후' : '오전';
  const hour12 = hours % 12 || 12;
  return `${year}년 ${month}월 ${day}일 ${ampm} ${hour12}:${minutes}`;
};

export default function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = getSupabase();
  const [memo, setMemo] = useState<Memo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadMemo();
    // 로컬 좋아요 상태 확인
    const likedMemos = JSON.parse(localStorage.getItem('likedMemos') || '[]');
    setIsLiked(likedMemos.includes(resolvedParams.id));
  }, [resolvedParams.id]);

  const loadMemo = async () => {
    if (!supabase) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

      if (error) throw error;
      setMemo(data);
    } catch (error) {
      console.error('메모 로딩 에러:', error);
      router.push('/memo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = () => {
    const likedMemos = JSON.parse(localStorage.getItem('likedMemos') || '[]');
    if (isLiked) {
      const newLiked = likedMemos.filter((id: string) => id !== resolvedParams.id);
      localStorage.setItem('likedMemos', JSON.stringify(newLiked));
    } else {
      likedMemos.push(resolvedParams.id);
      localStorage.setItem('likedMemos', JSON.stringify(likedMemos));
    }
    setIsLiked(!isLiked);
  };

  const handleEdit = () => {
    // 수정 페이지로 이동 (메모 페이지에서 수정 모드로)
    router.push(`/memo?edit=${resolvedParams.id}`);
  };

  const handleDelete = async () => {
    if (!supabase || !memo?.id) return;
    
    if (!confirm('정말 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('memos')
        .delete()
        .eq('id', memo.id);

      if (error) throw error;
      router.push('/memo');
    } catch (error) {
      console.error('삭제 에러:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const likeCount = (memo?.likes || 0) + (isLiked ? 1 : 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GlobalNav />
        <div className={`${APP_HORIZONTAL_CONTAINER} py-8`}>
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">로딩 중...</div>
          </div>
        </div>
        <FooterNav />
      </div>
    );
  }

  if (!memo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GlobalNav />
        <div className={`${APP_HORIZONTAL_CONTAINER} py-8`}>
          <div className="text-center py-20">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500 dark:text-gray-400">글을 찾을 수 없습니다</p>
            <button
              onClick={() => router.push('/memo')}
              className="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              목록으로 돌아가기
            </button>
          </div>
        </div>
        <FooterNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <GlobalNav />

      {/* 상단 네비게이션 */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className={`${APP_HORIZONTAL_CONTAINER} py-3 flex items-center justify-between`}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">뒤로</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
              title="수정"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-50"
              title="삭제"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className={`${APP_HORIZONTAL_CONTAINER} py-6`}>
        {/* 제목 */}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 leading-tight">
          {memo.title || '제목 없음'}
        </h1>

        {/* 메타 정보 */}
        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <span>{formatDateTime(memo.created_at)}</span>
          {memo.updated_at && memo.updated_at !== memo.created_at && (
            <span className="text-xs text-gray-400">(수정됨)</span>
          )}
        </div>

        {/* 본문 내용 */}
        <div 
          className="memo-content prose dark:prose-invert max-w-none mb-8 text-[14px]"
          dangerouslySetInnerHTML={{ __html: memo.content }}
          style={{
            lineHeight: 1.8,
          }}
        />

        {/* 하단 액션 */}
        <div className="flex items-center justify-between py-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all ${
                isLiked 
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-500' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
              }`}
            >
              <span className="text-lg">{isLiked ? '❤️' : '🤍'}</span>
              <span className="text-sm font-medium">{likeCount}</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
              <span className="text-lg">💬</span>
              <span className="text-sm font-medium">{memo.comments || 0}</span>
            </div>
          </div>

          {/* 공유 버튼 */}
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: memo.title || '다이어리',
                  text: memo.title,
                  url: window.location.href,
                });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('링크가 복사되었습니다!');
              }
            }}
            className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
            title="공유"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      <FooterNav />

      <style jsx global>{`
        .memo-content.prose {
          font-size: 14px;
        }
        .memo-content.prose img {
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        .memo-content.prose p {
          margin-bottom: 1rem;
        }
        .memo-content.prose ul, .memo-content.prose ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .memo-content.prose li {
          margin-bottom: 0.25rem;
        }
      `}</style>
    </div>
  );
}

