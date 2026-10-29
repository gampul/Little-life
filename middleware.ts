import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow Next internals / static / public assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/api')
  ) {
    return NextResponse.next();
  }

  // 앱 안에서 화면을 옮기는 요청(메뉴 링크 미리 불러오기·이동, RSC)은 인증 서버에 묻지 않고 로그인 쿠키만 확인.
  // - Next 16 은 prefetch/rsc 헤더를 미들웨어 전에 지우지만, 클라이언트 라우터 요청에는 next-url 헤더가 남음
  // - 화면에 메뉴가 뜨는 순간 여러 링크가 한꺼번에 미리 불러와지며 getUser 가 몰리던 것 방지
  // - 주소를 직접 열거나 새로고침(일반 문서 요청)할 때는 아래에서 그대로 getUser 로 확인·토큰 갱신
  // - 데이터는 Supabase RLS 로 보호되고, 화면 쪽은 AuthGuard 가 로그인 만료를 처리
  const isClientRouterRequest = request.headers.has('next-url') || request.headers.has('rsc') || request.headers.has('next-router-prefetch');
  if (isClientRouterRequest) {
    const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));
    if (hasAuthCookie || pathname === '/login') return NextResponse.next();
  }

  // NOTE: we must attach cookie mutations to the response
  let response = NextResponse.next({ request });

  const { url, anonKey } = getEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = pathname === '/login';

  // Make daily the default home when logged in
  if (user && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/daily';
    url.search = '';
    const redirectRes = NextResponse.redirect(url);
    // preserve cookie mutations (refresh token etc.)
    for (const c of response.cookies.getAll()) redirectRes.cookies.set(c);
    return redirectRes;
  }

  // Logged-in users should not stay on /login
  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/daily';
    url.search = '';
    const redirectRes = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirectRes.cookies.set(c);
    return redirectRes;
  }

  // Require auth for all app pages (except /login)
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    const redirectRes = NextResponse.redirect(url);
    for (const c of response.cookies.getAll()) redirectRes.cookies.set(c);
    return redirectRes;
  }

  return response;
}

export const config = {
  matcher: [
    // Exclude static files by extension
    '/((?!.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|map)$).*)',
  ],
};


