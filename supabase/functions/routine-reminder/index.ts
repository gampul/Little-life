// 루틴 푸시 알림 — 오늘(KST) 안 한 루틴을 휴대폰으로 알려준다.
//
// 호출 방식 (verify_jwt=false, 아래에서 직접 인증)
//  1) 예약 실행: pg_cron → public.trigger_routine_reminder(slot) → 헤더 x-cron-secret
//     body { slot: 'afternoon' | 'night' } — 구독한 모든 사용자에게, 안 한 루틴이 있을 때만
//  2) 테스트: 앱 설정 화면에서 로그인 토큰(Authorization: Bearer) + body { test: true }
//     — 그 사용자 기기로만, 안 한 루틴이 없어도 테스트 알림을 보냄
//
// 비밀값(VAPID 키, cron 비밀값)은 Vault 에 있고 get_push_config() (service_role 전용)로 읽는다.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type Slot = 'afternoon' | 'night';

interface Routine {
  id: string;
  label: string;
  type: string | null;
  sort_order: number | null;
}

interface CheckRow {
  routine_id: string;
  checked: boolean;
  value: number | null;
  memo: string | null;
  image_url: string | null;
  image_urls: unknown;
}

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failure_count: number;
}

// 앱(브라우저)에서 테스트 알림을 부를 때 필요한 CORS
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/** 오늘 날짜 (KST, YYYY-MM-DD) */
const kstToday = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/** 앱(DailyLogFeed)과 같은 기준: 체크했으면 완료, 단 숫자형은 값 0/없음 + 메모·사진 없음이면 미완료 */
const isDone = (routine: Routine, row: CheckRow | undefined): boolean => {
  if (!row || !row.checked) return false;
  if (routine.type === 'number') {
    const images = Array.isArray(row.image_urls) ? row.image_urls.filter(Boolean) : [];
    const empty = (row.value == null || Number(row.value) === 0) && !row.memo?.trim() && !row.image_url && images.length === 0;
    if (empty) return false;
  }
  return true;
};

const buildMessage = (slot: Slot | 'test', missing: string[]) => {
  const list = missing.slice(0, 5).join(' · ') + (missing.length > 5 ? ` 외 ${missing.length - 5}개` : '');
  if (slot === 'test') {
    return missing.length > 0
      ? { title: '🔔 테스트 알림', body: `알림이 잘 와요! 지금 기준 안 한 루틴 ${missing.length}개: ${list}` }
      : { title: '🔔 테스트 알림', body: '알림이 잘 와요! 오늘 루틴은 모두 완료했어요 👏' };
  }
  if (slot === 'afternoon') {
    return { title: `오늘 아직 안 한 루틴 ${missing.length}개`, body: `${list} — 오후에 하나씩 챙겨 봐요` };
  }
  return { title: `오늘 남은 루틴 ${missing.length}개`, body: `${list} — 자기 전에 마무리해 볼까요?` };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: cfgRows, error: cfgErr } = await admin.rpc('get_push_config');
  const cfg = Array.isArray(cfgRows) ? cfgRows[0] : cfgRows;
  if (cfgErr || !cfg?.vapid_private || !cfg?.vapid_public) {
    console.error('push config missing', cfgErr?.message);
    return json({ error: 'push config missing' }, 500);
  }

  const body = await req.json().catch(() => ({}));

  // --- 인증: cron 비밀값 또는 로그인 사용자(테스트) ---
  let slot: Slot | 'test';
  let onlyUserId: string | null = null;
  const cronSecret = req.headers.get('x-cron-secret');
  if (cronSecret) {
    if (!cfg.cron_secret || cronSecret !== cfg.cron_secret) return json({ error: 'forbidden' }, 403);
    slot = body?.slot === 'afternoon' ? 'afternoon' : 'night';
  } else {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!userData?.user || body?.test !== true) return json({ error: 'unauthorized' }, 401);
    slot = 'test';
    onlyUserId = userData.user.id;
  }

  webpush.setVapidDetails(cfg.vapid_subject || 'https://little-life.vercel.app', cfg.vapid_public, cfg.vapid_private);

  // --- 구독 목록 ---
  let subQuery = admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth, failure_count');
  if (onlyUserId) subQuery = subQuery.eq('user_id', onlyUserId);
  const { data: subs, error: subErr } = await subQuery;
  if (subErr) return json({ error: subErr.message }, 500);
  if (!subs || subs.length === 0) return json({ slot, users: 0, sent: 0, note: 'no subscriptions' });

  const byUser = new Map<string, Subscription[]>();
  for (const s of subs as Subscription[]) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  const today = kstToday();
  let sent = 0;
  let skipped = 0;
  let removed = 0;
  const results: Record<string, unknown>[] = [];

  for (const [userId, userSubs] of byUser) {
    // routine_templates.user_id 는 text 타입
    const [{ data: routines }, { data: checks }] = await Promise.all([
      admin
        .from('routine_templates')
        .select('id, label, type, sort_order')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true }),
      admin
        .from('daily_routine_checks')
        .select('routine_id, checked, value, memo, image_url, image_urls')
        .eq('user_id', userId)
        .eq('date', today),
    ]);

    const rowByRoutine = new Map<string, CheckRow>();
    for (const c of (checks ?? []) as CheckRow[]) {
      const prev = rowByRoutine.get(c.routine_id);
      if (!prev || (c.checked && !prev.checked)) rowByRoutine.set(c.routine_id, c);
    }
    const missing = ((routines ?? []) as Routine[])
      .filter((r) => !isDone(r, rowByRoutine.get(r.id)))
      .map((r) => r.label);

    if (slot !== 'test' && missing.length === 0) {
      skipped++;
      results.push({ userId, missing: 0 });
      continue;
    }

    const msg = buildMessage(slot, missing);
    const payload = JSON.stringify({ ...msg, url: '/daily', tag: 'routine-reminder' });

    for (const s of userSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 3, urgency: 'normal' }
        );
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
    results.push({ userId, missing: missing.length, devices: userSubs.length });
  }

  return json({ slot, date: today, users: byUser.size, sent, skipped, removed, results: slot === 'test' ? results : undefined });
});
