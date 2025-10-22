# Little Life - 마이그레이션 안전성 가이드

## ✅ 충돌 방지 기능

### 1. 중복 실행 안전 (Idempotent)
- `CREATE TABLE IF NOT EXISTS` - 테이블이 이미 있으면 스킵
- `INSERT ... WHERE NOT EXISTS` - 데이터 중복 삽입 방지
- `ON CONFLICT DO NOTHING` - 충돌 시 무시
- 인덱스 중복 생성 방지

### 2. 트랜잭션 처리
```sql
BEGIN;
  -- 모든 작업
COMMIT;
```
- 전체 작업이 하나의 단위로 실행
- 오류 발생 시 자동 롤백
- 데이터 일관성 보장

### 3. 마이그레이션 중복 실행 방지
```sql
-- daily_routine_checks가 비어있을 때만 마이그레이션 실행
IF NOT EXISTS (SELECT 1 FROM daily_routine_checks LIMIT 1) THEN
  -- 마이그레이션 수행
END IF;
```

### 4. 안전한 컬럼 삭제
- 기본적으로 주석 처리됨
- 새 시스템 검증 후 수동으로 활성화

## 🔍 실행 전 체크리스트

### ✅ 필수 확인사항
- [ ] Supabase 백업 완료
- [ ] `daily_records` 테이블 존재 확인
- [ ] 기존 데이터 개수 확인
- [ ] 테스트 환경에서 먼저 실행

### ⚠️ 주의사항
1. **프로덕션 환경에서는 피크 시간대를 피해 실행**
2. **백업 필수**: Supabase Dashboard → Database → Backups
3. **단계별 실행 권장**

## 📊 마이그레이션 시나리오별 동작

### 시나리오 1: 첫 실행
✅ **예상 동작**
1. 새 테이블 생성
2. 기본 루틴 10개 삽입
3. 기존 데이터 마이그레이션
4. 인덱스 생성

### 시나리오 2: 재실행 (테이블 이미 존재)
✅ **예상 동작**
1. 테이블 생성 스킵 (IF NOT EXISTS)
2. 기본 루틴 삽입 스킵 (WHERE NOT EXISTS)
3. 마이그레이션 스킵 (이미 데이터 있음)
4. 인덱스 생성 스킵 (이미 존재)
- **결과**: 아무 변화 없음, 안전

### 시나리오 3: 부분 실패 후 재실행
✅ **예상 동작**
- 트랜잭션으로 인해 완료된 작업만 유지
- 실패한 부분부터 재시작
- 데이터 중복 없음

## 🧪 테스트 쿼리

### 마이그레이션 전 - 데이터 확인
```sql
-- 기존 레코드 수
SELECT COUNT(*) FROM daily_records;

-- 체크된 루틴 샘플 확인
SELECT date, housework, plank, okr_writing 
FROM daily_records 
WHERE date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY date DESC;
```

### 마이그레이션 후 - 검증
```sql
-- 루틴 템플릿 확인
SELECT * FROM routine_templates ORDER BY sort_order;

-- 마이그레이션된 체크 수
SELECT COUNT(*) FROM daily_routine_checks;

-- 특정 날짜의 체크 확인
SELECT 
  dr.date,
  rt.emoji,
  rt.label,
  drc.checked
FROM daily_routine_checks drc
JOIN routine_templates rt ON drc.routine_id = rt.id
LEFT JOIN daily_records dr ON drc.date = dr.date
WHERE drc.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY drc.date DESC, rt.sort_order;
```

### 데이터 무결성 확인
```sql
-- 기존 체크된 항목 수 vs 마이그레이션된 항목 수 비교
WITH old_counts AS (
  SELECT COUNT(*) as total FROM daily_records WHERE
    housework OR plank OR okr_writing OR reading OR 
    one_day_class OR no_alcohol OR running_walk OR 
    brush OR love OR cleaning
),
new_counts AS (
  SELECT COUNT(*) as total FROM daily_routine_checks WHERE checked = true
)
SELECT 
  old_counts.total as old_total,
  new_counts.total as new_total,
  CASE 
    WHEN old_counts.total = new_counts.total THEN '✅ 일치'
    ELSE '⚠️ 불일치'
  END as status
FROM old_counts, new_counts;
```

## 🚨 문제 발생 시 대응

### 1. 마이그레이션 실패
```sql
-- 롤백 (트랜잭션 사용으로 자동 롤백되지만, 수동으로도 가능)
ROLLBACK;
```

### 2. 데이터 불일치 발견
```sql
-- daily_routine_checks 데이터만 삭제하고 재시도
DELETE FROM daily_routine_checks;
-- 그 후 마이그레이션 스크립트 재실행
```

### 3. 완전 초기화 (주의!)
```sql
-- ⚠️ 새로 만든 테이블만 삭제 (기존 daily_records는 그대로)
DROP TABLE IF EXISTS daily_routine_checks CASCADE;
DROP TABLE IF EXISTS routine_templates CASCADE;
-- 그 후 마이그레이션 스크립트 재실행
```

## 📈 마이그레이션 단계별 실행 (권장)

안전을 위해 단계별로 나눠서 실행하는 것을 권장합니다:

### 1단계: 테이블 생성만
```sql
-- migration.sql의 1~2번 섹션만 실행
CREATE TABLE IF NOT EXISTS routine_templates (...);
CREATE TABLE IF NOT EXISTS daily_routine_checks (...);
```

### 2단계: 기본 루틴 삽입
```sql
-- 3번 섹션 실행
INSERT INTO routine_templates ...
```

### 3단계: 데이터 마이그레이션
```sql
-- 4번 섹션 실행
DO $$ ... END $$;
```

### 4단계: 검증
위의 테스트 쿼리로 데이터 확인

### 5단계: 앱 테스트
React 코드 적용 후 충분히 테스트

### 6단계: (선택) 기존 컬럼 삭제
새 시스템이 완벽하게 작동하는 것을 확인한 후

## 💡 추천 실행 순서

1. ✅ Supabase 백업
2. ✅ 테스트 환경에서 마이그레이션 실행
3. ✅ 검증 쿼리로 데이터 확인
4. ✅ React 코드 적용
5. ✅ 앱 테스트 (최소 1주일)
6. ✅ 프로덕션 마이그레이션
7. ⏳ 2주 후 기존 컬럼 삭제 (선택)

## 📞 지원

문제 발생 시:
1. 에러 메시지 전체 복사
2. 실행한 쿼리 복사
3. 백업에서 복구

---
**Little Life 🌱 - 작은 습관이 만드는 큰 변화**