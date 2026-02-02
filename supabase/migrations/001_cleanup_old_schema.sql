-- =============================================
-- 기존 스키마 정리 (완전 새로 시작)
-- =============================================

-- 1. 기존 VIEW 삭제
DROP VIEW IF EXISTS canonical_financial_summary CASCADE;
DROP VIEW IF EXISTS dynamic_financial_summary CASCADE;
DROP VIEW IF EXISTS canonical_net_asset CASCADE;
DROP VIEW IF EXISTS ledger_summary CASCADE;
DROP VIEW IF EXISTS asset_balances CASCADE;
DROP VIEW IF EXISTS asset_summary CASCADE;
DROP VIEW IF EXISTS asset_type_totals CASCADE;

-- 2. 기존 FUNCTION 삭제
DROP FUNCTION IF EXISTS get_financial_summary(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_cash_flow_delta(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_canonical_net_asset(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_ledger_summary(UUID) CASCADE;

-- 3. 기존 TABLE 삭제
DROP TABLE IF EXISTS ledger_transactions CASCADE;
DROP TABLE IF EXISTS assets CASCADE;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '기존 스키마 정리 완료';
END $$;
