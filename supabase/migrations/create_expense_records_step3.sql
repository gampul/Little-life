-- ============================================
-- STEP 3: RLS (Row Level Security) 설정
-- ============================================

-- RLS 활성화
ALTER TABLE expense_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "Enable read access for all users" ON expense_records;
DROP POLICY IF EXISTS "Enable insert access for all users" ON expense_records;
DROP POLICY IF EXISTS "Enable update access for all users" ON expense_records;
DROP POLICY IF EXISTS "Enable delete access for all users" ON expense_records;

-- SELECT 정책 (모든 사용자 읽기 가능)
CREATE POLICY "Enable read access for all users" 
ON expense_records 
FOR SELECT 
USING (true);

-- INSERT 정책 (모든 사용자 삽입 가능)
CREATE POLICY "Enable insert access for all users" 
ON expense_records 
FOR INSERT 
WITH CHECK (true);

-- UPDATE 정책 (모든 사용자 수정 가능)
CREATE POLICY "Enable update access for all users" 
ON expense_records 
FOR UPDATE 
USING (true);

-- DELETE 정책 (모든 사용자 삭제 가능)
CREATE POLICY "Enable delete access for all users" 
ON expense_records 
FOR DELETE 
USING (true);

-- 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'expense_records';

