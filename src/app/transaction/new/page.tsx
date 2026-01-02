import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../../lib/supabase_ssr';
import { TransactionForm } from '../TransactionForm';

export default async function NewTransactionPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  const userId = data.user.id;

  const [{ data: assets }, { data: categories }] = await Promise.all([
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
  ]);

  const nowIso = new Date().toISOString();

  return (
    <TransactionForm
      mode="create"
      assets={(assets || []) as any}
      categories={(categories || []) as any}
      initial={{
        occurred_at: nowIso,
        type: 'expense',
        asset_id: (assets?.[0]?.id as string) || '',
        category_id: null,
        amount: 0,
        description: '',
        memo: '',
        to_asset_id: null,
      }}
    />
  );
}


