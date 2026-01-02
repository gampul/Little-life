'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase_ssr';

type TxType = 'income' | 'expense' | 'transfer_out' | 'transfer_in';

function parseOccurredAt(raw: string): string {
  const v = raw.trim();
  if (!v) throw new Error('occurred_at is required');
  // datetime-local => no timezone. Assume Asia/Seoul for MVP.
  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(v);
  if (hasTz) return new Date(v).toISOString();
  // "YYYY-MM-DDTHH:mm" or "YYYY-MM-DDTHH:mm:ss"
  const withSeconds = v.length === 16 ? `${v}:00` : v;
  return new Date(`${withSeconds}+09:00`).toISOString();
}

function monthParamFromIso(iso: string): string {
  // iso in UTC; convert to Asia/Seoul for month navigation
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' });
  const parts = fmt.formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  return `${y}-${m}`;
}

async function requireUser() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return { supabase, userId: data.user.id };
}

async function getAssetCurrency(supabase: any, userId: string, assetId: string) {
  const { data, error } = await supabase
    .from('assets')
    .select('id, currency')
    .eq('id', assetId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) throw new Error('Invalid asset');
  return String(data.currency || 'KRW');
}

export type TxActionState = { error?: string };

export async function createTransactionAction(_prev: TxActionState, formData: FormData): Promise<TxActionState> {
  try {
    const { supabase, userId } = await requireUser();

    const occurredAtIso = parseOccurredAt(String(formData.get('occurred_at') || ''));
    const type = String(formData.get('type') || '') as TxType;
    const assetId = String(formData.get('asset_id') || '');
    const categoryIdRaw = String(formData.get('category_id') || '').trim();
    const amount = Number(formData.get('amount') || 0);
    const description = String(formData.get('description') || '').trim();
    const memo = String(formData.get('memo') || '').trim();

    if (!assetId) return { error: '자산을 선택해주세요.' };
    if (!type) return { error: '거래 타입을 선택해주세요.' };
    if (!Number.isFinite(amount) || amount <= 0) return { error: '금액을 올바르게 입력해주세요.' };
    if (!description) return { error: '내용(description)을 입력해주세요.' };

    const currency = await getAssetCurrency(supabase, userId, assetId);

    if (type === 'transfer_out') {
      const toAssetId = String(formData.get('to_asset_id') || '');
      if (!toAssetId) return { error: '대상 자산을 선택해주세요.' };
      if (toAssetId === assetId) return { error: '이체 대상 자산은 출금 자산과 달라야 합니다.' };

      const toCurrency = await getAssetCurrency(supabase, userId, toAssetId);
      if (toCurrency !== currency) return { error: '이체 자산의 통화(currency)가 다릅니다. (MVP에서는 동일 통화만 지원)' };

      const transferPairId = crypto.randomUUID();
      const payload = [
        {
          user_id: userId,
          occurred_at: occurredAtIso,
          type: 'transfer_out',
          asset_id: assetId,
          category_id: null,
          amount,
          currency,
          description,
          memo,
          transfer_pair_id: transferPairId,
        },
        {
          user_id: userId,
          occurred_at: occurredAtIso,
          type: 'transfer_in',
          asset_id: toAssetId,
          category_id: null,
          amount,
          currency,
          description,
          memo,
          transfer_pair_id: transferPairId,
        },
      ];

      const { error } = await supabase.from('transactions').insert(payload);
      if (error) return { error: error.message };
    } else {
      // income / expense (transfer_in is not allowed in UI for create)
      const categoryId = categoryIdRaw ? categoryIdRaw : null;
      if (!categoryId) return { error: '카테고리를 선택해주세요.' };

      const { error } = await supabase.from('transactions').insert([
        {
          user_id: userId,
          occurred_at: occurredAtIso,
          type,
          asset_id: assetId,
          category_id: categoryId,
          amount,
          currency,
          description,
          memo,
          transfer_pair_id: null,
        },
      ]);
      if (error) return { error: error.message };
    }

    revalidatePath('/ledger');
    redirect(`/ledger?m=${monthParamFromIso(occurredAtIso)}`);
  } catch (e: any) {
    return { error: e?.message || '생성 중 오류가 발생했습니다.' };
  }
}

