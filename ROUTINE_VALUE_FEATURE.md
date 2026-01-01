# 루틴 숫자 입력 기능 추가 완료

## ✅ 구현 완료 사항

루틴 설정에서 체크박스뿐만 아니라 **숫자 값도 입력**할 수 있는 기능이 추가되었습니다.

### 1. 데이터베이스 변경
- **파일**: `supabase/migrations/add_routine_value.sql`
- **변경사항**: `daily_routine_checks` 테이블에 `value` 컬럼 추가 (INTEGER 타입)
- **실행 방법**: Supabase Dashboard에서 SQL 에디터로 실행

```sql
-- 마이그레이션 실행
-- Supabase Dashboard → SQL Editor → 파일 내용 붙여넣기 → Run
```

### 2. TypeScript 인터페이스 수정
- `RoutineCheck` 인터페이스에 `value?: number | null` 추가
- 루틴 값 관리를 위한 state 추가: `routineValues`

### 3. UI 변경사항

#### 메인 화면 (데일리 루틴)
- 각 루틴 항목에 **숫자 입력 필드** 추가
- 체크박스 옆에 작은 입력 필드 표시
- 비활성화 상태에서는 입력 불가

**위치**: 체크박스 → 숫자 입력 필드 (14px 너비)

#### 캘린더 뷰
- 날짜 셀에 **숫자 값 표시**
- 날짜 아래에 작은 글씨로 값 표시
- 값이 있을 때 날짜 크기 자동 조정

### 4. 사용 예시

#### 운동 루틴
- 체크박스: 운동 했는지 여부
- 숫자: 운동 횟수 (예: 50회)

#### 물 섭취
- 체크박스: 물을 마셨는지 여부
- 숫자: 섭취량 (예: 2000ml)

#### 독서
- 체크박스: 독서 했는지 여부
- 숫자: 읽은 페이지 수 (예: 30페이지)

### 5. 데이터 저장/로드
- **저장**: 체크박스와 함께 숫자 값도 자동 저장
- **로드**: 날짜 선택 시 저장된 값 자동 로드
- **캘린더**: 전체 연도 데이터 로드하여 표시

## 🚀 사용 방법

### 1. 데이터베이스 마이그레이션 실행
1. Supabase Dashboard 접속
2. SQL Editor 메뉴 선택
3. `supabase/migrations/add_routine_value.sql` 파일 내용 복사
4. 붙여넣기 후 "Run" 버튼 클릭

### 2. 개발 서버 재시작
```bash
npm run dev
```

### 3. 기능 테스트
1. 날짜 선택
2. "수정하기" 버튼 클릭
3. 루틴 체크박스 체크
4. 숫자 입력 필드에 값 입력 (예: 50)
5. "저장" 버튼 클릭
6. 캘린더 확장하여 숫자 표시 확인

## 📝 주의사항

### 데이터베이스
- 기존 데이터는 `value = NULL`로 유지됨
- 새로 입력하는 데이터만 값이 저장됨
- 숫자를 입력하지 않으면 NULL로 저장

### UI/UX
- 숫자 입력은 선택사항 (필수 아님)
- 체크박스만 사용해도 정상 작동
- 숫자 입력 시 자동으로 체크박스 활성화되지 않음
- 수정 모드에서만 입력 가능

### 캘린더 표시
- 값이 있는 날짜만 숫자 표시
- 값이 없으면 날짜만 표시
- 날짜 크기 자동 조정으로 가독성 유지

## 🔧 기술 세부사항

### 데이터 구조
```typescript
interface RoutineCheck {
  routine_id: string;
  checked: boolean;
  value?: number | null;  // 새로 추가됨
}
```

### State 관리
```typescript
const [routineValues, setRoutineValues] = useState<Record<string, number | null>>({});
```

### 저장 로직
```typescript
const checksToInsert = routineChecks
  .filter(check => check.checked)
  .map(check => ({
    date: formData.date,
    routine_id: check.routine_id,
    checked: true,
    value: routineValues[check.routine_id] ?? null,  // 값 포함
  }));
```

## ✨ 향후 개선 가능 사항

1. **단위 표시**: 각 루틴별로 단위 설정 (회, ml, 페이지 등)
2. **통계 기능**: 월별/주별 평균 값 계산
3. **목표 설정**: 목표 값 설정 및 달성률 표시
4. **그래프**: 값의 추이를 그래프로 시각화
5. **알림**: 목표 미달성 시 알림 기능

## 🎉 완료!

모든 기능이 정상적으로 구현되었습니다. 
데이터베이스 마이그레이션만 실행하면 바로 사용 가능합니다!

