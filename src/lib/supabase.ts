import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 전역 변수로 싱글톤 인스턴스 관리 (브라우저 환경에서도 유지)
let supabaseInstance: SupabaseClient | null = null;

// 브라우저 환경에서 전역 객체에 저장 (HMR 방지)
declare global {
  interface Window {
    __SUPABASE_INSTANCE__?: SupabaseClient | null;
  }
}

export function getSupabase(): SupabaseClient | null {
  // 브라우저 환경에서는 전역 객체에서 먼저 확인
  if (typeof window !== 'undefined') {
    if (window.__SUPABASE_INSTANCE__) {
      return window.__SUPABASE_INSTANCE__;
    }
  }

  // 이미 인스턴스가 있으면 재사용
  if (supabaseInstance) {
    // 브라우저 환경에서는 전역 객체에도 동기화
    if (typeof window !== 'undefined') {
      window.__SUPABASE_INSTANCE__ = supabaseInstance;
    }
    return supabaseInstance;
  }

  // 환경 변수 확인
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase 환경 변수가 설정되지 않았습니다.');
    return null;
  }

  // 단 한 번만 인스턴스 생성
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // 전역 설정으로 중복 인스턴스 방지
      headers: {
        'x-client-info': 'little-life-app',
      },
    },
  });

  // 브라우저 환경에서는 전역 객체에도 저장
  if (typeof window !== 'undefined') {
    window.__SUPABASE_INSTANCE__ = supabaseInstance;
  }

  return supabaseInstance;
}

// 클라이언트 초기화 여부 확인 함수
export function isSupabaseInitialized(): boolean {
  return supabaseInstance !== null;
}

