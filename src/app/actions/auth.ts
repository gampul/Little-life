'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServer } from '../../lib/supabase_ssr';
import { authErrorMessage, checkPassword, PASSWORD_HINT } from '../../lib/passwordPolicy';

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
  if (error) return { error: authErrorMessage(error) };

  redirect('/ledger');
}

export async function signUpWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');

  if (!email || !password) return { error: '이메일과 비밀번호를 입력해주세요.' };
  const missing = checkPassword(password);
  if (missing.length > 0) return { error: `비밀번호에 ${missing.join(', ')} 조건이 필요합니다. (${PASSWORD_HINT})` };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: authErrorMessage(error) };

  // If email confirmation is off, session exists immediately; otherwise user must confirm email.
  redirect('/ledger');
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect('/login');
}


