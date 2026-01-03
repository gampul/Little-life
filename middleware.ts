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


