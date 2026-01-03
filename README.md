# 🌱 Little Life

> 작은 습관이 만드는 큰 변화 - 경제적 자유를 위한 자산 관리 앱

일상의 루틴, 건강, 재무를 통합 관리하는 개인 라이프 트래킹 앱입니다.

## ✨ 주요 기능

### 📋 데일리 루틴 (Daily)
- **동적 루틴 관리**: 자유롭게 루틴 추가/수정/삭제 (Soft Delete 지원)
- **루틴 타입**: 체크박스형 / 숫자 입력형 (단위 커스터마이징)
- **실시간 통계**: 
  - 체크박스형: 연속 달성일 표시
  - 숫자형: 연간 누적 합계 표시
- **캘린더 뷰**: 월별/연간 달성 현황 시각화
- **최근 5일 빠른 입력**: 날짜별 체크/숫자 입력
- **원형 진행률 차트**: 루틴별 달성률 시각화

### ⚖️ 체중 트래킹
- 일일 체중 기록 및 그래프
- 기간별 필터 (7일/1개월/1년/연초부터/전체)
- 날짜별 체중 기록 목록 표시

### 🍽️ 식사 기록
- 아침/점심/저녁 체크
- 식사 메모 및 이미지 업로드 (최대 10장)
- 월별 식사 기록 아코디언 뷰
- 이미지 미리보기 (+N 표시)

### 💳 가계부 (Ledger/Exp-trx)
- **거래 관리**: 수입/지출/이체 기록
- **월별 요약**: 수입/지출/합계 자동 계산
- **거래 필터**: 전체/수입/지출 필터링
- **이체 처리**: 자산 간 이체 자동 페어링
- **소프트 삭제**: 삭제된 거래 복구 가능
- **자산/카테고리 관리**: 커스터마이징 가능

### 💰 자산 관리 (Property/Account)
- 기간별 자산 현황 (CSV 업로드 지원)
- 소유자별/구분별/카테고리별 통계
- 차트 시각화 (라인/바/파이 차트)
- 최근 3개월 추이 테이블

### 📝 다이어리 (Diary/Memo)
- 마크다운 에디터 (H1-H3, 체크리스트, 인용, 코드, 링크)
- 이미지 업로드 및 미리보기
- 그리드/리스트/컴팩트 뷰 모드
- 좋아요 및 댓글 기능 (로컬)

### 🤖 AI Agent (개발 중)
- 일상 데이터 종합 분석
- 맞춤형 라이프 코칭
- 개선 제안 및 조언

### ⚙️ 설정 (Settings)
- 루틴 템플릿 관리 (개별 저장/삭제/순서 변경)
- 다크/라이트 테마 전환
- 루틴 진행률 통계

## 🔐 인증 시스템

- **Supabase Auth**: 이메일/비밀번호 로그인
- **전역 인증**: Middleware를 통한 서버 사이드 인증
- **AuthGuard**: 클라이언트 사이드 재확인
- **실시간 감지**: 로그아웃 즉시 리다이렉트
- **RLS (Row Level Security)**: 사용자별 데이터 격리

## 🚀 빠른 시작

### 1. Supabase 설정

#### 필수 테이블 생성
다음 마이그레이션 파일들을 Supabase SQL Editor에서 순서대로 실행하세요:

```sql
-- 1. 루틴 템플릿 및 체크 기록
supabase/migrations/add_routine_type.sql
supabase/migrations/add_routine_unit.sql
supabase/migrations/add_routine_value.sql
supabase/migrations/add_routine_templates_deleted_at.sql

-- 2. 가계부 (자산, 카테고리, 거래)
-- Supabase 대시보드에서 직접 생성 또는 SQL 실행
-- 자세한 내용은 프로젝트 코드 참조
```

#### RLS 정책 설정
```sql
-- 모든 테이블에 대해 user_id 기반 RLS 정책 적용
-- 예시 (routine_templates):
ALTER TABLE routine_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own routines"
  ON routine_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routines"
  ON routine_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 다른 테이블도 동일하게 적용
```

