-- Step 1: 기존 CHECK 제약 조건 삭제
ALTER TABLE expense_records DROP CONSTRAINT IF EXISTS expense_records_transaction_type_check;

-- Step 2: 기존 데이터 마이그레이션 (입금→수입, 출금→지출, 이체출금→이체지출)
UPDATE expense_records
SET transaction_type = CASE
  WHEN transaction_type IN ('입금', '이체입금') THEN '수입'
  WHEN transaction_type = '출금' THEN '지출'
  WHEN transaction_type = '이체출금' THEN '이체지출'
  ELSE '지출' -- 기본값
END
WHERE transaction_type IN ('입금', '출금', '이체입금', '이체출금');

-- Step 3: 새로운 CHECK 제약 조건 추가
ALTER TABLE expense_records
ADD CONSTRAINT expense_records_transaction_type_check
CHECK (transaction_type IN ('수입', '지출', '이체지출'));

