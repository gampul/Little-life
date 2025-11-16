# 데이터베이스 및 배포 확인 가이드

## ✅ 데이터베이스 스키마 확인

### daily_records 테이블
- `daily_memo` 필드는 **TEXT** 타입이어야 합니다.
- PostgreSQL의 TEXT 타입은 최대 1GB까지 저장 가능하므로 HTML 콘텐츠 저장에 문제없습니다.

### 확인 방법
Supabase SQL Editor에서 다음 쿼리를 실행하여 확인:

```sql
SELECT 
  column_name, 
  data_type, 
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'daily_records' 
  AND column_name = 'daily_memo';
```

**예상 결과:**
- `data_type`: `text` 또는 `character varying`
- `character_maximum_length`: `null` (TEXT 타입의 경우)

### 스키마가 올바르지 않은 경우
다음 SQL을 실행하여 수정:

```sql
ALTER TABLE daily_records 
ALTER COLUMN daily_memo TYPE TEXT;
```

## ✅ 데이터 호환성

### 기존 마크다운 데이터
- 기존 마크다운 형식의 데이터는 그대로 유지됩니다.
- 표시 시 자동으로 HTML인지 마크다운인지 감지하여 렌더링합니다.
- HTML 태그로 시작하면 HTML로, 그렇지 않으면 마크다운으로 처리합니다.

### 새로운 HTML 데이터
- Tiptap 에디터로 작성한 내용은 HTML 형식으로 저장됩니다.
- 기존 마크다운 데이터와 혼용하여 사용할 수 있습니다.

## ✅ 배포 확인 사항

### 1. 환경 변수
Vercel 또는 배포 플랫폼에서 다음 환경 변수가 설정되어 있는지 확인:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 빌드 테스트
로컬에서 프로덕션 빌드 테스트:

```bash
npm run build
npm run start
```

### 3. 의존성 확인
모든 패키지가 정상적으로 설치되었는지 확인:

```bash
npm install
```

### 4. Tiptap SSR 설정
- `immediatelyRender: false` 옵션이 설정되어 있어 SSR 환경에서 정상 작동합니다.

## ⚠️ 주의사항

1. **기존 데이터**: 기존 마크다운 데이터는 그대로 유지되며, 새로 작성한 내용만 HTML로 저장됩니다.

2. **데이터 마이그레이션**: 기존 마크다운 데이터를 HTML로 변환하려면 별도의 마이그레이션 스크립트가 필요합니다. (현재는 자동 변환하지 않음)

3. **저장 형식**: 
   - 새 메모: HTML 형식 (`<p>...</p>`)
   - 기존 메모: 마크다운 형식 (그대로 유지)

## 🔍 문제 해결

### 빌드 오류가 발생하는 경우
1. `npm install` 재실행
2. `.next` 폴더 삭제 후 재빌드
3. Node.js 버전 확인 (18.x 이상 권장)

### 데이터베이스 연결 오류
1. Supabase 프로젝트 URL 확인
2. RLS (Row Level Security) 정책 확인
3. 환경 변수 재설정

