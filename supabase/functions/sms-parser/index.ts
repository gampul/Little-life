// sms-parser — 사용 중지 (2026-10-27)
// 요청 헤더의 x-user-id 를 그대로 믿고 service_role 로 저장하던 구조라,
// 공개 anon 키만 있으면 누구나 다른 사용자의 대기 목록에 항목을 넣을 수 있었다.
// → 개인 토큰(x-ingest-token)으로 인증하는 card-ingest 로 대체. 파싱 로직은 card-ingest/index.ts 에 있음.
const body = JSON.stringify({
  error: 'sms-parser 는 더 이상 쓰지 않습니다. /functions/v1/card-ingest 와 x-ingest-token 헤더를 사용하세요 (설정 > 카드 알림 연동).',
});

Deno.serve(() => new Response(body, { status: 410, headers: { 'Content-Type': 'application/json; charset=utf-8' } }));
