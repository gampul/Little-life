'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase_ssr';

export type AuthActionState = { error?: string };

export async function signInWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) return { error: '이메일과 비밀번호를 입력해주세요.' };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect('/ledger');
}

export async function signUpWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) return { error: '이메일과 비밀번호를 입력해주세요.' };
  if (password.length < 6) return { error: '비밀번호는 6자 이상이어야 합니다.' };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // If email confirmation is off, session exists immediately; otherwise user must confirm email.
  redirect('/ledger');
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}