#### Storage 설정 (이미지 업로드용)
```sql
-- meal-images 버킷 생성 (Public)
-- Supabase 대시보드 > Storage > New Bucket
-- Name: meal-images
-- Public: Yes
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하세요:

```env
# Supabase 설정 (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 날씨 API 설정 (선택사항)
NEXT_PUBLIC_WEATHER_API_KEY=your_openweathermap_api_key

# AI API 설정 (개발 중)
OPENAI_API_KEY=your_openai_api_key
```

### 3. 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## 📦 기술 스택

- **Framework**: Next.js 16.1.1 (App Router, Turbopack)
- **Language**: TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **UI**: Tailwind CSS
- **Charts**: Recharts
- **Markdown**: Custom Editor
- **Authentication**: Supabase Auth (SSR)
- **State Management**: React Hooks
- **Image Upload**: Supabase Storage

## 📂 프로젝트 구조

```
little-life/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Daily 페이지 (메인)
│   │   ├── daily/page.tsx              # Daily 라우트
│   │   ├── memo/page.tsx               # Diary 페이지
│   │   ├── memo/[id]/page.tsx          # Diary 상세
│   │   ├── ledger/page.tsx             # 가계부 목록
│   │   ├── transaction/
│   │   │   ├── new/page.tsx            # 거래 추가
│   │   │   └── [id]/page.tsx           # 거래 수정/삭제
│   │   ├── account/page.tsx            # 자산 관리
│   │   ├── ai/page.tsx                 # AI Agent
│   │   ├── settings/page.tsx           # 설정
│   │   ├── login/page.tsx              # 로그인
│   │   ├── components/
│   │   │   ├── GlobalNav.tsx           # 상단 네비게이션
│   │   │   ├── FooterNav.tsx           # 하단 네비게이션
│   │   │   ├── AuthGuard.tsx           # 인증 가드
│   │   │   └── WeightChart.tsx         # 체중 차트
│   │   ├── actions/
│   │   │   ├── auth.ts                 # 인증 서버 액션
│   │   │   └── transactions.ts         # 거래 서버 액션
│   │   └── layout.tsx                  # 루트 레이아웃
│   └── lib/
│       ├── supabase.ts                 # Supabase 클라이언트
│       └── supabase_ssr.ts             # Supabase SSR 클라이언트
├── middleware.ts                        # 전역 인증 미들웨어
├── supabase/migrations/                 # 데이터베이스 마이그레이션
└── public/                              # 정적 파일
```

## 🗄️ 데이터베이스 스키마

### 주요 테이블

#### routine_templates
- 사용자별 루틴 템플릿
- 필드: `id`, `user_id`, `emoji`, `label`, `field_key`, `sort_order`, `type`, `unit`, `deleted_at`

#### daily_routine_checks
- 날짜별 루틴 체크 상태
- 필드: `id`, `user_id`, `date`, `routine_id`, `value`

#### daily_records
- 체중, 식사, 메모 등 기본 정보
- 필드: `id`, `user_id`, `date`, `weight`, `meal_*`, `daily_memo`, `meal_images`

#### assets
- 자산 정보
- 필드: `id`, `user_id`, `name`, `currency`, `deleted_at`

#### categories
- 수입/지출 카테고리
- 필드: `id`, `user_id`, `type`, `name`, `parent_id`, `deleted_at`

#### transactions
- 거래 기록 (수입/지출/이체)
- 필드: `id`, `user_id`, `occurred_at`, `type`, `asset_id`, `category_id`, `amount`, `currency`, `description`, `memo`, `transfer_pair_id`, `deleted_at`

#### memos
- 다이어리 메모
- 필드: `id`, `user_id`, `title`, `content`, `created_at`, `updated_at`

## 🎨 UI/UX 특징

- **반응형 디자인**: 최대 너비 412px (모바일 최적화)
- **다크 모드**: 시스템 설정 연동
- **아코디언 UI**: 섹션별 접기/펼치기
- **실시간 동기화**: 루틴 입력 즉시 반영
- **직관적 네비게이션**: 하단 탭 바 (Daily, Diary, Exp-trx, Property, AI)
- **로딩 상태**: 스켈레톤 UI 및 스피너
- **에러 처리**: 사용자 친화적 에러 메시지

## 💡 사용 팁

### 루틴 설정하기
1. Settings 페이지 이동
2. "루틴 설정" 섹션 펼치기
3. 이모지, 루틴명, 타입(체크박스/숫자), 단위 설정
4. 개별 저장 또는 순서 변경 (↑/↓)

### 빠른 루틴 입력
- Daily 페이지에서 최근 5일 버튼 클릭
- 체크박스형: 클릭으로 토글
- 숫자형: 클릭 후 값 입력

### 가계부 사용하기
1. Exp-trx 메뉴 이동
2. "+ 거래 추가" 버튼 클릭
3. 타입(수입/지출/이체) 선택
4. 자산, 카테고리, 금액, 내용 입력
5. 저장

### 이체 처리
- 타입을 "이체(출금)"으로 선택
- 출금 자산과 대상 자산 선택
- 자동으로 2개의 거래(출금/입금) 생성

## 🛠️ 개발 로드맵

### Phase 1: 핵심 기능 (완료 ✅)
- [x] 동적 루틴 관리 (체크박스/숫자형)
- [x] 체중 트래킹 및 그래프
- [x] 식사 기록 및 이미지 업로드
- [x] 다이어리 (마크다운 에디터)
- [x] 가계부 MVP (수입/지출/이체)
- [x] 자산 관리 (CSV 업로드)
- [x] Supabase Auth 통합
- [x] 전역 인증 시스템
- [x] Soft Delete 구현

### Phase 2: 확장 기능 (진행 중 🚧)
- [x] 루틴 캘린더 뷰 (월별/연간)
- [x] 최근 5일 빠른 입력
- [x] 이미지 업로드 (식사/메모)
- [ ] 가계부 고급 필터 (날짜 범위, 금액 범위)
- [ ] 자산 통계 대시보드 개선
- [ ] 데이터 내보내기/가져오기

### Phase 3: AI 통합 (예정 📅)
- [ ] Claude/GPT API 연동
- [ ] 루틴 달성률 분석 및 조언
- [ ] 체중 변화 패턴 분석
- [ ] 가계부 지출 패턴 분석
- [ ] 일기 감정 분석
- [ ] 주간/월간 리포트 자동 생성

### Phase 4: 고급 기능 (예정 📅)
- [ ] 목표 설정 및 알림
- [ ] PWA (Progressive Web App)
- [ ] 모바일 앱 (React Native)
- [ ] 소셜 기능 (친구와 공유)
- [ ] 데이터 백업/복원

## 🔧 개발 가이드

### 환경 요구사항
- Node.js 18.17 이상
- npm 또는 yarn
- Supabase 계정

### 로컬 개발
```bash
# 개발 서버 실행 (Turbopack)
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start

# 린트
npm run lint
```

### 마이그레이션 추가
```bash
# 새 마이그레이션 파일 생성
# supabase/migrations/YYYYMMDD_description.sql
```

### 디버깅
- 브라우저 콘솔 확인 (F12)
- 서버 로그 확인 (터미널)
- Supabase 대시보드에서 쿼리 확인

## 🐛 알려진 이슈

- 날씨 API 키가 없으면 콘솔에 경고 표시 (정상 동작)
- 이미지 업로드 시 Supabase Storage 버킷 필요
- 첫 로그인 후 페이지 새로고침 필요할 수 있음

## 📝 라이선스

MIT License

## 🤝 기여

이슈 및 PR은 언제든 환영합니다!

### 기여 방법
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 문의

- GitHub Issues: [프로젝트 이슈 페이지]
- Email: [이메일 주소]

---

**Little Life** 🌱 - 매일 조금씩 성장하는 나를 기록하세요

*Happiness Unlocked - 경제적 자유를 위한 첫 걸음*
