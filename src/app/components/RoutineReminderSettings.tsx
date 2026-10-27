'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';

/** VAPID 공개키 (공개값 — 비밀키는 Supabase Vault 에만 있음) */
const VAPID_PUBLIC_KEY = 'BM-wAoBTZpQ2XbnvdHM7n3S9CkFOknjlj1Gc4Y4pJssVyLRDvI1royToNhu4QEoNGrjg_VacdT886J8pIjythz8';

type Status = 'loading' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

const urlBase64ToUint8Array = (base64: string) => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** 설정 > 루틴 알림: 이 기기에서 오늘 안 한 루틴 푸시(13:00·22:00) 켜기/끄기 */
export default function RoutineReminderSettings() {
  const supabase = getSupabase();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      setStatus(isIos() && !isStandalone() ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub && Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  useEffect(() => {
    refresh().catch(() => setStatus('off'));
  }, [refresh]);

  const flash = (msg: string, ms = 5000) => {
    setNote(msg);
    if (ms) setTimeout(() => setNote(''), ms);
  };

  const enable = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'off');
        flash('알림 권한이 허용되지 않았어요.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }));
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('구독 정보를 만들지 못했어요.');

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('로그인이 필요해요.');
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: auth.user.id,
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent.slice(0, 300),
          failure_count: 0,
        },
        { onConflict: 'endpoint' }
      );
      if (error) throw error;
      setStatus('on');
      flash('✅ 이 기기에서 루틴 알림을 받아요. [테스트 알림]으로 확인해 보세요.');
    } catch (err) {
      flash(`❌ 알림 켜기 실패: ${(err as Error).message}`, 8000);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus('off');
      flash('이 기기의 루틴 알림을 껐어요.');
    } catch (err) {
      flash(`❌ 알림 끄기 실패: ${(err as Error).message}`, 8000);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('routine-reminder', { body: { test: true } });
      if (error) throw error;
      if (!data?.sent) flash('⚠️ 보낼 기기가 없어요. 알림을 껐다가 다시 켜 주세요.', 8000);
      else flash('🔔 테스트 알림을 보냈어요. 몇 초 안에 도착해요.');
    } catch (err) {
      flash(`❌ 테스트 실패: ${(err as Error).message}`, 8000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white whitespace-nowrap">루틴 알림</h3>
        {status === 'on' ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={sendTest}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              테스트 알림
            </button>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              끄기
            </button>
          </div>
        ) : status === 'off' ? (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? '켜는 중…' : '알림 켜기'}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        매일 <b>오후 1시</b>와 <b>밤 10시</b>에 오늘 아직 안 한 루틴이 있으면 이 기기로 알려 드려요. 모두 했으면 알림이 오지 않아요.
      </p>
      {status === 'on' && <p className="mt-1 text-xs text-green-600 dark:text-green-400">● 이 기기에서 알림을 받고 있어요</p>}
      {status === 'denied' && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          브라우저에서 알림이 차단돼 있어요. 주소창 왼쪽 자물쇠(사이트 설정) → 알림 → 허용으로 바꾼 뒤 새로고침해 주세요.
        </p>
      )}
      {status === 'ios-install' && (
        <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
          아이폰은 Safari 공유 버튼 → [홈 화면에 추가]로 설치한 앱에서 알림을 켤 수 있어요.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">이 브라우저는 푸시 알림을 지원하지 않아요.</p>
      )}
      {note && <p className="mt-1 text-xs text-gray-700 dark:text-gray-200">{note}</p>}
    </div>
  );
}
