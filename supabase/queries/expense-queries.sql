-- ============================================
-- 가계부 데이터 조회 쿼리 모음
-- ============================================

-- 1. 전체 데이터 개수 확인
SELECT COUNT(*) as total_records FROM expense_records;

-- 2. 최근 10개 거래 내역
SELECT 
  date,
  transaction_type,
  category,
  description,
  amount,
  memo
FROM expense_records
ORDER BY date DESC, created_at DESC
LIMIT 10;

-- 3. 월별 수입/지출 합계
SELECT 
  TO_CHAR(date, 'YYYY-MM') as month,
  SUM(CASE WHEN transaction_type IN ('입금', '이체입금') THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN transaction_type IN ('출금', '이체출금') THEN amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN transaction_type IN ('입금', '이체입금') THEN amount ELSE -amount END) as balance
FROM expense_records
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;

-- 4. 카테고리별 지출 합계 (최근 3개월)
SELECT 
  category,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  ROUND(AVG(amount), 0) as avg_amount
FROM expense_records
WHERE 
  transaction_type IN ('출금', '이체출금')
  AND date >= CURRENT_DATE - INTERVAL '3 months'
  AND category IS NOT NULL
  AND category != ''
GROUP BY category
ORDER BY total_amount DESC;

-- 5. 특정 월의 상세 내역 (예: 2025년 12월)
SELECT 
  date,
  transaction_type,
  category,
  sub_category,
  description,
  amount,
  memo,
  balance
FROM expense_records
WHERE 
  date >= '2025-12-01'
  AND date < '2026-01-01'
ORDER BY date DESC, created_at DESC;

-- 6. 일별 지출 추이 (최근 30일)
SELECT 
  date,
  SUM(CASE WHEN transaction_type IN ('출금', '이체출금') THEN amount ELSE 0 END) as daily_expense,
  COUNT(*) as transaction_count
FROM expense_records
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- 7. 계좌별 거래 통계
SELECT 
  account,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN transaction_type IN ('입금', '이체입금') THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN transaction_type IN ('출금', '이체출금') THEN amount ELSE 0 END) as total_expense
FROM expense_records
WHERE account IS NOT NULL AND account != ''
GROUP BY account
ORDER BY transaction_count DESC;

-- 8. 고액 지출 내역 (10만원 이상)
SELECT 
  date,
  category,
  description,
  amount,
  memo
FROM expense_records
WHERE 
  transaction_type IN ('출금', '이체출금')
  AND amount >= 100000
ORDER BY amount DESC, date DESC;

-- 9. 카테고리별 월별 지출 추이
SELECT 
  TO_CHAR(date, 'YYYY-MM') as month,
  category,
  SUM(amount) as total_amount,
  COUNT(*) as transaction_count
FROM expense_records
WHERE 
  transaction_type IN ('출금', '이체출금')
  AND category IS NOT NULL
  AND category != ''
GROUP BY TO_CHAR(date, 'YYYY-MM'), category
ORDER BY month DESC, total_amount DESC;

-- 10. 특정 키워드 검색 (예: "커피")
SELECT 
  date,
  category,
  description,
  amount,
  memo
FROM expense_records
WHERE 
  description ILIKE '%커피%'
  OR memo ILIKE '%커피%'
  OR category ILIKE '%커피%'
ORDER BY date DESC;

-- 11. 연도별 수입/지출 요약
SELECT 
  EXTRACT(YEAR FROM date) as year,
  SUM(CASE WHEN transaction_type IN ('입금', '이체입금') THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN transaction_type IN ('출금', '이체출금') THEN amount ELSE 0 END) as total_expense,
  SUM(CASE WHEN transaction_type IN ('입금', '이체입금') THEN amount ELSE -amount END) as net_balance
FROM expense_records
GROUP BY EXTRACT(YEAR FROM date)
ORDER BY year DESC;

-- 12. 최근 잔액 추이 (일별)
SELECT 
  date,
  MAX(balance) as end_of_day_balance
FROM expense_records
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date
ORDER BY date DESC;

-- 13. 세부 카테고리별 지출 (특정 카테고리 내)
SELECT 
  category,
  sub_category,
  COUNT(*) as count,
  SUM(amount) as total_amount
FROM expense_records
WHERE 
  transaction_type IN ('출금', '이체출금')
  AND category = '?? 식비' -- 원하는 카테고리로 변경
GROUP BY category, sub_category
ORDER BY total_amount DESC;

-- 14. 요일별 평균 지출
SELECT 
  TO_CHAR(date, 'Day') as day_of_week,
  EXTRACT(DOW FROM date) as day_number,
  COUNT(*) as transaction_count,
  ROUND(AVG(amount), 0) as avg_amount,
  SUM(amount) as total_amount
FROM expense_records
WHERE transaction_type IN ('출금', '이체출금')
GROUP BY TO_CHAR(date, 'Day'), EXTRACT(DOW FROM date)
ORDER BY day_number;

-- 15. 데이터 품질 체크 (NULL 또는 빈 값 확인)
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN account IS NULL OR account = '' THEN 1 END) as missing_account,
  COUNT(CASE WHEN category IS NULL OR category = '' THEN 1 END) as missing_category,
  COUNT(CASE WHEN description IS NULL OR description = '' THEN 1 END) as missing_description,
  COUNT(CASE WHEN amount = 0 THEN 1 END) as zero_amount
FROM expense_records;

-- ============================================
-- 데이터 관리 쿼리
-- ============================================

-- 16. 특정 기간 데이터 삭제 (주의!)
-- DELETE FROM expense_records
-- WHERE date >= '2023-01-01' AND date < '2023-02-01';

-- 17. 카테고리 일괄 수정
-- UPDATE expense_records
-- SET category = '?? Coffee'
-- WHERE description ILIKE '%커피%' AND category IS NULL;

-- 18. 중복 데이터 확인
SELECT 
  date,
  description,
  amount,
  COUNT(*) as duplicate_count
FROM expense_records
GROUP BY date, description, amount
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 19. 데이터 백업 (새 테이블로 복사)
-- CREATE TABLE expense_records_backup AS
-- SELECT * FROM expense_records;

-- 20. 테이블 초기화 (모든 데이터 삭제 - 주의!)
-- TRUNCATE TABLE expense_records;

