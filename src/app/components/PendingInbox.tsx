'use client';

/**
 * 가계부 확인 대기(카드 결제 문자 등) 팝업 — 모든 화면 공통 (GlobalNav 안에서 렌더)
 *  - 상단 종 아이콘을 누르면(little-life:open-pending 이벤트) 미룬 건까지 모두 불러와 그 자리에서 팝업
 *  - Daily(autoOpen)에서는 화면을 열 때 새 건(snoozed_at 없음)을 자동으로 띄우고, 새 알림도 바로 띄움
 *  - 등록 / 임시저장 / 나중에(보관) / 삭제 처리 (예전 Daily page.tsx 에서 옮김)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import { useAuth } from './AuthProvider';
import { PendingSmsPopup } from './PendingSmsPopup';
import type { PendingTransaction, TransactionType } from '../../types/pending_transaction';

const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};

export default function PendingInbox({ autoOpen }: { autoOpen: boolean }) {
  const supabase = getSupabase();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [pendingQueue, setPendingQueue] = useState<PendingTransaction[]>([]);
  // 예전 Daily 배지용 카운트 (지금은 GlobalNav 가 따로 셈) — 핸들러 호환을 위해 유지
  const [, setPendingCount] = useState<number>(0);
  const currentPopup = pendingQueue[0] ?? null;
  const autoOpenRef = useRef(autoOpen);
  autoOpenRef.current = autoOpen;

  // Load initial pending list and count (상단 종 아이콘을 누르면 다시 불러와 팝업을 띄운다)
  // 자동으로 뜨는 팝업은 "나중에"로 미룬 건(snoozed_at)을 빼고, 종을 눌렀을 때는 미룬 건까지 모두 보여준다
  const [pendingReloadTick, setPendingReloadTick] = useState(0);
  const includeSnoozedRef = useRef(false);
  useEffect(() => {
    const onOpen = () => {
      includeSnoozedRef.current = true;
      setPendingReloadTick((n) => n + 1);
    };
    window.addEventListener('little-life:open-pending', onOpen);
    return () => window.removeEventListener('little-life:open-pending', onOpen);
  }, []);
  useEffect(() => {
    if (!supabase || !userId) return;
    let isMounted = true;
    const load = async () => {
      const includeSnoozed = includeSnoozedRef.current;
      includeSnoozedRef.current = false;
      // Daily 가 아닌 화면에서는 종을 눌렀을 때만 연다
      if (!includeSnoozed && !autoOpen) return;
      let query = supabase
        .from('pending_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (!includeSnoozed) query = query.is('snoozed_at', null);
      let { data, error } = await query;
      // snoozed_at 컬럼이 없는 DB (마이그레이션 전) → 예전처럼 전부
      if (error && /snoozed_at/.test(error.message || '')) {
        const retry = await supabase
          .from('pending_transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        data = retry.data;
      }
      if (!isMounted) return;
      setPendingQueue((data as PendingTransaction[]) ?? []);
      setPendingCount((data?.length as number) ?? 0);
    };
    load();
    return () => { isMounted = false; };
  }, [supabase, userId, pendingReloadTick, autoOpen]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase
      .channel(`pending-sms-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'pending_transactions',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        const row = payload.new as PendingTransaction;
        // 새 알림은 Daily 에서만 바로 띄운다 (다른 화면은 종 숫자로만 알림)
        if (row.status === 'pending' && autoOpenRef.current) {
          setPendingQueue((q) => [row, ...q]);
          setPendingCount((c) => c + 1);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, userId]);

  // ── 등록하기: pending → confirmed + transactions 삽입 ──
  const handleConfirmPending = useCallback(async (id: string, updates: {
    transaction_type: TransactionType;
    category: string;
    asset: string;
    memo: string;
    amount: number;
  }) => {
    if (!supabase || !userId) {
      console.error('❌ [등록] supabase 또는 userId 없음');
      alert('로그인 정보가 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    try {
      // Find item for date/account mapping
      const item = pendingQueue.find((p) => p.id === id);
      const dateIso = item?.transaction_date
        ? new Date(item.transaction_date + 'T00:00:00Z').toISOString()
        : new Date().toISOString();
      const asset = updates.asset || item?.sender || 'SMS';

      // 금액: transactions 테이블은 amount INTEGER > 0 필수
      const safeAmount = Math.max(1, Math.round(updates.amount || 0));

      // 1) pending_transactions → confirmed
      const { error: updateErr } = await supabase
        .from('pending_transactions')
        .update({
          status: 'confirmed',
          transaction_type: updates.transaction_type,
          category: updates.category,
          memo: updates.memo,
          amount: updates.amount,
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateErr) {
        console.error('❌ [등록] pending 업데이트 실패:', updateErr);
        alert(`등록 실패: ${updateErr.message}`);
        return;
      }

      // 2) transactions 테이블에 삽입
      const typeKo =
        updates.transaction_type === 'income' ? '수입' :
        updates.transaction_type === 'expense' ? '지출' : '자산이체';

      const { error: insertErr } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          date: dateIso,
          asset,
          category: updates.category || typeKo,
          sub_category: null,
          transaction_type: typeKo,
          is_transfer: updates.transaction_type === 'transfer',
          transfer_asset: null,
          amount: safeAmount,
          memo: updates.memo || null,
          currency: 'KRW',
          source: 'app',
        });

      if (insertErr) {
        console.error('❌ [등록] transactions 삽입 실패:', insertErr);
        alert(`거래 등록 실패: ${insertErr.message}`);
        return;
      }

      devLog('✅ [등록] 성공:', id);
      // 3) dequeue
      setPendingQueue((q) => q.filter((p) => p.id !== id));
      setPendingCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('❌ [등록] 예외:', err);
      alert('등록 중 오류가 발생했습니다.');
    }
  }, [supabase, userId, pendingQueue]);

  // ── 나중에: 이번에는 넘기고 보관 → 다음 건으로 (자동 팝업에서는 다시 안 뜸, 종 아이콘으로 다시 열기) ──
  // 예전에는 큐 뒤로 보내기만 해서 건이 여러 개면 팝업이 끝없이 돌았음
  const handleSkipPending = useCallback((id: string) => {
    setPendingQueue((q) => q.filter((p) => p.id !== id));
    devLog('⏭️ [나중에] 보관:', id);
    if (!supabase || !userId) return;
    supabase
      .from('pending_transactions')
      .update({ snoozed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error('❌ [나중에] 보관 실패:', error.message);
      });
  }, [supabase, userId]);

  // ── 임시저장: DB에 현재 편집 내용 저장 + 큐 뒤로 이동 ──
  const handleTempSavePending = useCallback(async (id: string, updates: {
    transaction_type: TransactionType | null;
    asset: string;
    memo: string;
    amount: number;
  }) => {
    if (!supabase || !userId) {
      console.error('❌ [임시저장] supabase 또는 userId 없음');
      alert('로그인 정보가 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('pending_transactions')
        .update({
          transaction_type: updates.transaction_type,
          memo: updates.memo,
          amount: updates.amount,
          snoozed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [임시저장] DB 업데이트 실패:', error);
        alert(`임시저장 실패: ${error.message}`);
        return;
      }

      devLog('💾 [임시저장] 성공:', id);

      // 임시저장도 "나중에"처럼 보관 → 다음 건으로 (종 아이콘으로 다시 열면 저장한 내용으로 이어서)
      setPendingQueue((q) => q.filter((p) => p.id !== id));
    } catch (err) {
      console.error('❌ [임시저장] 예외:', err);
      alert('임시저장 중 오류가 발생했습니다.');
    }
  }, [supabase, userId]);

  // ── 삭제: DB에서 dismissed 처리 → 큐에서 제거 ──
  const handleDismissPending = useCallback(async (id: string) => {
    if (!supabase || !userId) {
      console.error('❌ [삭제] supabase 또는 userId 없음');
      alert('로그인 정보가 없습니다. 새로고침 후 다시 시도해주세요.');
      return;
    }

    try {
      const { error } = await supabase
        .from('pending_transactions')
        .update({ status: 'dismissed' })
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('❌ [삭제] DB 업데이트 실패:', error);
        alert(`삭제 실패: ${error.message}`);
        return;
      }

      devLog('🗑️ [삭제] 성공:', id);
      setPendingQueue((q) => q.filter((p) => p.id !== id));
      setPendingCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error('❌ [삭제] 예외:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  }, [supabase, userId]);


  if (!currentPopup) return null;
  return (
    <PendingSmsPopup
      key={currentPopup.id}
      item={currentPopup}
      onConfirm={handleConfirmPending}
      onTempSave={handleTempSavePending}
      onSkip={handleSkipPending}
      onDismiss={handleDismissPending}
      remaining={pendingQueue.length}
    />
  );
}
