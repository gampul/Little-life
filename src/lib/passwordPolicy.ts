/**
 * 비밀번호 정책 — Supabase 대시보드(Authentication > Email)의 설정과 맞춘다.
 *  - Minimum password length: 10
 *  - Password requirements: 숫자 + 소문자 + 대문자 + 특수문자
 * 대시보드 값을 바꾸면 여기도 같이 바꿀 것 (서버가 최종 판단, 여기는 먼저 친절하게 안내하는 용도)
 */
export const PASSWORD_MIN_LENGTH = 10;

/** Supabase 가 허용하는 특수문자 */
const SYMBOLS = `!@#$%^&*()_+-=[]{};'\\:"|<>?,./\`~`;

export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH}자 이상, 대문자·소문자·숫자·특수문자 각 1개 이상`;

/** 정책에 맞지 않는 항목들을 한국어로 돌려준다 (맞으면 빈 배열) */
export function checkPassword(password: string): string[] {
  const problems: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push(`${PASSWORD_MIN_LENGTH}자 이상`);
  if (!/[a-z]/.test(password)) problems.push('소문자');
  if (!/[A-Z]/.test(password)) problems.push('대문자');
  if (!/[0-9]/.test(password)) problems.push('숫자');
  if (![...password].some((ch) => SYMBOLS.includes(ch))) problems.push('특수문자');
  return problems;
}

type AuthErrorLike = { message?: string; code?: string; reasons?: string[] } | null | undefined;

/** Supabase Auth 오류를 사용자에게 보여줄 한국어 문구로 */
export function authErrorMessage(error: AuthErrorLike): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.';
  const code = error.code ?? '';
  const msg = error.message ?? '';

  if (code === 'weak_password' || /weak password|password should/i.test(msg)) {
    const reasons = error.reasons ?? [];
    if (reasons.includes('pwned')) {
      return '유출된 적이 있는 비밀번호라 사용할 수 없습니다. 다른 비밀번호를 정해 주세요.';
    }
    return `비밀번호가 너무 약합니다. (${PASSWORD_HINT})`;
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) {
    return '이메일 또는 비밀번호가 맞지 않습니다.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) {
    return '이메일 인증이 아직 완료되지 않았습니다. 받은 편지함의 인증 메일을 확인해 주세요.';
  }
  if (code === 'user_already_exists' || /already registered/i.test(msg)) {
    return '이미 가입된 이메일입니다. 로그인해 주세요.';
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || /rate limit/i.test(msg)) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  return msg || '알 수 없는 오류가 발생했습니다.';
}