export async function updateTransactionAction(_prev: TxActionState, formData: FormData): Promise<TxActionState> {
  try {
    const { supabase, userId } = await requireUser();

    const id = String(formData.get('id') || '');
    if (!id) return { error: 'id가 없습니다.' };

    const occurredAtIso = parseOccurredAt(String(formData.get('occurred_at') || ''));
    const amount = Number(formData.get('amount') || 0);
    const description = String(formData.get('description') || '').trim();
    const memo = String(formData.get('memo') || '').trim();

    if (!Number.isFinite(amount) || amount <= 0) return { error: '금액을 올바르게 입력해주세요.' };
    if (!description) return { error: '내용(description)을 입력해주세요.' };

    // Load current tx to decide transfer vs normal
    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .select('id, type, asset_id, category_id, transfer_pair_id')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (txErr || !tx) return { error: '거래를 찾을 수 없습니다.' };

    const txType = tx.type as TxType;

    if (txType === 'transfer_out' || txType === 'transfer_in') {
      const pairId = tx.transfer_pair_id as string;
      if (!pairId) return { error: '이체 pair를 찾을 수 없습니다.' };

      const fromAssetId = String(formData.get('asset_id') || '');
      const toAssetId = String(formData.get('to_asset_id') || '');
      if (!fromAssetId || !toAssetId) return { error: '이체 자산을 선택해주세요.' };
      if (fromAssetId === toAssetId) return { error: '이체 대상 자산은 출금 자산과 달라야 합니다.' };

      const currency = await getAssetCurrency(supabase, userId, fromAssetId);
      const toCurrency = await getAssetCurrency(supabase, userId, toAssetId);
      if (toCurrency !== currency) return { error: '이체 자산의 통화(currency)가 다릅니다. (MVP에서는 동일 통화만 지원)' };

      // Update both rows
      const { error: outErr } = await supabase
        .from('transactions')
        .update({
          occurred_at: occurredAtIso,
          asset_id: fromAssetId,
          amount,
          currency,
          description,
          memo,
          category_id: null,
        })
        .eq('user_id', userId)
        .eq('transfer_pair_id', pairId)
        .eq('type', 'transfer_out')
        .is('deleted_at', null);
      if (outErr) return { error: outErr.message };

      const { error: inErr } = await supabase
        .from('transactions')
        .update({
          occurred_at: occurredAtIso,
          asset_id: toAssetId,
          amount,
          currency,
          description,
          memo,
          category_id: null,
        })
        .eq('user_id', userId)
        .eq('transfer_pair_id', pairId)
        .eq('type', 'transfer_in')
        .is('deleted_at', null);
      if (inErr) return { error: inErr.message };
    } else {
      const type = String(formData.get('type') || txType) as TxType;
      const assetId = String(formData.get('asset_id') || '');
      const categoryIdRaw = String(formData.get('category_id') || '').trim();
      const categoryId = categoryIdRaw ? categoryIdRaw : null;

      if (!assetId) return { error: '자산을 선택해주세요.' };
      if (!type) return { error: '거래 타입을 선택해주세요.' };
      if (type !== 'income' && type !== 'expense') return { error: '수정에서는 수입/지출만 지원합니다.' };
      if (!categoryId) return { error: '카테고리를 선택해주세요.' };

      const currency = await getAssetCurrency(supabase, userId, assetId);

      const { error } = await supabase
        .from('transactions')
        .update({
          occurred_at: occurredAtIso,
          type,
          asset_id: assetId,
          category_id: categoryId,
          amount,
          currency,
          description,
          memo,
          transfer_pair_id: null,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) return { error: error.message };
    }

    revalidatePath('/ledger');
    redirect(`/ledger?m=${monthParamFromIso(occurredAtIso)}`);
  } catch (e: any) {
    return { error: e?.message || '수정 중 오류가 발생했습니다.' };
  }
}

export async function softDeleteTransactionAction(_prev: TxActionState, formData: FormData): Promise<TxActionState> {
  try {
    const { supabase, userId } = await requireUser();

    const id = String(formData.get('id') || '');
    if (!id) return { error: 'id가 없습니다.' };

    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .select('id, type, transfer_pair_id, occurred_at')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (txErr || !tx) return { error: '거래를 찾을 수 없습니다.' };

    const nowIso = new Date().toISOString();
    const txType = tx.type as TxType;
    const pairId = tx.transfer_pair_id as string | null;

    if ((txType === 'transfer_out' || txType === 'transfer_in') && pairId) {
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: nowIso })
        .eq('user_id', userId)
        .eq('transfer_pair_id', pairId)
        .is('deleted_at', null);
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from('transactions')
        .update({ deleted_at: nowIso })
        .eq('id', id)
        .eq('user_id', userId)
        .is('deleted_at', null);
      if (error) return { error: error.message };
    }

    revalidatePath('/ledger');
    redirect(`/ledger?m=${monthParamFromIso(String(tx.occurred_at))}`);
  } catch (e: any) {
    return { error: e?.message || '삭제 중 오류가 발생했습니다.' };
  }
}

// For <form action={...}> without useActionState
export async function softDeleteTransactionDirectAction(formData: FormData): Promise<void> {
  await softDeleteTransactionAction({}, formData);
}


