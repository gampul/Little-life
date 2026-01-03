'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '../../lib/supabase';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard: 인증되지 않은 사용자를 /login으로 리다이렉트
 * middleware.ts에서 이미 서버 사이드 체크를 하지만,
 * 클라이언트 사이드에서도 명시적으로 체크하여 UX 개선
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const supabase = getSupabase();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (!supabase) {
      console.error('❌ Supabase 클라이언트를 초기화할 수 없습니다.');
      router.push('/login');
      return;
    }

    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        
        if (!mounted) return;

        if (error || !data.user) {
          console.warn('⚠️ 인증되지 않은 사용자, /login으로 리다이렉트');
          router.push('/login');
          return;
        }

        setIsAuthenticated(true);
      } catch (err) {
        console.error('❌ 인증 체크 오류:', err);
        if (mounted) {
          router.push('/login');
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    // 인증 상태 변경 감지
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        console.warn('⚠️ 로그아웃 감지, /login으로 리다이렉트');
        router.push('/login');
      } else if (event === 'SIGNED_IN') {
        setIsAuthenticated(true);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // 리다이렉트 중이므로 아무것도 렌더링하지 않음
  }

  return <>{children}</>;
}

