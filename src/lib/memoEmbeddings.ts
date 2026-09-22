/**
 * Diary(memos) 임베딩 — 서버 전용.
 * - text-embedding-3-small (1536차원), 글 하나를 1,200자 안팎 chunk 로 나눠 저장
 * - memo_embeddings 테이블 / match_memos, memos_needing_embedding, memo_embedding_status RPC 사용
 *   (add_memo_embeddings.sql)
 */
import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { kstDate, stripHtml, weekdayOf } from './aiInsights';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMS = 1536;
const CHUNK_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const MAX_CHUNKS_PER_MEMO = 12;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

export type MemoRow = {
  id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  updated_at: string | null;
  category_id?: string | null;
  memo_categories?: { name: string } | { name: string }[] | null;
};

export const categoryNameOf = (m: MemoRow): string | null => {
  const c = m.memo_categories;
  if (!c) return null;
  return Array.isArray(c) ? c[0]?.name ?? null : c.name ?? null;
};

/** 테이블/RPC/확장 미설치 판별 */
export const isEmbeddingSetupMissing = (e: { message?: string; code?: string } | null | undefined) =>
  !!e &&
  (e.code === '42P01' ||
    e.code === 'PGRST205' ||
    e.code === 'PGRST202' ||
    e.code === '42883' ||
    /relation .* does not exist|Could not find the (table|function)|type "vector" does not exist/i.test(e.message || ''));

/** 글 → chunk 배열 (문단 경계 우선, 너무 길면 문자 단위) */
export function chunkMemo(title: string | null, html: string | null): string[] {
  const body = stripHtml(html || '').replace(/\n{3,}/g, '\n\n').trim();
  const head = (title || '').trim();
  if (!body && !head) return [];
  const full = head ? `${head}\n\n${body}` : body;
  if (full.length <= CHUNK_CHARS) return [full];

  const paras = full.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = '';
  const push = () => {
    if (cur.trim()) chunks.push(cur.trim());
    cur = '';
  };
  for (const p of paras) {
    if (p.length > CHUNK_CHARS) {
      push();
      for (let i = 0; i < p.length; i += CHUNK_CHARS - CHUNK_OVERLAP) {
        chunks.push(p.slice(i, i + CHUNK_CHARS));
        if (i + CHUNK_CHARS >= p.length) break;
      }
      continue;
    }
    if ((cur + '\n' + p).length > CHUNK_CHARS) {
      push();
      // 앞 chunk 끝부분을 살짝 겹쳐서 문맥 유지
      const prev = chunks[chunks.length - 1] || '';
      cur = prev.slice(-CHUNK_OVERLAP) + '\n' + p;
    } else {
      cur = cur ? `${cur}\n${p}` : p;
    }
  }
  push();
  // 제목을 각 chunk 앞에 붙여 검색 시 맥락 보강 (첫 chunk 는 이미 포함)
  return chunks.slice(0, MAX_CHUNKS_PER_MEMO).map((c, i) => (i === 0 || !head || c.startsWith(head) ? c : `${head}\n\n${c}`));
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts.map((t) => t.slice(0, 8000)),
    dimensions: EMBEDDING_DIMS,
  });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}

/** 글 하나 색인 (기존 chunk 삭제 후 재삽입). 반환: chunk 수 */
export async function indexMemo(supabase: SupabaseClient, userId: string, memo: MemoRow): Promise<number> {
  let chunks = chunkMemo(memo.title, memo.content);
  // 빈 글도 색인해 두어야 반복 처리되지 않음
  if (chunks.length === 0) chunks = ['(내용 없음)'];
  const memoUpdatedAt = memo.updated_at || memo.created_at;

  const vectors = await embedTexts(chunks);
  const { error: delErr } = await supabase.from('memo_embeddings').delete().eq('memo_id', memo.id);
  if (delErr) throw delErr;
  const rows = chunks.map((content, i) => ({
    memo_id: memo.id,
    user_id: userId,
    chunk_index: i,
    content,
    embedding: vectors[i],
    memo_updated_at: memoUpdatedAt,
  }));
  const { error } = await supabase.from('memo_embeddings').insert(rows);
  if (error) throw error;
  return rows.length;
}

export type EmbeddingStatus = { total: number; indexed: number; pending: number };

export async function getEmbeddingStatus(supabase: SupabaseClient): Promise<EmbeddingStatus> {
  const { data, error } = await supabase.rpc('memo_embedding_status').single();
  if (error) throw error;
  const d = data as { total_memos: number; indexed_memos: number; pending_memos: number };
  return { total: Number(d.total_memos), indexed: Number(d.indexed_memos), pending: Number(d.pending_memos) };
}

export type MemoMatch = {
  memoId: string;
  date: string; // YYYY-MM-DD (요일)
  title: string;
  category: string | null;
  text: string;
  similarity: number;
};

/** 의미 검색 */
export async function searchMemosSemantic(
  supabase: SupabaseClient,
  query: string,
  opts: { limit?: number; category?: string | null; from?: string | null; to?: string | null; minSimilarity?: number } = {}
): Promise<MemoMatch[]> {
  const vec = await embedQuery(query);
  const { data, error } = await supabase.rpc('match_memos', {
    query_embedding: vec,
    match_count: Math.min(Math.max(opts.limit ?? 8, 1), 20),
    category_name: opts.category || null,
    from_date: opts.from || null,
    to_date: opts.to || null,
    min_similarity: opts.minSimilarity ?? 0.15,
  });
  if (error) throw error;
  return ((data as any[]) || []).map((r) => {
    const d = kstDate(new Date(r.created_at));
    return {
      memoId: r.memo_id,
      date: `${d} (${weekdayOf(d)})`,
      title: r.title || '제목 없음',
      category: r.category ?? null,
      text: r.content,
      similarity: Math.round(Number(r.similarity) * 1000) / 1000,
    };
  });
}
