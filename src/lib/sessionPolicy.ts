/**
 * 로그인 유지 정책: "접속할 때마다 로그인"
 *
 * 1) 로그인 쿠키를 '세션 쿠키'로만 저장 (만료일 없음 → 브라우저를 닫으면 사라짐)
 * 2) 탭 단위 표식(sessionStorage)으로, 로그인한 그 탭에서만 세션을 인정
 *    - 새 탭/새 창/앱 재실행으로 들어오면 표식이 없으므로 로그아웃 후 로그인 화면으로 보냄
 *    - 같은 탭에서 새로고침·메뉴 이동은 그대로 유지
 */

type CookieOptionsLike = { maxAge?: number; expires?: Date | number | string; [key: string]: unknown };

/** 저장 기간(maxAge/expires)을 떼어 세션 쿠키로 만든다. 삭제(maxAge: 0)는 그대로 둔다. */
export function toSessionCookieOptions<T extends CookieOptionsLike | undefined>(options: T): T {
  if (!options) return options;
  if (options.maxAge === 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  void _maxAge;
  void _expires;
  return rest as T;
}

/** 이 탭에서 직접 로그인했다는 표식 */
export const TAB_LOGIN_KEY = 'little-life-tab-login';

export function markTabLoggedIn() {
  try {
    window.sessionStorage.setItem(TAB_LOGIN_KEY, '1');
  } catch {
    // sessionStorage 를 쓸 수 없는 환경: 표식 없이 진행 (다음 접속 때 다시 로그인)
  }
}

export function clearTabLogin() {
  try {
    window.sessionStorage.removeItem(TAB_LOGIN_KEY);
  } catch {
    // ignore
  }
}

export function isTabLoggedIn(): boolean {
  try {
    return window.sessionStorage.getItem(TAB_LOGIN_KEY) === '1';
  } catch {
    return false;
  }
}

/** 브라우저에 남아 있는 Supabase 로그인 쿠키를 직접 지운다 (signOut 이 네트워크 오류로 실패해도 확실히 제거). */
export function clearAuthCookies() {
  if (typeof document === 'undefined') return;
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name && name.startsWith('sb-') && name.includes('auth-token')) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
    }
  }
}

/**
 * 화면이 그려지기 전에 실행되는 인라인 스크립트.
 * 이 탭에서 로그인한 적이 없으면(=새로 접속) 로그아웃 처리 전까지 화면을 숨겨 내용이 잠깐 보이는 것을 막는다.
 */
export const TAB_GATE_INLINE_SCRIPT = `(function(){try{if(location.pathname!=='/login'&&sessionStorage.getItem('${TAB_LOGIN_KEY}')!=='1'){document.documentElement.style.visibility='hidden';}}catch(e){}})();`;
