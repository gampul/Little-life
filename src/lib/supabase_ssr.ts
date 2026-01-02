import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}

// Server (App Router) client: cookie-based auth, RLS-safe (anon key)
export async function createSupabaseServer() {
  const { url, anonKey } = getEnv();
  // Next.js (Turbopack) may type cookies() as async
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name, options) {
        cookieStore.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
}

// Browser client (optional): anon key only
export function createSupabaseBrowser() {
  const { url, anonKey } = getEnv();
  return createBrowserClient(url, anonKey);
}


