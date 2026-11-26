// 가계부 대기 건 푸시 — 카드 결제·배당 알림이 대기 목록(pending_transactions)에 들어오면 휴대폰으로 알려준다.
//
// 호출 방식 (verify_jwt=false, 아래에서 직접 인증)
//   pending_transactions INSERT 트리거 → public.notify_pending_transaction() → 헤더 x-cron-secret
//   body { id: <pending_transactions.id> }
//
// 루틴 알림(routine-reminder)과 같은 구독(push_subscriptions)·VAPID 키를 쓴다.
// 비밀값은 Vault 에 있고 get_push_config() (service_role 전용)로 읽는다.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface Subscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: cfgRows, error: cfgErr } = await admin.rpc('get_push_config');
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : cfgRows;
  if (cfgErr || !cfg?.vapid_private || !cfg?.vapid_public) {
    console.error('push config missing', cfgErr?.message);
    return json({ error: 'push config missing' }, 500);
  }

  const secret = req.headers.get('x-cron-secret');
  if (!secret) return json({ error: 'unauthorized' }, 401);
  if (!cfg.cron_secret || secret !== cfg.cron_secret) return json({ error: 'forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json({ error: 'id required' }, 400);

  const { data: row } = await admin
    .from('pending_transactions')
    .select('id, user_id, status, amount, sender, item_name, transaction_type, parsed_data')
    .eq('id', id)
    .maybeSingle();
  if (!row) return json({ sent: 0, note: 'not found' });
  if (row.status !== 'pending' || !row.amount) return json({ sent: 0, note: 'not pending' });

  const { data: subs, error: subErr } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, failure_count')
    .eq('user_id', row.user_id);
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs || subs.length === 0) return json({ sent: 0, note: 'no subscriptions' });

  webpush.setVapidDetails(cfg.vapid_subject || 'https://little-life.vercel.app', cfg.vapid_public, cfg.vapid_private);

  const isDividend = (row.parsed_data as { kind?: string } | null)?.kind === 'dividend';
  const kind = isDividend ? '배당금 입금' : row.transaction_type === 'income' ? '입금' : '결제';
  const won = `${Number(row.amount).toLocaleString('ko-KR')}원`;
  const detail = [row.sender, row.item_name].filter(Boolean).join(' · ');
  const payload = JSON.stringify({
    title: `💳 ${kind} ${won}`,
    body: `${detail ? detail + ' — ' : ''}눌러서 가계부에 등록하세요`,
    url: '/daily',
    tag: `pending-${row.id}`,
  });

  let sent = 0;
  let removed = 0;
  for (const s of subs as Subscription[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 60 * 60 * 12,
        urgency: 'normal',
      });
      sent++;
      await admin.from('push_subscriptions').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', s.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410: 기기에서 알림을 끄거나 앱을 지움 → 구독 삭제
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', s.id);
        removed++;
      } else {
        await admin.from('push_subscriptions').update({ failure_count: (s.failure_count ?? 0) + 1 }).eq('id', s.id);
        console.error('push failed', status, (err as Error).message);
      }
    }
  }
  return json({ sent, removed, devices: subs.length });
});
