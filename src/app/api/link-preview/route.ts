import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createSupabaseServer } from '../../../lib/supabase_ssr';

/**
 * 링크 북마크 카드용 미리보기 — GET /api/link-preview?url=https://...
 * 응답: { url, title, description, image, site }
 *
 * 보안: 로그인 사용자만, http(s)·기본 포트만, 사설/루프백 IP 차단(리다이렉트마다 재검사),
 *       5초 타임아웃, 본문은 앞부분 512KB 만 읽음.
 */
export const runtime = 'nodejs';
export const maxDuration = 15;

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 4;
const UA =
  'Mozilla/5.0 (compatible; LittleLifeBot/1.0; +https://little-life.vercel.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

type Preview = { url: string; title: string | null; description: string | null; image: string | null; site: string | null };

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')) return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('올바른 URL 이 아닙니다');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('http(s) 링크만 가능합니다');
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('허용되지 않는 포트입니다');
  if (u.username || u.password) throw new Error('허용되지 않는 URL 입니다');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error('허용되지 않는 주소입니다');
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error('허용되지 않는 주소입니다');
  return u;
}

async function readLimited(res: Response): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    total += value.byteLength;
  }
  reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, out.length - off));
    out.set(part, off);
    off += part.byteLength;
    if (off >= out.length) break;
  }
  return out;
}

/** content-type 헤더 → <meta charset> 순으로 인코딩 판단 (EUC-KR 사이트 대응) */
function decodeHtml(bytes: Uint8Array, contentType: string): string {
  let charset = contentType.match(/charset=([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z#0-9]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function clean(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = decodeEntities(s).replace(/\s+/g, ' ').trim();
  return t ? (t.length > max ? `${t.slice(0, max - 1)}…` : t) : null;
}

function parseMeta(html: string, pageUrl: URL): Omit<Preview, 'url'> {
  const head = html.slice(0, 200_000);
  const metas: Record<string, string> = {};
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const content = tag.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1] ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i)?.[1];
    if (key && content != null && !(key in metas)) metas[key] = content;
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const title = clean(metas['og:title'] || metas['twitter:title'] || titleTag, 200);
  const description = clean(metas['og:description'] || metas['twitter:description'] || metas['description'], 300);
  const site = clean(metas['og:site_name'], 80) || pageUrl.hostname.replace(/^www\./, '');

  let image: string | null = null;
  const rawImage = metas['og:image:secure_url'] || metas['og:image'] || metas['twitter:image'] || metas['twitter:image:src'] || metas['image'];
  if (rawImage) {
    try {
      const abs = new URL(decodeEntities(rawImage.trim()), pageUrl);
      if (abs.protocol === 'https:' || abs.protocol === 'http:') image = abs.toString();
    } catch {
      /* 무시 */
    }
  }
  return { title, description, image, site };
}

async function youtubeOEmbed(url: string, signal: AbortSignal): Promise<Partial<Omit<Preview, 'url'>>> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal });
    if (!r.ok) return {};
    const j = (await r.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return {
      title: clean(j.title, 200),
      description: clean(j.author_name, 300),
      image: j.thumbnail_url && /^https:\/\//.test(j.thumbnail_url) ? j.thumbnail_url : null,
      site: 'YouTube',
    };
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  const raw = req.nextUrl.searchParams.get('url')?.trim() || '';
  if (!raw || raw.length > 2000) return NextResponse.json({ error: 'url 이 필요합니다' }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let current = await assertPublicUrl(raw);
    let res: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'ko,en;q=0.8' },
      });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) {
        current = await assertPublicUrl(new URL(loc, current).toString());
        continue;
      }
      break;
    }
    if (!res || !res.ok) throw new Error(`페이지를 불러오지 못했습니다 (${res?.status ?? '응답 없음'})`);

    const ct = res.headers.get('content-type') || '';
    const base: Preview = { url: raw, title: null, description: null, image: null, site: current.hostname.replace(/^www\./, '') };
    if (ct.startsWith('image/')) {
      return NextResponse.json({ ...base, image: current.toString() }, { headers: { 'cache-control': 'private, max-age=86400' } });
    }
    if (ct && !/html|xml/i.test(ct)) {
      return NextResponse.json(base, { headers: { 'cache-control': 'private, max-age=86400' } });
    }
    const html = decodeHtml(await readLimited(res), ct);
    let meta = parseMeta(html, current);
    // YouTube 는 서버 IP 에 동의 페이지를 주는 경우가 많아 메타가 비어 있음 → 공식 oEmbed 로 보충
    if (!meta.title && /(^|\.)(youtube\.com|youtu\.be)$/i.test(current.hostname)) {
      meta = { ...meta, ...(await youtubeOEmbed(raw, controller.signal)) };
    }
    return NextResponse.json({ ...base, ...meta }, { headers: { 'cache-control': 'private, max-age=86400' } });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const message = aborted ? '응답이 너무 느립니다' : err instanceof Error ? err.message : '미리보기를 가져오지 못했습니다';
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    clearTimeout(timer);
  }
}
