import path from 'path';
import { fileURLToPath } from 'url';
import bundleAnalyzer from '@next/bundle-analyzer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname, // 현재 디렉토리를 루트로 명시
  // Turbopack 활성화 시 webpack config 경고를 제거하기 위한 빈 설정
  turbopack: {},
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'xtbldslukkqkjdrqitoz.supabase.co',
      },
    ],
  },
  // 빌드 시점에 환경 변수 확인 (디버깅용)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 빌드 시 환경 변수 확인
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      console.log('🔍 [Next.js Build] 환경 변수 확인:');
      console.log(
        'NEXT_PUBLIC_SUPABASE_URL:',
        supabaseUrl ? '✅ 설정됨 (' + supabaseUrl.substring(0, 30) + '...)' : '❌ 없음'
      );
      console.log(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY:',
        supabaseKey ? '✅ 설정됨 (길이: ' + supabaseKey.length + ')' : '❌ 없음'
      );

      if (!supabaseUrl || !supabaseKey) {
        console.error('❌ [Next.js Build] 환경 변수가 빌드 시점에 없습니다!');
        console.error('Vercel Settings → Environment Variables에서 확인하세요.');
      }
    }
    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
