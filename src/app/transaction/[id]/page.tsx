import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../../lib/supabase_ssr';
import { TransactionForm } from '../TransactionForm';

export default async function TransactionDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const userId = auth.user.id;

  const [{ data: assets }, { data: categories }, { data: tx, error: txErr }] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, currency')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('categories')
      .select('id, type, name, parent_id')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, occurred_at, type, asset_id, category_id, amount, currency, description, memo, transfer_pair_id')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (txErr || !tx) redirect('/ledger');

  // If transfer, load pair to determine to_asset_id
  let toAssetId: string | null = null;
  if ((tx.type === 'transfer_out' || tx.type === 'transfer_in') && tx.transfer_pair_id) {
    const { data: pairRows } = await supabase
      .from('transactions')
      .select('id, type, asset_id')
      .eq('user_id', userId)
      .eq('transfer_pair_id', tx.transfer_pair_id)
      .is('deleted_at', null);

    const out = (pairRows || []).find((r: any) => r.type === 'transfer_out');
    const inn = (pairRows || []).find((r: any) => r.type === 'transfer_in');
    if (tx.type === 'transfer_out') toAssetId = inn?.asset_id || null;
    if (tx.type === 'transfer_in') toAssetId = out?.asset_id || null;
  }

  return (
    <TransactionForm
      mode="edit"
      assets={(assets || []) as any}
      categories={(categories || []) as any}
      initial={{
        id: tx.id,
        occurred_at: tx.occurred_at,
        type: tx.type,
        asset_id: tx.asset_id,
        category_id: tx.category_id,
        amount: tx.amount,
        description: tx.description || '',
        memo: tx.memo || '',
        transfer_pair_id: tx.transfer_pair_id,
        to_asset_id: toAssetId,
      }}
    />
  );
}


