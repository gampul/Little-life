# 루틴 타입 기능 설정 가이드

## 개요
이 가이드는 루틴에 타입(체크박스/숫자)을 추가하는 기능을 설정하는 방법을 안내합니다.

## 데이터베이스 마이그레이션

### 1. Supabase SQL Editor 접속
1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인
2. 프로젝트 선택
3. 왼쪽 사이드바에서 **SQL Editor** 클릭

### 2. 마이그레이션 실행
다음 SQL을 실행하여 `routine_templates` 테이블에 `type` 컬럼을 추가합니다:

```sql
-- Add type column to routine_templates table
ALTER TABLE routine_templates 
ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'checkbox';

-- Add check constraint to ensure type is either 'checkbox' or 'number'
ALTER TABLE routine_templates
ADD CONSTRAINT routine_type_check 
CHECK (type IN ('checkbox', 'number'));

-- Update existing records to have 'checkbox' type if NULL
UPDATE routine_templates 
SET type = 'checkbox' 
WHERE type IS NULL;
```

### 3. 확인
마이그레이션이 성공적으로 완료되면 다음과 같이 확인할 수 있습니다:

```sql
-- routine_templates 테이블 구조 확인
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'routine_templates';
```

## 기능 설명

### 체크박스 타입
- 기본 타입
- 완료/미완료 체크만 가능
- 연속 일수 표시

### 숫자 타입
- 소수점 1자리까지 입력 가능
- 연간 누적 값 자동 계산
- 예: 물 마시기(리터), 운동 시간(시간), 거리(km) 등

## 사용 방법

### 1. 설정 페이지에서 루틴 타입 선택
1. 설정 페이지로 이동
2. 각 루틴의 "타입" 옵션에서 선택
   - ◉ 체크박스: 완료/미완료만 체크
   - ○ 숫자: 값 입력 가능
3. 저장 버튼 클릭

### 2. 메인 페이지에서 사용
- **체크박스 타입**: 체크박스 클릭으로 완료 표시
- **숫자 타입**: 
  - 숫자 입력 필드에 값 입력
  - 연간 누적 값이 자동으로 표시됨 (예: 📊 125.5)

## 예시

### 체크박스 타입 루틴
```
[그래프] 아침 운동    5일 연속 ☑️
```

### 숫자 타입 루틴
```
[그래프] 물 마시기    📊 45.5  [2.5]
                     (연간)   (오늘)
```

## 문제 해결

### 타입 컬럼이 없다는 오류
```
ERROR: column "type" does not exist
```
→ 위의 마이그레이션 SQL을 실행하세요.

### 기존 루틴이 체크박스로 표시되지 않음
→ 마이그레이션의 UPDATE 문이 실행되었는지 확인하세요.

## 참고
- 기존 루틴은 자동으로 '체크박스' 타입으로 설정됩니다.
- 타입 변경 시 기존 데이터는 유지됩니다.
- 숫자 타입의 연간 누적은 현재 연도 기준으로 계산됩니다.

