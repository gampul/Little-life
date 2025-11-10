/** @type {import('next').NextConfig} */
const nextConfig = {
  // 환경 변수가 빌드 시점에 없을 수 있으므로 동적 렌더링 강제
  output: 'standalone',
};

export default nextConfig;
