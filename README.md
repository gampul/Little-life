# Little Life

> 작은 습관이 만드는 큰 변화 — 일상·건강·재무를 한곳에서 기록하는 개인 라이프 트래킹 웹 앱

Next.js(App Router)와 Supabase 기반으로 동작하며, 모바일 우선(콘텐츠 최대 너비 412px) UI입니다.

## 주요 기능

### Daily (`/`, `/daily`)
- 동적 루틴 템플릿(체크박스 / 숫자·단위), 소프트 삭제, 정렬
- 최근 5일 빠른 입력, 캘린더·통계·원형 진행률
- 체중 기록 및 기간별 차트 (`WeightChart`)
- 식사(아침/점심/저녁), 메모, 식사 이미지 다중 업로드
- 날씨(선택: `NEXT_PUBLIC_WEATHER_API_KEY`)

### 가계부 Exp-trx (`/ledger`)
- 수입/지출/이체 등 거래 관리, 대시보드 요약
- 필터, CSV 업로드/다운로드 등(화면별 컴포넌트)
- `/expense` 는 `/ledger`로 리다이렉트

### 자산 Assets (`/assets`)
- 자산·부채 목록, 탭(전체/자산/부채), 카테고리 매핑(`CategoryManager`)

### 투자·재무 Account (`/account`)
- `InvestmentDiary` 등 탭 기반 화면, 차트(Recharts), Supabase 연동 데이터

### 다이어리 Memo (`/memo`, `/memo/[id]`)
- `contentEditable` 기반 리치 텍스트(굵게/기울임/밑줄, 목록, 이미지 등)
- 마크다운 스타일 단축: 줄 시작 `#` / `##` / `###` 뒤 스페이스 → 제목, `-` 또는 `*` 뒤 스페이스 → 글머리
- 줄 시작 `컬러` 뒤 스페이스 → 대표 색상 팔레트, 툴바에서 글자색·컬러 피커
- 본문 기본 글자 크기 14px(에디터·상세 본문)
- 이미지: Supabase Storage **`diary-images`** 버킷(공개 읽기 권한 필요)
- 목록: 그리드 / 리스트 / 컴팩트, 페이지네이션, 좋아요·댓글 수 등 UI(일부 로컬 상태)

### AI (`/ai`)
- 채팅: `POST /api/ai/chat` (OpenAI, 사용자 데이터 연동 Function Calling)
- 리포트: `POST /api/ai/report`
- 사용 시 서버 환경 변수 **`OPENAI_API_KEY`** 필요

### 설정 (`/settings`)
- 테마(라이트/다크, `next-themes`), 루틴·카테고리 등 설정 UI

### 인증
- Supabase Auth(이메일/비밀번호), `middleware.ts`에서 쿠키/세션 갱신, 보호 라우트 처리
- 클라이언트 `AuthGuard`, 로그인 `/login`

### 레이아웃
- 상단 `GlobalNav`, 하단 `FooterNav`
- 공통 가로 띠: `src/app/components/container.ts` (`APP_HORIZONTAL_CONTAINER`, `APP_CONTENT_CONTAINER`)

## 빠른 시작

### 1. 환경 변수

프로젝트 루트에 `.env.local`을 두세요.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 선택
NEXT_PUBLIC_WEATHER_API_KEY=

