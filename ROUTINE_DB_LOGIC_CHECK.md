# 데일리 루틴 데이터베이스 로직 검사 결과

## 📋 검사 일시
2024년 (현재)

## ✅ 정상 작동하는 부분

### 1. 루틴 템플릿 로드 (`loadRoutineTemplates`)
- ✅ Supabase 클라이언트 체크
- ✅ 에러 처리 및 로깅
- ✅ user_id 필터링
- ✅ sort_order 정렬

### 2. 루틴 체크 로드 (`loadRoutineChecks`)
- ✅ 날짜별 필터링
- ✅ PGRST116 에러 코드 무시 (데이터 없음 처리)

### 3. 루틴 체크 상태 확인 (`isRoutineChecked`)
- ✅ 로직 정상

## ⚠️ 발견된 문제점

### 🔴 심각한 문제

#### 1. 루틴 체크 저장 시 Delete 에러 처리 누락
**위치**: `handleSave` 함수 (320-348줄)

```typescript
// 2. 루틴 체크 저장
await supabase
  .from('daily_routine_checks')
  .delete()
  .eq('date', selectedDate);
```

**문제점**:
- `delete` 작업의 에러 처리가 없습니다
- `delete`가 실패해도 계속 진행되어 데이터 불일치 발생 가능
- 트랜잭션이 없어서 부분 실패 시 데이터 손실 가능

**권장 수정**:
```typescript
// 2. 루틴 체크 저장
const { error: deleteError } = await supabase
  .from('daily_routine_checks')
  .delete()
  .eq('date', selectedDate);

if (deleteError) {
  console.error('=== 루틴 체크 삭제 에러 상세 ===');
  console.error('메시지:', deleteError.message);
  console.error('코드:', deleteError.code);
  throw deleteError;
}
```

#### 2. 루틴 템플릿 저장 시 전체 삭제 후 재삽입 방식
**위치**: `RoutineSettingModal`의 `handleSave` (1193-1228줄)

**문제점**:
- 전체 삭제 후 재삽입 방식은 데이터 손실 위험이 높습니다
- 삭제는 성공했지만 삽입이 실패하면 모든 템플릿이 사라집니다
- 트랜잭션이 없어서 원자성 보장 불가

**권장 수정**:
- UPSERT 방식 사용 (Supabase의 `.upsert()`)
- 또는 트랜잭션 사용

### 🟡 개선 권장 사항

#### 3. 루틴 체크 저장 시 checked 필드 중복
**위치**: `handleSave` 함수 (326-332줄)

```typescript
const checksToInsert = routineChecks
  .filter(check => check.checked)
  .map(check => ({
    date: selectedDate,
    routine_id: check.routine_id,
    checked: true,  // 항상 true
  }));
```

**문제점**:
- `filter(check => check.checked)`로 이미 체크된 것만 필터링
- 그런데 `checked: true`를 또 명시적으로 설정
- 데이터베이스 스키마에서 `checked` 필드가 항상 true인지 확인 필요

**권장 수정**:
- 데이터베이스 스키마 확인 후, `checked` 필드가 필요 없으면 제거
- 또는 `checked` 필드를 제거하고 체크된 루틴만 저장

#### 4. 루틴 체크 로드 시 checked 필드 미사용
**위치**: `loadRoutineChecks` 함수 (113-116줄)

```typescript
const { data, error } = await supabase
  .from('daily_routine_checks')
  .select('routine_id, checked')
  .eq('date', date);
```

**문제점**:
- `checked` 필드를 조회하지만 실제로는 사용하지 않음
- `isRoutineChecked`에서는 `check.checked`를 확인하지만, 데이터가 없으면 false로 처리

**권장 수정**:
- `checked` 필드가 항상 true라면 조회에서 제거
- 또는 `checked` 필드를 실제로 활용

#### 5. 루틴 캘린더의 데이터 동기화 문제
**위치**: `RoutineCalendar` 컴포넌트 (1413-1426줄)

**문제점**:
- 로컬 스토리지와 Supabase 데이터를 병합하지만
- 캘린더에서 수정한 내용이 `handleSave`를 통해 저장되지 않음
- 캘린더 수정은 로컬 스토리지만 업데이트

**권장 수정**:
- 캘린더 수정 시 Supabase에도 저장
- 또는 캘린더 수정 시 `handleSave` 호출

## 📊 데이터베이스 스키마 확인 필요

### 확인이 필요한 사항:
1. `daily_routine_checks` 테이블의 `checked` 필드가 항상 `true`인지
2. `routine_id`와 `date`의 복합 유니크 제약 조건 존재 여부
3. Foreign Key 제약 조건 (`routine_id` → `routine_templates.id`)

## 🔧 권장 수정 사항 우선순위

### 높음 (즉시 수정)
1. ✅ 루틴 체크 저장 시 Delete 에러 처리 추가
2. ✅ 루틴 템플릿 저장 시 트랜잭션 또는 UPSERT 사용

### 중간 (개선 권장)
3. ⚠️ 루틴 체크 저장 로직 최적화 (checked 필드 처리)
4. ⚠️ 루틴 캘린더 데이터 동기화 개선

### 낮음 (선택적)
5. 💡 루틴 체크 로드 시 checked 필드 활용 개선

## 📝 테스트 시나리오

### 테스트 1: 루틴 체크 저장 실패 시나리오
1. 네트워크 오류 발생
2. Delete 성공, Insert 실패
3. 결과: 해당 날짜의 모든 루틴 체크가 사라짐 ❌

### 테스트 2: 루틴 템플릿 저장 실패 시나리오
1. Delete 성공, Insert 실패
2. 결과: 모든 루틴 템플릿이 사라짐 ❌

### 테스트 3: 동시 저장 시나리오
1. 사용자 A와 B가 동시에 저장
2. 결과: 마지막 저장만 유지 (Race Condition) ⚠️

## ✅ 결론

**전체 평가**: 🟡 **부분적으로 정상 작동하지만 개선 필요**

**주요 이슈**:
- 에러 처리 부족으로 인한 데이터 손실 위험
- 트랜잭션 부재로 인한 데이터 일관성 문제
- 일부 로직의 불필요한 복잡성

**즉시 조치 필요**: Delete 에러 처리 추가 및 트랜잭션 고려

