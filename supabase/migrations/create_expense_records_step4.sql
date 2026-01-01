-- ============================================
-- STEP 4: 트리거 및 함수 생성
-- ============================================

-- 기존 트리거 삭제 (있다면)
DROP TRIGGER IF EXISTS update_expense_records_updated_at_trigger ON expense_records;
DROP FUNCTION IF EXISTS update_expense_records_updated_at();

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_expense_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER update_expense_records_updated_at_trigger
  BEFORE UPDATE ON expense_records
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_records_updated_at();

-- 트리거 확인
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'expense_records';

