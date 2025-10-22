# 🌱 Little Life

> 작은 습관이 만드는 큰 변화

일상의 루틴을 기록하고 추적하는 개인 습관 관리 앱입니다.

## ✨ 주요 기능

### 📋 동적 루틴 관리
- 자유롭게 루틴 추가/수정/삭제
- 이모지와 이름 커스터마이징
- 개인화된 데일리 체크리스트

### 🤖 AI Agent (개발 예정)
- 일상 데이터 종합 분석
- 맞춤형 라이프 코칭
- 개선 제안 및 조언
- **분석 항목:**
  - ⚖️ 체중 변화 패턴
  - 📋 데일리 루틴 달성률
  - 🍽️ 식사 기록 및 영양 밸런스
  - 💰 재무 상태 (개발 예정)
  - 📊 가계부 패턴 (개발 예정)
  - 📝 일기 감정 분석

### ⚖️ 체중 트래킹
- 일일 체중 기록
- 시각적 변화 그래프
- 기간별 필터 (7일/1개월/1년/전체)

### 🍽️ 식사 기록
- 아침/점심/저녁 체크
- 식사 메모

### 📊 통계 및 분석
- 월별 달성 현황 표
- 루틴 달성률 시각화
- 일별 메모 타임라인

## 🚀 빠른 시작

### 1. Supabase 설정

1. [migration.sql](./migration.sql) 파일을 Supabase SQL Editor에서 실행
2. 새로운 테이블이 자동 생성됩니다:
   - `routine_templates` - 루틴 템플릿
   - `daily_routine_checks` - 일일 체크 기록

### 2. 환경 변수 설정

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. 실행

```bash
npm install
npm run dev
```

## 📦 기술 스택

- **Frontend**: Next.js 14 (App Router), React
- **Backend**: Supabase (PostgreSQL)
- **UI**: Tailwind CSS
- **Charts**: Recharts
- **Language**: TypeScript
- **AI**: (예정) Claude API / GPT-4

## 📂 프로젝트 구조

```
little-life/
├── page.tsx              # 메인 페이지
├── migration.sql         # 데이터베이스 마이그레이션
├── MIGRATION_GUIDE.md    # 마이그레이션 가이드
└── README.md            # 이 파일
```

## 🗄️ 데이터베이스 스키마

### routine_templates
- 사용자별 루틴 템플릿 저장
- 이모지, 라벨, 정렬 순서 관리

### daily_routine_checks
- 날짜별 루틴 체크 상태
- routine_templates와 연결

### daily_records
- 체중, 식사, 메모 등 기본 정보
- 기존 데이터 유지

### (개발 예정)
- `financial_records` - 재무 상태 기록
- `expense_records` - 가계부 기록

## 🔄 마이그레이션 정보

기존 시스템에서 업그레이드하는 경우:
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) 참조
- 안전한 마이그레이션 프로세스
- 기존 데이터 자동 이전
- 중복 실행 안전

## 💡 사용 팁

### 루틴 설정하기
1. 우측 상단 "⚙️ 루틴 설정" 클릭
2. 이모지와 루틴명 자유롭게 설정
3. 순서 조정은 위아래로 배치

### AI Agent 확인하기
1. 우측 상단 "🤖 AI Agent" 클릭
2. 예정된 기능 확인
3. 개발 완료 시 자동 활성화

### 데이터 입력하기
1. 날짜 선택
2. "수정하기" 버튼 클릭
3. 루틴 체크, 체중, 식사, 메모 입력
4. "저장" 버튼 클릭

### 월별 현황 보기
- 기본 15일 표시
- "더보기" 버튼으로 전체 보기
- 초록색 체크마크로 달성 표시

## 🛠️ 개발 로드맵

### Phase 1: 핵심 기능 (완료 ✅)
- [x] 동적 루틴 관리
- [x] 체중 트래킹
- [x] 식사 기록
- [x] 월별 달성 현황
- [x] 일별 메모

### Phase 2: 확장 기능 (진행 중 🚧)
- [x] AI Agent 인터페이스 (UI만)
- [ ] 재무 상태 기록
- [ ] 가계부 기록
- [ ] 다중 사용자 지원

### Phase 3: AI 통합 (예정 📅)
- [ ] Claude/GPT API 연동
- [ ] 루틴 달성률 분석
- [ ] 체중 변화 패턴 분석
- [ ] 식사 영양 밸런스 체크
- [ ] 재무/가계부 패턴 분석
- [ ] 일기 감정 분석
- [ ] 주간/월간 리포트 자동 생성

### Phase 4: 고급 기능 (예정 📅)
- [ ] 목표 설정 및 알림
- [ ] 데이터 내보내기/가져오기
- [ ] 모바일 앱 (React Native)
- [ ] 소셜 기능 (친구와 공유)

## 🎨 UI 특징

- **다크 모드**: 눈이 편한 다크 테마
- **그래디언트**: 아름다운 색상 조합
- **반응형**: 모바일/태블릿/데스크톱 지원
- **직관적**: 쉽고 빠른 입력

## 🔐 보안

- Supabase RLS (Row Level Security) 적용 권장
- 환경 변수로 API 키 관리
- 사용자별 데이터 격리

## 📝 라이선스

MIT License

## 🤝 기여

이슈 및 PR은 언제든 환영합니다!

---

**Little Life** 🌱 - 매일 조금씩 성장하는 나를 기록하세요