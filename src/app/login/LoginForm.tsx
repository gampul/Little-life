'use client';

import { useActionState, useEffect } from 'react';
import { signInWithPasswordAction, signUpWithPasswordAction, type AuthActionState } from '../actions/auth';
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH } from '../../lib/passwordPolicy';
import { clearTabLogin, markTabLoggedIn } from '../../lib/sessionPolicy';

const initialState: AuthActionState = {};

export function LoginForm() {
  const [signInState, signInAction, signInPending] = useActionState(signInWithPasswordAction, initialState);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpWithPasswordAction, initialState);

  // 로그인/가입에 실패하면 '이 탭에서 로그인함' 표식을 되돌린다
  useEffect(() => {
    if (signInState?.error || signUpState?.error) clearTabLogin();
  }, [signInState, signUpState]);

  return (
    <div className="w-full max-w-sm space-y-4">
      <form action={signInAction} onSubmit={markTabLoggedIn} className="space-y-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">로그인</h1>
        <input
          name="email"
          type="email"
          required
          placeholder="email@example.com"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="비밀번호"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        {signInState?.error && <p className="text-sm text-red-600">{signInState.error}</p>}
        <button
          type="submit"
          disabled={signInPending}
          className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
        >
          {signInPending ? '로그인 중...' : '로그인'}
        </button>
      </form>

      <div className="h-px bg-gray-200 dark:bg-gray-700" />

      <form action={signUpAction} onSubmit={markTabLoggedIn} className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">회원가입</h2>
        <input
          name="email"
          type="email"
          required
          placeholder="email@example.com"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <input
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          placeholder={`비밀번호(${PASSWORD_MIN_LENGTH}자 이상)`}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">{PASSWORD_HINT}</p>
        {signUpState?.error && <p className="text-sm text-red-600">{signUpState.error}</p>}
        <button
          type="submit"
          disabled={signUpPending}
          className="w-full py-2 rounded-lg bg-gray-900 hover:bg-black text-white font-medium disabled:opacity-50"
        >
          {signUpPending ? '가입 중...' : '회원가입'}
        </button>
      </form>
    </div>
  );
}


