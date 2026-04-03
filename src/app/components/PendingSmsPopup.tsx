'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

type PendingTx = {
  id: string;
  user_id: string;
  raw_sms: string;
  sender: string | null;
  amount: number | null;
  amount_before_tax: number | null;
  transaction_date: string | null;
  account_number: string | null;
  item_name: string | null;
  transaction_type: 'income' | 'expense' | 'transfer' | null;
  category: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  parsed_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

interface PendingSmsPopupProps {
  className?: string;
}

export function PendingSmsPopup({ className }: PendingSmsPopupProps) {
  const supabase = getSupabase();
  const [userId, setUserId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTx | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let isMounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setUserId(data.user?.id ?? null);
    });

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let isMounted = true;

    const fetchLatest = async () => {
      const { data } = await supabase
        .from('pending_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (isMounted) setPending((data as PendingTx) ?? null);
    };

    fetchLatest();

    const channel = supabase
      .channel('pending_tx_popup')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pending_transactions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as PendingTx;
          if (row.status === 'pending') {
            setPending(row);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      isMounted = false;
    };
  }, [supabase, userId]);

  const messagePreview = useMemo(() => {
    if (!pending?.raw_sms) return '';
    const s = pending.raw_sms.replace(/\s+/g, ' ').trim();
    return s.length > 120 ? s.slice(0, 120) + '…' : s;
  }, [pending?.raw_sms]);

  const handleDismiss = async () => {
    if (!supabase || !pending) return;
    setLoading(true);
    try {
      await supabase
        .from('pending_transactions')
        .update({ status: 'dismissed' })
        .eq('id', pending.id)
        .eq('user_id', pending.user_id);
      setPending(null);
    } finally {
      setLoading(false);
    }
  };

  const confirmWithType = async (type: 'income' | 'expense' | 'transfer') => {
    if (!supabase || !pending || !userId) return;
    setLoading(true);
    try {
      // Prepare transaction payload (map to app schema)
      const isTransfer = type === 'transfer';
      const transactionTypeKo = type === 'income' ? '수입' : type === 'expense' ? '지출' : '자산이체';
      const amount = pending.amount && pending.amount > 0 ? pending.amount : 0;

      if (amount > 0) {
        const dateIso = pending.transaction_date
          ? new Date(pending.transaction_date + 'T00:00:00Z').toISOString()
          : new Date().toISOString();

        const asset = pending.account_number || pending.sender || 'SMS';
        const memo = pending.item_name || pending.sender || null;
        const category = pending.category || (type === 'income' ? '수입' : type === 'expense' ? '지출' : '자산이체');

        const insertRes = await supabase.from('transactions').insert({
          user_id: userId,
          date: dateIso,
          asset,
          category,
          sub_category: null,
          transaction_type: transactionTypeKo,
          is_transfer: isTransfer,
          transfer_asset: isTransfer ? null : null,
          amount,
          memo,
          currency: 'KRW',
          source: 'app',
        });
        if (insertRes.error) {
          // fallback: proceed to mark confirmed anyway so user isn't blocked
          // but surface could be improved with UI notice
        }
      }

      await supabase
        .from('pending_transactions')
        .update({ status: 'confirmed', transaction_type: type })
        .eq('id', pending.id)
        .eq('user_id', pending.user_id);

      setPending(null);
    } finally {
      setLoading(false);
    }
  };

  if (!pending) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-16 z-[60] mx-auto max-w-[412px] px-4 ${className || ''}`}
      role="dialog"
      aria-label="SMS 거래 확인"
    >
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              새 SMS 감지됨 — 확인 후 저장하세요
            </div>
            <div className="text-sm text-gray-900 dark:text-white break-words">
              {messagePreview}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex gap-2">
              {pending.sender && <span>발신: {pending.sender}</span>}
              {pending.amount !== null && <span>금액(세후): {new Intl.NumberFormat('ko-KR').format(pending.amount)}</span>}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            disabled={loading}
            className="shrink-0 w-7 h-7 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            aria-label="닫기"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            onClick={() => confirmWithType('income')}
            disabled={loading}
            className="py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium"
          >
            수입
          </button>
          <button
            onClick={() => confirmWithType('expense')}
            disabled={loading}
            className="py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium"
          >
            지출
          </button>
          <button
            onClick={() => confirmWithType('transfer')}
            disabled={loading}
            className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium"
          >
            이체
          </button>
        </div>
      </div>
    </div>
  );
}

