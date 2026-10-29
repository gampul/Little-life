-- RLS 정책 성능 최적화 (2026-10-29)
-- 상태: 작성 완료, 프로덕션 미적용 (2026-10-29 시험 실행 중 승인 대기로 취소됨)
-- auth.uid() 를 (select auth.uid()) 로 감싸 행마다 다시 계산하지 않고 쿼리당 한 번만 평가 (Supabase auth_rls_initplan 경고 33건)
-- 정책의 의미(누가 어떤 행을 보는지)는 그대로. memo_categories 의 같은 내용 중복 정책 2개 제거, FK 인덱스 1개 추가

alter policy "ai_reports_delete_own" on public.ai_reports using ((select auth.uid()) = user_id);
alter policy "ai_reports_insert_own" on public.ai_reports with check ((select auth.uid()) = user_id);
alter policy "ai_reports_select_own" on public.ai_reports using ((select auth.uid()) = user_id);
alter policy "Users can delete own categories" on public.asset_categories using ((select auth.uid()) = user_id);
alter policy "Users can insert own categories" on public.asset_categories with check ((select auth.uid()) = user_id);
alter policy "Users can update own categories" on public.asset_categories using ((select auth.uid()) = user_id);
alter policy "Users can view own categories" on public.asset_categories using ((select auth.uid()) = user_id);
alter policy "Users can delete own mappings" on public.asset_category_mappings using ((select auth.uid()) = user_id);
alter policy "Users can insert own mappings" on public.asset_category_mappings with check ((select auth.uid()) = user_id);
alter policy "Users can update own mappings" on public.asset_category_mappings using ((select auth.uid()) = user_id);
alter policy "Users can view own mappings" on public.asset_category_mappings using ((select auth.uid()) = user_id);
alter policy "Users can delete own finance_investments" on public.finance_investments using ((select auth.uid()) = user_id);
alter policy "Users can insert own finance_investments" on public.finance_investments with check ((select auth.uid()) = user_id);
alter policy "Users can update own finance_investments" on public.finance_investments using ((select auth.uid()) = user_id);
alter policy "Users can view own finance_investments" on public.finance_investments using ((select auth.uid()) = user_id);
alter policy "Users can manage own categories" on public.memo_categories using ((select auth.uid()) = user_id);
alter policy "memo_embeddings_delete_own" on public.memo_embeddings using ((select auth.uid()) = user_id);
alter policy "memo_embeddings_insert_own" on public.memo_embeddings with check ((select auth.uid()) = user_id);
alter policy "memo_embeddings_select_own" on public.memo_embeddings using ((select auth.uid()) = user_id);
alter policy "memo_embeddings_update_own" on public.memo_embeddings using ((select auth.uid()) = user_id);
alter policy "pt_delete_own" on public.pending_transactions using ((select auth.uid()) = user_id);
alter policy "pt_insert_own" on public.pending_transactions with check ((select auth.uid()) = user_id);
alter policy "pt_select_own" on public.pending_transactions using ((select auth.uid()) = user_id);
alter policy "pt_update_own" on public.pending_transactions using ((select auth.uid()) = user_id);
alter policy "Anyone can view system categories" on public.transaction_categories using ((is_system = true) OR ((select auth.uid()) IS NOT NULL));
alter policy "Users can manage own categories" on public.transaction_categories using ((is_system = false) AND ((select auth.uid()) IS NOT NULL));
alter policy "import_batches_insert_own" on public.transaction_import_batches with check (user_id = (select auth.uid()));
alter policy "import_batches_select_own" on public.transaction_import_batches using (user_id = (select auth.uid()));
alter policy "Users can delete own transactions" on public.transactions using ((select auth.uid()) = user_id);
alter policy "Users can insert own transactions" on public.transactions with check ((select auth.uid()) = user_id);
alter policy "Users can update own transactions" on public.transactions using ((select auth.uid()) = user_id);
alter policy "Users can view own transactions" on public.transactions using ((select auth.uid()) = user_id);
alter policy "Users can manage own category settings" on public.user_category_settings using ((select auth.uid()) = user_id);

-- memo_categories: 같은 조건(auth.uid() = user_id, ALL)의 정책이 3개 → 1개만 남김 (multiple_permissive_policies 경고)
drop policy if exists "users_own_categories" on public.memo_categories;
drop policy if exists "users_own_memo_categories" on public.memo_categories;

-- user_category_settings.category_id FK 인덱스 (unindexed_foreign_keys)
create index if not exists idx_user_category_settings_category_id on public.user_category_settings (category_id);
