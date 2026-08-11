'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '../../../lib/supabase';

export function MemoDetailTopBar({ id }: { id: string }) {
  const router = useRouter();
  const supabase = getSupabase();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!supabase) return;
    if (!confirm('정말 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('memos').delete().eq('id', id);
      if (error) throw error;
      router.push('/memo');
    } catch (e) {
      console.error('삭제 에러:', e);
      alert('삭제 중 오류가 발생했습니다.');
      setIsDeleting(false);
    }
  };

  return (
    <>
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
          onClick={() => router.push(`/memo?edit=${id}`)}
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
    </>
  );
}

export function MemoDetailFooter({ id, title }: { id: string; title: string }) {
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    try {
      const liked = JSON.parse(localStorage.getItem('likedMemos') || '[]');
      setIsLiked(Array.isArray(liked) && liked.includes(id));
    } catch {
      setIsLiked(false);
    }
  }, [id]);

  const handleLike = () => {
    let liked: string[] = [];
    try {
      const raw = JSON.parse(localStorage.getItem('likedMemos') || '[]');
      if (Array.isArray(raw)) liked = raw;
    } catch {
      liked = [];
    }
    if (isLiked) {
      liked = liked.filter((x) => x !== id);
    } else {
      liked.push(id);
    }
    localStorage.setItem('likedMemos', JSON.stringify(liked));
    setIsLiked(!isLiked);
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: title || '다이어리', text: title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었습니다!');
    }
  };

  return (
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
          <span className="text-sm font-medium">{isLiked ? 1 : 0}</span>
        </button>

        <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-600 dark:text-gray-400">
          <span className="text-lg">💬</span>
          <span className="text-sm font-medium">0</span>
        </div>
      </div>

      <button
        onClick={handleShare}
        className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
        title="공유"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      </button>
    </div>
  );
}
