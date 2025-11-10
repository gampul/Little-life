/** @type {import('next').NextConfig} */
const nextConfig = {
  // 환경 변수를 명시적으로 클라이언트에 노출
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
