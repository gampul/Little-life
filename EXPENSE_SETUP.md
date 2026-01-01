# 💰 가계부 기능 설정 가이드

## 📋 목차
1. [Supabase 테이블 생성](#1-supabase-테이블-생성)
2. [CSV 데이터 업로드](#2-csv-데이터-업로드)
3. [데이터 확인](#3-데이터-확인)
4. [유용한 쿼리](#4-유용한-쿼리)

---

## 1. Supabase 테이블 생성

### 방법 1: Supabase Dashboard 사용

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 `SQL Editor` 클릭

3. **테이블 생성 SQL 실행**
   - `supabase/migrations/create_expense_records.sql` 파일 내용 복사
   - SQL Editor에 붙여넣기
   - `Run` 버튼 클릭

4. **테이블 확인**
   - 좌측 메뉴에서 `Table Editor` 클릭
   - `expense_records` 테이블이 생성되었는지 확인

---

## 2. CSV 데이터 업로드

### 준비물
- 은행 거래내역 CSV 파일 (예: `2022-12-31_2026-01-01.csv`)

### CSV 파일 형식
```csv
날짜,계좌,분류,세부분류,내용,금액(원),입금/출금,메모,잔액,화폐
2026. 01. 01 09:04:28,우리은행(1002-246-217007),?? Coffee,,스타벅스커피,6600,출금,,6600,KRW
```

### 방법 1: 웹 UI 사용 (추천)

1. **가계부 페이지 접속**
   ```
   http://localhost:3000/expense
   ```

2. **CSV 업로드**
   - `📤 CSV` 버튼 클릭
   - CSV 파일 선택
   - 자동으로 데이터 업로드 및 파싱

3. **결과 확인**
   - 업로드 완료 메시지 확인
   - 거래 내역이 표시되는지 확인

### 방법 2: 스크립트 사용

1. **CSV 파일 준비**
   - 프로젝트 루트에 `expense-data.csv`로 복사
   - 또는 바탕화면에 `2022-12-31_2026-01-01.csv` 파일 유지

2. **스크립트 실행**
   ```bash
   cd scripts
   npm install
   npm run upload-expense
   ```

3. **결과 확인**
   ```
   ✅ 3259개의 레코드가 성공적으로 업로드되었습니다!
   
   📊 업로드 통계:
     총 수입: 123,456,789원
     총 지출: 98,765,432원
     잔액: 24,691,357원
     기간: 2022. 12. 31 ~ 2026. 1. 1
   ```

---

## 3. 데이터 확인

### Supabase Dashboard에서 확인

```sql
-- 전체 데이터 개수
SELECT COUNT(*) FROM expense_records;

-- 최근 10개 거래
SELECT * FROM expense_records 
ORDER BY date DESC 
LIMIT 10;
```

### 웹 UI에서 확인

1. **가계부 페이지 접속**
   ```
   http://localhost:3000/expense
   ```

2. **월별 내역 확인**
   - 좌우 화살표로 월 이동
   - 월별 아코디언 클릭하여 상세 내역 확인

3. **요약 보기**
   - `📊 요약` 탭 클릭
   - 카테고리별 지출 통계 확인

---

## 4. 유용한 쿼리

### 월별 수입/지출 합계
```sql
SELECT 
  TO_CHAR(date, 'YYYY-MM') as month,
  SUM(CASE WHEN transaction_type IN ('입금', '이체입금') THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN transaction_type IN ('출금', '이체출금') THEN amount ELSE 0 END) as expense
FROM expense_records
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;
```

### 카테고리별 지출 TOP 10
```sql
SELECT 
  category,
  SUM(amount) as total,
  COUNT(*) as count
FROM expense_records
WHERE transaction_type IN ('출금', '이체출금')
GROUP BY category
ORDER BY total DESC
LIMIT 10;
```

### 특정 키워드 검색
```sql
SELECT * FROM expense_records
WHERE description ILIKE '%커피%'
ORDER BY date DESC;
```

더 많은 쿼리는 `supabase/queries/expense-queries.sql` 파일을 참고하세요.

---

## 🔧 문제 해결

### 1. 테이블이 없다는 오류
```
expense_records 테이블이 없습니다.
```
**해결**: Supabase에서 테이블 생성 SQL 실행

### 2. CSV 업로드 실패
```
파싱된 데이터가 없습니다.
```
**해결**: 
- CSV 파일 인코딩 확인 (EUC-KR 또는 UTF-8)
- 첫 줄이 헤더인지 확인
- 컬럼 개수가 10개인지 확인

### 3. 환경 변수 오류
```
Supabase 환경 변수가 설정되지 않았습니다.
```
**해결**: `.env.local` 파일 확인
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📊 데이터 구조

### expense_records 테이블

| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| id | UUID | 고유 ID (자동 생성) |
| date | DATE | 거래 날짜 |
| account | TEXT | 계좌 |
| category | TEXT | 분류 |
| sub_category | TEXT | 세부분류 |
| description | TEXT | 거래 내용 |
| amount | NUMERIC | 금액 |
| transaction_type | TEXT | 입금/출금/이체입금/이체출금 |
| memo | TEXT | 메모 |
| balance | NUMERIC | 잔액 |
| currency | TEXT | 화폐 (기본: KRW) |
| created_at | TIMESTAMP | 생성 시간 |
| updated_at | TIMESTAMP | 수정 시간 |

---

## 🎯 다음 단계

1. ✅ Supabase 테이블 생성
2. ✅ CSV 데이터 업로드
3. ✅ 웹 UI에서 데이터 확인
4. 📊 월별/카테고리별 분석
5. 📈 차트 및 통계 추가 (향후 개발)

---

## 💡 팁

### 정기적인 데이터 백업
```sql
CREATE TABLE expense_records_backup AS
SELECT * FROM expense_records;
```

### 데이터 필터링
```sql
-- 2025년 데이터만
SELECT * FROM expense_records
WHERE date >= '2025-01-01' AND date < '2026-01-01';

-- 10만원 이상 지출
SELECT * FROM expense_records
WHERE transaction_type IN ('출금', '이체출금')
AND amount >= 100000
ORDER BY amount DESC;
```

### CSV 재업로드
- 웹 UI: 기존 데이터 자동 삭제 후 새 데이터 삽입
- 스크립트: 동일한 동작

---

## 📞 문의

문제가 발생하면 다음을 확인하세요:
1. Supabase 연결 상태
2. 테이블 존재 여부
3. RLS (Row Level Security) 정책
4. 환경 변수 설정

Happy tracking! 💰📊

