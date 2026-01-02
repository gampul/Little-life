import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase_ssr';
import { LoginForm } from './LoginForm';
import { GlobalNav } from '../components/GlobalNav';

export default async function LoginPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/ledger');

  return (
    <div className="min-h-screen bg-[rgb(254,252,247)] dark:bg-gray-900">
      <GlobalNav />
      <div className="flex items-center justify-center p-6">
        <LoginForm />
      </div>
    </div>
  );
}


