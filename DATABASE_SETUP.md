# 데이터베이스 설정 가이드

## 식사 사진 업로드 기능 추가

### 1. Supabase 데이터베이스 마이그레이션

**방법 1: Supabase Dashboard 사용**

1. Supabase 대시보드 접속
2. **SQL Editor** 탭으로 이동
3. `supabase/migrations/add_meal_images.sql` 파일의 내용을 복사
4. 새 쿼리에 붙여넣고 **RUN** 실행

**방법 2: Supabase CLI 사용 (권장)**

```bash
# Supabase CLI 설치 (처음 한번만)
npm install -g supabase

# 프로젝트와 연결
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

### 2. Storage Bucket 설정 확인

마이그레이션이 성공하면 자동으로 다음이 생성됩니다:

- **Bucket 이름**: `meal-images`
- **Public 접근**: ✅ 활성화
- **정책**:
  - ✅ 누구나 이미지 조회 가능
  - ✅ 인증된 사용자만 업로드/수정/삭제 가능

### 3. 테이블 스키마 확인

`daily_records` 테이블에 새로운 컬럼이 추가됩니다:

```sql
meal_images TEXT[] DEFAULT '{}' 
-- 이미지 URL 배열을 저장
```

### 4. 수동 설정 (마이그레이션 실패 시)

#### Step 1: 테이블 컬럼 추가

```sql
ALTER TABLE daily_records 
ADD COLUMN meal_images TEXT[] DEFAULT '{}';
```

#### Step 2: Storage Bucket 생성

1. Supabase 대시보드 → **Storage** 탭
2. **Create a new bucket** 클릭
3. Name: `meal-images`
4. **Public bucket** 체크 ✅
5. **Create bucket**

#### Step 3: Storage 정책 설정

**Storage** → **Policies** → **meal-images** 선택 후:

**읽기 정책 (SELECT):**
```sql
CREATE POLICY "Public Access for meal images"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');
```

**쓰기 정책 (INSERT):**
```sql
CREATE POLICY "Authenticated users can upload meal images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-images' AND auth.role() = 'authenticated');
```

**수정 정책 (UPDATE):**
```sql
CREATE POLICY "Users can update own meal images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');
```

**삭제 정책 (DELETE):**
```sql
CREATE POLICY "Users can delete own meal images"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');
```

## 사용 방법

### 프론트엔드 기능

1. **이미지 업로드**
   - "📷 사진 추가" 버튼 클릭
   - 이미지 파일 선택 (여러 개 가능)
   - 최대 파일 크기: 5MB per image

2. **이미지 미리보기**
   - 업로드된 이미지가 3열 그리드로 표시됨
   - 정사각형 비율로 자동 크롭

3. **이미지 삭제**
   - 편집 모드에서 이미지에 마우스 호버
   - ❌ 버튼 클릭하여 삭제

### 데이터 구조

```typescript
interface DailyRecord {
  id?: string;
  date: string;
  weight: number | null;
  meal_breakfast: boolean;
  meal_lunch: boolean;
  meal_dinner: boolean;
  meal_memo: string;
  meal_images?: string[];  // 새로 추가된 필드
  daily_memo: string;
  created_at?: string;
  updated_at?: string;
}
```

### Storage 구조

```
meal-images/
  └── default_user/
      └── 2025-11-19/
          ├── 1731974400000_abc123.jpg
          ├── 1731974401000_def456.jpg
          └── ...
```

## 트러블슈팅

### 문제 1: 업로드 실패 - "new row violates row-level security policy"

**해결책:**
- Storage 정책이 제대로 설정되지 않았습니다
- 위의 "Storage 정책 설정" 참고하여 정책 추가

### 문제 2: 이미지가 보이지 않음

**해결책:**
- Bucket이 Public인지 확인
- 브라우저 개발자 도구(F12) → Network 탭에서 이미지 URL 상태 확인
- 403 Forbidden → Public 정책 추가 필요
- 404 Not Found → 이미지가 실제로 업로드되었는지 확인

### 문제 3: "bucket does not exist"

**해결책:**
- Storage Bucket이 생성되지 않았습니다
- Supabase Dashboard → Storage → "Create new bucket" → `meal-images`

## 확인 방법

### 1. 테이블 구조 확인

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'daily_records' 
  AND column_name = 'meal_images';
```

예상 결과:
```
column_name  | data_type
-------------+-----------
meal_images  | ARRAY
```

### 2. Storage Bucket 확인

Supabase Dashboard → **Storage** → `meal-images` 버킷이 보여야 함

### 3. 정책 확인

```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';
```

4개의 정책이 보여야 합니다 (SELECT, INSERT, UPDATE, DELETE)

## 성능 최적화

### 이미지 압축 (선택사항)

클라이언트에서 이미지를 업로드하기 전에 압축할 수 있습니다:

```bash
npm install browser-image-compression
```

```typescript
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
  useWebWorker: true
};

const compressedFile = await imageCompression(file, options);
```

### Storage 용량 관리

주기적으로 오래된 이미지 정리:

```sql
-- 90일 이상 된 이미지 파일 경로 조회
SELECT name 
FROM storage.objects 
WHERE bucket_id = 'meal-images' 
  AND created_at < NOW() - INTERVAL '90 days';
```

## 다음 단계

- [ ] 이미지 압축 기능 추가
- [ ] 이미지 확대보기 (라이트박스)
- [ ] 이미지 편집 기능 (자르기, 회전)
- [ ] OCR로 식사 메뉴 자동 인식

