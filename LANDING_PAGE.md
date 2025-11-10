# Little Life - 랜딩 페이지

## 🎉 완료된 기능

### ✨ 테마 시스템
- ✅ **next-themes** 라이브러리 사용
- ✅ 시스템 설정 자동 감지 (prefers-color-scheme)
- ✅ localStorage 저장으로 영구 보존
- ✅ 부드러운 테마 전환 애니메이션

### 🎨 UI 컴포넌트

#### 1. 헤더 (Header)
- ✅ Sticky 헤더 - 스크롤 시 고정
- ✅ 스크롤 시 배경 블러 효과
- ✅ 로고 + 네비게이션 + 테마 토글
- ✅ 반응형 디자인

#### 2. 테마 토글 버튼 (ThemeToggle)
- ✅ 라이트 모드: 🌙 문 아이콘
- ✅ 다크 모드: ☀️ 해 아이콘
- ✅ 호버 시 회전 애니메이션 (180도)
- ✅ 클릭 시 smooth transition
- ✅ Hydration 이슈 해결

#### 3. Hero 섹션
- ✅ 대형 타이틀 + 그라데이션 텍스트
- ✅ CTA 버튼 (Start Free Trial, Watch Demo)
- ✅ 통계 표시 (10K+ Users, 50K+ Tasks, 4.9/5 Rating)
- ✅ Framer Motion 페이드 인 애니메이션

#### 4. Features 섹션
- ✅ 3단 카드 그리드 레이아웃
- ✅ 6개 주요 기능 소개
- ✅ 스크롤 인뷰 애니메이션
- ✅ 호버 효과

#### 5. Testimonials 섹션
- ✅ 2단 레이아웃
- ✅ 사용자 후기 4개
- ✅ 별점 표시
- ✅ 스크롤 인뷰 애니메이션

#### 6. Footer
- ✅ 브랜드 정보
- ✅ 링크 섹션 (Product, Company)
- ✅ 소셜 미디어 링크
- ✅ 저작권 정보

### 🎨 컬러 시스템

#### Light Theme
- **배경**: white / gray-50
- **텍스트**: gray-900 / gray-600
- **Primary**: blue-600
- **Border**: gray-200
- **Shadow**: subtle

#### Dark Theme
- **배경**: gray-900 / black
- **텍스트**: white / gray-400
- **Primary**: blue-500
- **Border**: gray-700
- **Shadow**: none

### ♿ 접근성 (Accessibility)
- ✅ ARIA labels 추가
- ✅ 키보드 네비게이션 지원
- ✅ 포커스 스타일 개선
- ✅ 시맨틱 HTML 사용

### 📱 반응형 디자인
- ✅ 모바일 최적화
- ✅ 태블릿 레이아웃
- ✅ 데스크톱 레이아웃
- ✅ Tailwind breakpoints 활용 (sm, md, lg)

## 🚀 실행 방법

```bash
# 개발 서버 시작
npm run dev
```

브라우저에서 접속:
- **랜딩 페이지**: http://localhost:3000
- **대시보드**: http://localhost:3000/dashboard

## 📁 파일 구조

```
src/app/
├── components/
│   ├── Header.tsx          # Sticky 헤더 + 블러 효과
│   ├── ThemeToggle.tsx     # 테마 토글 버튼
│   ├── Hero.tsx            # 히어로 섹션
│   ├── Features.tsx        # 기능 소개
│   ├── Testimonials.tsx    # 사용자 후기
│   └── Footer.tsx          # 푸터
├── dashboard/
│   └── page.tsx            # 기존 대시보드 앱
├── contexts/
│   └── ThemeContext.tsx    # (레거시)
├── providers.tsx           # next-themes Provider
├── layout.js               # 루트 레이아웃
├── page.tsx                # 랜딩 페이지 (NEW)
└── globals.css             # 글로벌 스타일
```

## 🎯 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Theme**: next-themes
- **Animation**: Framer Motion
- **UI**: React 19

## ✨ 주요 기능

### 1. 테마 자동 감지
시스템의 다크 모드 설정을 자동으로 감지하여 초기 테마를 설정합니다.

### 2. 부드러운 애니메이션
Framer Motion을 사용하여 자연스러운 페이지 전환과 인터랙션을 제공합니다.

### 3. 성능 최적화
- 이미지 lazy loading
- 컴포넌트 분리
- CSS transition 최적화

### 4. SEO 최적화
- 메타데이터 설정
- 시맨틱 HTML
- 접근성 준수

## 🎨 커스터마이징

### 색상 변경
`src/app/globals.css`에서 CSS 변수를 수정하세요:

```css
:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #111827;
  --foreground: #f9fafb;
}
```

### 컨텐츠 수정
각 컴포넌트 파일에서 텍스트와 데이터를 수정할 수 있습니다:

- `Hero.tsx`: 메인 타이틀, CTA 버튼
- `Features.tsx`: 기능 목록
- `Testimonials.tsx`: 사용자 후기

## 📝 참고사항

1. **대시보드 접근**: 기존 대시보드는 `/dashboard` 경로로 이동되었습니다.
2. **테마 저장**: 선택한 테마는 localStorage에 저장되어 재방문 시 유지됩니다.
3. **반응형**: 모든 컴포넌트는 모바일 우선으로 디자인되었습니다.

## 🐛 문제 해결

### Hydration 오류가 발생하는 경우
next-themes의 `mounted` 상태를 확인하여 클라이언트에서만 렌더링되도록 처리되어 있습니다.

### 다크 모드가 적용되지 않는 경우
1. `layout.js`에 `suppressHydrationWarning` 속성이 있는지 확인
2. 브라우저 개발자 도구에서 `<html>` 태그에 `dark` 클래스가 추가되는지 확인

## 🎉 완성!

모든 기능이 구현되었습니다. 개발 서버를 실행하고 랜딩 페이지를 확인해보세요!

