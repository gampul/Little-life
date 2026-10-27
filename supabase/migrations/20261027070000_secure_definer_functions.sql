-- 보안: SECURITY DEFINER 함수가 남의 데이터를 읽지 못하게
-- 2026-10-27 프로덕션 적용 (Supabase migration: secure_definer_functions)
--
-- 문제: 아래 9개 함수는 p_user_id 를 인자로 받고 RLS 를 우회(SECURITY DEFINER)하는데,
--       본인 확인이 없고 anon(로그인 안 함)도 실행 가능했다 → 사용자 id 만 알면 남의 자산 조회 가능.
-- 수정: 1) 함수 맨 앞에 "p_user_id 가 로그인한 본인(auth.uid())이 아니면 거부" 추가 (시그니처·결과 동일, 앱 변경 없음)
--       2) anon·PUBLIC 의 EXECUTE 회수, authenticated·service_role 만 허용
--       3) search_path 고정 (advisor 0011)
-- 참고: set_asset_real_balance / upsert_opening_balance / get_user_asset_balances / get_user_asset_summary 는
--       존재하지 않는 ledger_transactions·asset_balances·asset_summary 를 참조해 호출 시 원래도 오류. 앱 미사용. 같은 보호만 적용.

DO $$
DECLARE
  fn record;
  def text;
  guard constant text := E'BEGIN\n  IF p_user_id IS DISTINCT FROM auth.uid() THEN\n    RAISE EXCEPTION ''forbidden: p_user_id must be the signed-in user'' USING ERRCODE = ''42501'';\n  END IF;\n';
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN (
        'get_active_categories', 'get_all_categories', 'get_main_categories',
        'get_asset_balances', 'get_asset_summary',
        'get_user_asset_balances', 'get_user_asset_summary',
        'set_asset_real_balance', 'upsert_opening_balance'
      )
  LOOP
    def := pg_get_functiondef(fn.oid);
    -- 이미 적용된 함수는 건너뜀 (재실행 안전)
    IF position('p_user_id IS DISTINCT FROM auth.uid()' in def) = 0 THEN
      -- 본문의 첫 BEGIN 뒤에 검사 삽입
      def := regexp_replace(def, '\mBEGIN\M', guard, '');
      EXECUTE def;
    END IF;

    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp', fn.proname, fn.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', fn.proname, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', fn.proname, fn.args);
  END LOOP;
END $$;

-- 나머지 함수 search_path 고정 (트리거·임베딩 검색; pgvector 는 extensions 스키마)
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_expense_records_updated_at', 'set_updated_at_timestamp', 'update_updated_at_column',
        'match_memos', 'memos_needing_embedding', 'memo_embedding_status'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, extensions, pg_temp', fn.proname, fn.args);
  END LOOP;
END $$;
