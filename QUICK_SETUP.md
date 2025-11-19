# 🚀 빠른 설정 가이드 - 사진 업로드 기능

사진 업로드 기능이 작동하지 않는다면 다음 3단계만 실행하세요!

## ⚡ 3단계 설정

### 1단계: Storage Bucket 생성 (2분)

1. **Supabase 대시보드** 접속: https://supabase.com/dashboard
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **Storage** 클릭
4. **Create a new bucket** 버튼 클릭
5. 다음과 같이 입력:
   - **Name**: `meal-images` (정확히 입력!)
   - **Public bucket** ✅ 체크
6. **Create bucket** 클릭

### 2단계: Storage 정책 추가 (3분)

1. Storage 페이지에서 방금 만든 `meal-images` 클릭
2. 상단의 **Policies** 탭 클릭
3. **New Policy** 버튼 클릭
4. 다음 4개의 정책을 각각 추가:

#### 정책 1: 읽기 (SELECT)
```sql
CREATE POLICY "Public can view meal images"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');
```

#### 정책 2: 쓰기 (INSERT)
```sql
CREATE POLICY "Anyone can upload meal images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-images');
```

#### 정책 3: 수정 (UPDATE)
```sql
CREATE POLICY "Anyone can update meal images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meal-images');
```

#### 정책 4: 삭제 (DELETE)
```sql
CREATE POLICY "Anyone can delete meal images"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images');
```

**또는** "For full customization" 선택 → 위 SQL을 복사/붙여넣기 → Save policy

### 3단계: 테이블 컬럼 추가 (1분)

1. 왼쪽 메뉴에서 **SQL Editor** 클릭
2. **New query** 클릭
3. 다음 SQL 복사/붙여넣기:

```sql
ALTER TABLE daily_records 
ADD COLUMN IF NOT EXISTS meal_images TEXT[] DEFAULT '{}';
```

4. **RUN** 버튼 클릭 (또는 Ctrl+Enter)
5. "Success" 메시지 확인

---

## ✅ 설정 완료 확인

브라우저에서 다음을 확인하세요:

1. **앱 새로고침** (F5)
2. 식사 기록 → **✏️ 수정** 버튼 클릭
3. **📷 사진 추가** 버튼이 보이는지 확인
4. 사진 선택 → 업로드 테스트

### 콘솔 로그 확인 (F12)

업로드 시 다음과 같은 로그가 나와야 합니다:

```
📤 업로드 시작: 1 개 파일
🔍 Storage bucket 확인 중...
✅ meal-images bucket 확인됨
📁 파일 1/1: example.jpg (0.45MB)
📂 업로드 경로: default_user/2025-11-19/1234567890_abc123.jpg
✅ 업로드 성공 (example.jpg)
🔗 Public URL: https://...
✅ 이미지 업로드 완료
🏁 업로드 프로세스 종료
```

---

## 🐛 문제 해결

### "Storage bucket이 생성되지 않았습니다"

→ **1단계**를 다시 확인하세요. bucket 이름이 정확히 `meal-images`인지 확인!

### "row-level security policy" 오류

→ **2단계**의 정책 4개가 모두 추가되었는지 확인하세요.

### "bucket does not exist" 오류

→ Storage 페이지에서 `meal-images` bucket이 보이는지 확인하세요.

### 이미지가 업로드되지만 보이지 않음

→ bucket이 **Public**인지 확인하세요:
1. Storage → meal-images 클릭
2. Settings 탭
3. "Public bucket" 체크박스가 ✅ 되어 있어야 함

---

## 🎯 빠른 테스트

설정이 완료되었다면:

1. 식사 기록 수정 모드
2. 📷 사진 추가 클릭
3. 작은 이미지 파일 선택 (1MB 이하 권장)
4. 브라우저 콘솔(F12) 열어서 로그 확인
5. ✅ 성공 메시지 확인

---

## 📞 여전히 안 된다면?

브라우저 콘솔(F12)을 열고 다음 정보를 확인하세요:

1. 어떤 에러 메시지가 나오는지
2. 어느 단계에서 실패하는지
3. 빨간색 에러 로그 전체 내용

이 정보를 바탕으로 문제를 해결할 수 있습니다!