# AI 채팅·리포트
OPENAI_API_KEY=
```

### 2. Supabase

- **Auth**: 이메일 로그인 등 프로젝트에서 사용하는 방식으로 처리
- **DB**: `supabase/migrations/` SQL을 프로젝트 상태에 맞게 적용(루틴, `daily_records`, 가계부·자산, `memos`, 투자 일기 등)
- **RLS**: 테이블별 `user_id` 기준 정책 필요
- **Storage**
  - 식사 이미지: 버킷 예시 `meal-images`(공개 여부는 앱 설정에 맞게)
  - 다이어리 이미지: 버킷 **`diary-images`** (메모 에디터 업로드)

### 3. 설치 및 실행

```bash
npm install
npm run dev
npm run build
npm start
npm run lint
```

- Node.js 18.17+ 권장

## 기술 스택

| 구분 | 사용 |
|------|------|
| 프레임워크 | Next.js 16.x(App Router) |
| UI | React 19, Tailwind CSS v4 |
| 데이터 | Supabase(PostgreSQL, Auth, Storage) |
| 차트 | Recharts |
| 테마 | next-themes |
| AI(선택) | OpenAI API (`openai`), 리포트·채팅 라우트 |

(의존성에 Lexical, Novel, Gemini 클라이언트 등이 포함되어 있으나, 메모 에디터는 현재 `document.execCommand` 기반 `contentEditable` 구현이 주입니다.)

## 프로젝트 구조(요약)

```
little-life/
├── middleware.ts                 # Supabase 세션·라우트 보호
├── src/
│   ├── app/
│   │   ├── layout.js             # 루트 레이아웃, ThemeProvider
│   │   ├── globals.css
│   │   ├── providers.tsx
│   │   ├── page.tsx              # Daily(메인)
│   │   ├── daily/page.tsx        # → page 재노출
│   │   ├── memo/
│   │   ├── ledger/
│   │   ├── assets/
│   │   ├── account/
│   │   ├── ai/
│   │   ├── settings/
│   │   ├── login/
│   │   ├── expense/page.tsx     # → /ledger 리다이렉트
│   │   ├── api/ai/chat|report/
│   │   ├── api/ledger/...
│   │   ├── components/           # GlobalNav, FooterNav, AuthGuard, container.ts, …
│   │   └── actions/auth.ts
│   └── lib/
│       ├── supabase.ts
│       └── supabase_ssr.ts
├── supabase/migrations/          # SQL 마이그레이션
└── public/
```

## 하단 탭 네비게이션

| 라벨 | 경로 |
|------|------|
| Daily | `/daily` (also `/`) |
| Diary | `/memo` |
| Exp-trx | `/ledger` |
| Assets | `/assets` |
| AI | `/ai` |

설정은 상단 네비에서 진입 (`/settings`).

## 데이터베이스(개략)

실제 스키마는 `supabase/migrations`를 기준으로 하세요. README에서 자주 등장하는 예:

- **routine_templates**, **daily_routine_checks** — 루틴
- **daily_records** — 날짜별 체중·식사·메모·이미지 등
- **transactions** / **expense_records** 등 — 가계부(마이그레이션 이력에 따라 상이)
- **assets**, 카테고리·매핑 — 자산 화면
- **memos** — 다이어리(`title`, `content` HTML)
- **finance_records** / 투자 일기 관련 테이블 — Account 화면

## UI/UX

- 콘텐츠 최대 너비 412px, 좌우 패딩 `px-4` / `sm:px-6` 공통 띠
- 다크 모드 지원
- `SwipeNav` 등 일부 화면에서 스와이프 보조

## 개발 로드맵(참고)

- **진행/완료에 가까운 것**: Daily·루틴·체중·식사, 가계부·자산 화면, 메모 리치 에디터·단축키, AI 채팅/리포트 API(키 필요)
- **여전히 열린 과제**: 가계부 고급 필터, 대시보드 고도화, 데이터 내보내기, AI 프롬프트·도구 고도화, PWA/알림 등

## 알려진 이슈

- Supabase 환경 변수 미설정 시 메모 등 일부 페이지에서 에러 UI 표시
- Storage 버킷·RLS 미구성 시 이미지 업로드 실패
- 날씨 API 키 없으면 해당 기능만 제한

## 라이선스

MIT License

## 기여

이슈·PR 환영합니다.

1. Fork → 브랜치 생성 → 변경 커밋 → Push → Pull Request

---

**Little Life** — 매일 조금씩 기록하는 나만의 라이프 로그
