# 🚀 Little Life 배포 가이드

> Vercel을 사용한 간단하고 빠른 배포 방법

## 📋 목차

1. [배포 전 체크리스트](#배포-전-체크리스트)
2. [Vercel 배포하기](#vercel-배포하기)
3. [환경 변수 설정](#환경-변수-설정)
4. [배포 후 확인사항](#배포-후-확인사항)
5. [트러블슈팅](#트러블슈팅)

---

## ✅ 배포 전 체크리스트

### 1. 필수 파일 확인

```bash
little-life/
├── package.json          # ✓ 필수
├── next.config.js        # ✓ 필수
├── tsconfig.json         # ✓ 필수
├── tailwind.config.ts    # ✓ 필수
├── app/
│   ├── layout.tsx        # ✓ 필수
│   ├── page.tsx          # ✓ 필수
│   └── globals.css       # ✓ 필수
└── .env.local            # ⚠️ 로컬에만 (배포 시 Vercel에 직접 설정)
```

### 2. package.json 확인

다음 스크립트가 있는지 확인하세요:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

### 3. .gitignore 확인

```gitignore
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

### 4. Supabase 프로젝트 준비

- ✅ Supabase 프로젝트 생성 완료
- ✅ `migration.sql` 실행 완료
- ✅ RLS (Row Level Security) 정책 설정 (선택사항)
- ✅ API URL과 Anon Key 확인

---

## 🚀 Vercel 배포하기

### 방법 1: GitHub 연동 (추천 ⭐)

#### 1단계: GitHub 저장소 생성

```bash
# 프로젝트 디렉토리에서
git init
git add .
git commit -m "Initial commit"

# GitHub에 새 저장소 생성 후
git remote add origin https://github.com/your-username/little-life.git
git branch -M main
git push -u origin main
```

#### 2단계: Vercel 연동

1. [vercel.com](https://vercel.com) 방문
2. "Sign up with GitHub" 클릭
3. "New Project" 클릭
4. GitHub 저장소 선택
5. "Import" 클릭

#### 3단계: 프로젝트 설정

Vercel이 자동으로 감지합니다:
- Framework Preset: **Next.js**
- Build Command: `next build`
- Output Directory: `.next`
- Install Command: `npm install`

**"Deploy" 버튼 클릭!** 🎉

---

### 방법 2: Vercel CLI 사용

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 디렉토리에서
vercel login
vercel

# 질문에 답변
# - Set up and deploy? Y
# - Which scope? (계정 선택)
# - Link to existing project? N
# - Project name? little-life
# - Directory? ./
# - Override settings? N

# 배포 완료! 🚀
```

---

## 🔐 환경 변수 설정

### Vercel Dashboard에서 설정

1. Vercel 프로젝트 선택
2. **Settings** → **Environment Variables** 이동
3. 다음 변수 추가:

```
Name: NEXT_PUBLIC_SUPABASE_URL
Value: https://your-project.supabase.co

Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: your-anon-key
```

4. Environment 선택:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

5. **Save** 클릭

### 환경 변수 재배포

환경 변수를 추가/수정한 후:

```bash
# Dashboard에서 "Redeploy" 클릭
# 또는 CLI로
vercel --prod
```

---

## ✅ 배포 후 확인사항

### 1. 배포 URL 확인

```
https://little-life-abc123.vercel.app
```

Vercel이 자동으로 생성한 URL로 접속해보세요.

### 2. 기능 테스트

- [ ] 페이지 로딩 확인
- [ ] 루틴 추가/수정/삭제
- [ ] 날짜 선택 및 데이터 입력
- [ ] 체중 그래프 표시
- [ ] 월별 달성 현황 표시
- [ ] Supabase 연결 확인

### 3. 개발자 도구 콘솔 확인

```
F12 → Console 탭
```

에러 메시지가 없는지 확인하세요.

### 4. Supabase 연결 확인

Supabase Dashboard에서:
- Table Editor → `routine_templates` 데이터 확인
- Table Editor → `daily_routine_checks` 데이터 확인
- Table Editor → `daily_records` 데이터 확인

---

## 🎨 커스텀 도메인 설정 (선택사항)

### 1. 도메인 구매

- [Vercel Domains](https://vercel.com/domains) (추천)
- [Namecheap](https://www.namecheap.com)
- [GoDaddy](https://www.godaddy.com)

### 2. Vercel에 도메인 추가

1. Vercel 프로젝트 → **Settings** → **Domains**
2. 도메인 입력 (예: `little-life.com`)
3. DNS 설정 지침 따라하기

#### Vercel 도메인인 경우:
자동으로 설정됩니다! ✨

#### 외부 도메인인 경우:
DNS 레코드 추가:
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 3. SSL 인증서

Vercel이 자동으로 Let's Encrypt SSL 인증서를 발급합니다. 🔒

---

## 🔧 트러블슈팅

### 문제 1: 빌드 실패

**증상:**
```
Error: Command "npm run build" exited with 1
```

**해결방법:**

1. 로컬에서 빌드 테스트:
```bash
npm run build
```

2. TypeScript 에러 확인:
```bash
npm run lint
```

3. 의존성 문제:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

### 문제 2: 환경 변수 인식 안됨

**증상:**
```
Error: supabaseUrl is required.
```

**해결방법:**

1. 환경 변수명 확인:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL`
   - ❌ `SUPABASE_URL`
   
2. 환경 변수 저장 후 재배포:
   - Vercel Dashboard → Deployments → **Redeploy**

3. 코드에서 확인:
```typescript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

---

### 문제 3: Supabase 연결 실패

**증상:**
```
Failed to fetch data from Supabase
```

**해결방법:**

1. Supabase URL과 Key 재확인
2. Supabase 프로젝트 일시정지 여부 확인
3. RLS 정책 확인:

```sql
-- RLS 비활성화 (테스트용)
ALTER TABLE routine_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_routine_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records DISABLE ROW LEVEL SECURITY;
```

4. CORS 설정 확인 (Supabase는 기본적으로 모든 도메인 허용)

---

### 문제 4: 페이지 404 에러

**증상:**
```
404 - This page could not be found
```

**해결방법:**

1. `app/page.tsx` 파일 존재 확인
2. `app/layout.tsx` 파일 존재 확인
3. 파일명 대소문자 확인 (Linux는 대소문자 구분!)

---

### 문제 5: 이미지 최적화 에러

**증상:**
```
Error: Failed to optimize image
```

**해결방법:**

`next.config.js` 수정:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['your-supabase-project.supabase.co'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
}

module.exports = nextConfig
```

---

## 📊 성능 최적화

### 1. 빌드 출력 분석

```bash
npm run build
```

출력 예시:
```
Route (app)                              Size     First Load JS
┌ ○ /                                    5.2 kB         85 kB
└ ○ /_not-found                          871 B          78 kB

○  (Static)  automatically rendered as static HTML
```

### 2. Vercel Analytics 활성화

1. Vercel 프로젝트 → **Analytics** 탭
2. **Enable Analytics** 클릭
3. 무료 플랜: 2,500 이벤트/월

### 3. 이미지 최적화

Next.js Image 컴포넌트 사용:
```typescript
import Image from 'next/image'

<Image 
  src="/logo.png" 
  width={200} 
  height={200} 
  alt="Logo"
/>
```

---

## 🔄 자동 배포 설정

### GitHub Actions (선택사항)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

GitHub Secrets에 `VERCEL_TOKEN` 추가.

---

## 🎯 배포 완료 체크리스트

- [ ] ✅ Vercel 배포 성공
- [ ] ✅ 환경 변수 설정 완료
- [ ] ✅ 배포 URL 접속 확인
- [ ] ✅ Supabase 연결 확인
- [ ] ✅ 모든 기능 테스트 완료
- [ ] ✅ 에러 없음
- [ ] ✅ 모바일 반응형 확인
- [ ] ✅ (선택) 커스텀 도메인 설정

---

## 📚 추가 리소스

- [Vercel 공식 문서](https://vercel.com/docs)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)
- [Supabase 문서](https://supabase.com/docs)
- [Vercel CLI 문서](https://vercel.com/docs/cli)

---

## 🆘 문제가 계속되나요?

1. **Vercel Logs 확인:**
   - Dashboard → Deployments → 실패한 배포 클릭 → Logs

2. **Supabase Logs 확인:**
   - Supabase Dashboard → Logs

3. **커뮤니티 도움 받기:**
   - [Vercel Discord](https://vercel.com/discord)
   - [Next.js Discussions](https://github.com/vercel/next.js/discussions)

---

## 🎉 배포 완료!

축하합니다! **Little Life**가 전 세계에 공개되었습니다! 🌍

배포 URL을 친구들과 공유하세요:
```
https://your-project.vercel.app
```

이제 언제 어디서나 습관을 관리할 수 있습니다! 🌱

---

**Happy Deploying!** 🚀