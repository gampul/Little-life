import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { toSessionCookieOptions } from './sessionPolicy';

type BrowserCookie = {
  name: string;
  value: string;
  options?: { path?: string; domain?: string; sameSite?: string | boolean; secure?: boolean; maxAge?: number };
};

// 브라우저 쿠키 읽기/쓰기. 기본 동작(400일 보관) 대신 만료일 없는 세션 쿠키로만 저장한다.
const sessionOnlyBrowserCookies = {
  getAll() {
    if (!document.cookie) return [];
    return document.cookie.split('; ').map((part) => {
      const idx = part.indexOf('=');
      const name = idx === -1 ? part : part.slice(0, idx);
      const raw = idx === -1 ? '' : part.slice(idx + 1);
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // 디코딩할 수 없는 값은 그대로 사용
      }
      return { name, value };
    });
  },
  setAll(cookiesToSet: BrowserCookie[]) {
    for (const { name, value, options } of cookiesToSet) {
      const opts = toSessionCookieOptions(options) ?? {};
      let str = `${name}=${encodeURIComponent(value)}; Path=${opts.path ?? '/'}`;
      if (opts.domain) str += `; Domain=${opts.domain}`;
      if (opts.maxAge === 0) str += '; Max-Age=0';
      const sameSite = typeof opts.sameSite === 'string' ? opts.sameSite : 'lax';
      str += `; SameSite=${sameSite.charAt(0).toUpperCase()}${sameSite.slice(1)}`;
      if (opts.secure || window.location.protocol === 'https:') str += '; Secure';
      document.cookie = str;
    }
  },
};

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
  // NOTE: App Router + Server Actions에서 set된 쿠키 세션을 브라우저에서도 동일하게 사용하기 위해
  // @supabase/ssr의 browser client를 사용합니다.
  supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    // 서버 렌더링 중에는 document 가 없으므로 브라우저에서만 적용
    ...(typeof document !== 'undefined' ? { cookies: sessionOnlyBrowserCookies } : {}),
    global: {
      headers: {
        'x-client-info': 'little-life-app',
      },
    },
  }) as unknown as SupabaseClient;

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

