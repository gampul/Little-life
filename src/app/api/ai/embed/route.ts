import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';
import {
  getEmbeddingStatus,
  indexMemo,
  isEmbeddingSetupMissing,
  type MemoRow,
} from '../../../../lib/memoEmbeddings';

export const maxDuration = 60;

const BATCH_MAX = 20;

/** GET: 색인 현황 */
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const status = await getEmbeddingStatus(supabase);
    return NextResponse.json({ ...status, setupMissing: false });
  } catch (e: any) {
    if (isEmbeddingSetupMissing(e)) return NextResponse.json({ total: 0, indexed: 0, pending: 0, setupMissing: true });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST
 *  - { memoId }            : 글 하나 색인 (Diary 저장 직후 호출)
 *  - { mode: 'pending', batch?: n } : 미색인/수정된 글을 최대 n개 처리 (클라이언트가 pending=0 까지 반복 호출)
 */
export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 });
  }
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const select = 'id, title, content, created_at, updated_at';

  try {
    if (typeof body.memoId === 'string' && body.memoId) {
      const { data: memo, error } = await supabase.from('memos').select(select).eq('id', body.memoId).maybeSingle();
      if (error) throw error;
      if (!memo) return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
      const chunks = await indexMemo(supabase, userId, memo as MemoRow);
      return NextResponse.json({ success: true, memoId: memo.id, chunks });
    }

    // 배치 색인
    const batch = Math.min(Math.max(Number(body.batch) || 10, 1), BATCH_MAX);
    const { data: pendingIds, error: pErr } = await supabase.rpc('memos_needing_embedding', { max_count: batch });
    if (pErr) throw pErr;
    const ids = ((pendingIds as { id: string }[]) || []).map((r) => r.id);
    let processed = 0;
    let chunks = 0;
    const failed: string[] = [];
    if (ids.length > 0) {
      const { data: memos, error } = await supabase.from('memos').select(select).in('id', ids);
      if (error) throw error;
      for (const memo of (memos as MemoRow[]) || []) {
        try {
          chunks += await indexMemo(supabase, userId, memo);
          processed += 1;
        } catch (e: any) {
          console.error('indexMemo failed', memo.id, e?.message);
          failed.push(memo.id);
        }
      }
    }
    const status = await getEmbeddingStatus(supabase);
    return NextResponse.json({ success: true, processed, chunks, failed, ...status, done: status.pending === 0 || (processed === 0 && failed.length > 0) });
  } catch (e: any) {
    if (isEmbeddingSetupMissing(e)) {
      return NextResponse.json(
        { error: '임베딩 테이블이 아직 없습니다. Supabase SQL Editor 에서 add_memo_embeddings.sql 을 실행해 주세요.', setupMissing: true },
        { status: 400 }
      );
    }
    console.error('embed route error:', e);
    return NextResponse.json({ error: e.message || '색인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
