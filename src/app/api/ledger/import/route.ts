import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../../lib/supabase_ssr';
import crypto from 'crypto';

export const runtime = 'nodejs';

type CsvRow = {
  occurredAt: string; // ISO
  assetName: string;
  categoryMain: string;
  categorySub: string | null;
  description: string;
  memo: string | null;
  amount: number;
  kind: 'income' | 'expense';
  currency: string;
};

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function pad2(n: string) {
  return n.padStart(2, '0');
}

function parseKstDateTimeToIso(raw: string): string {
  // Examples: "2026-01-01 9:04", "2026-01-01 12:37", "2026-01-01"
  const s = String(raw || '').trim();
  if (!s) throw new Error('missing date');
  const [datePart, timePart] = s.split(' ');
  if (!timePart) {
    return new Date(`${datePart}T00:00:00+09:00`).toISOString();
  }
  const [hhRaw, mmRaw = '00'] = timePart.split(':');
  const hh = pad2(hhRaw);
  const mm = pad2(mmRaw);
  return new Date(`${datePart}T${hh}:${mm}:00+09:00`).toISOString();
}

function sha256Hex(input: string | Buffer) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function normalizeAmount(v: string) {
  const cleaned = String(v || '').replace(/,/g, '').replace(/"/g, '').trim();
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function buildRowHash(userId: string, row: CsvRow) {
  const base = [
    userId,
    row.kind,
    row.occurredAt,
    row.assetName,
    row.categoryMain,
    row.categorySub || '',
    row.description,
    row.memo || '',
    String(row.amount),
    row.currency,
  ].join('|');
  return sha256Hex(base);
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const filename = file.name || 'expense.csv';
  const content = Buffer.from(await file.arrayBuffer());
  const fileHash = sha256Hex(content);

  // 1) Create / dedupe batch
  const { data: batchInsert, error: batchErr } = await supabase
    .from('transaction_import_batches')
    .insert([{ user_id: user.id, file_hash: fileHash, filename }])
    .select('id')
    .maybeSingle();

  if (batchErr) {
    // unique violation => already imported this exact file
    if (batchErr.code === '23505') {
      const { data: existing } = await supabase
        .from('transaction_import_batches')
        .select('id, created_at')
        .eq('user_id', user.id)
        .eq('file_hash', fileHash)
        .maybeSingle();
      return NextResponse.json({
        status: 'duplicate_file',
        fileHash,
        batchId: existing?.id ?? null,
        message: '이미 업로드된 파일입니다. (중복 없음)',
      });
    }
    return NextResponse.json({ error: batchErr.message, code: batchErr.code }, { status: 500 });
  }

  const batchId = batchInsert?.id;
  if (!batchId) {
    return NextResponse.json({ error: 'Failed to create import batch' }, { status: 500 });
  }

  const text = content.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, '').trim());
  const idx = (name: string) => headers.findIndex((h) => h === name);

  const iDate = idx('날짜');
  const iAsset = idx('자산');
  const iCat = idx('분류');
  const iSub = idx('소분류');
  const iDesc = idx('내용');
  const iAmount = idx('금액'); // prefer this
  const iKind = idx('수입/지출');
  const iMemo = idx('메모');
  const iCur = idx('화폐');

  if ([iDate, iAsset, iCat, iDesc, iAmount, iKind].some((i) => i < 0)) {
    return NextResponse.json({ error: 'CSV headers are not supported', headers }, { status: 400 });
  }

  // 2) Prefetch assets & categories
  const [{ data: assets }, { data: categories }] = await Promise.all([
    supabase
      .from('assets')
      .select('id, name, currency')
      .eq('user_id', user.id)
      .is('deleted_at', null),
    supabase
      .from('categories')
      .select('id, type, name, parent_id')
      .eq('user_id', user.id)
      .is('deleted_at', null),
  ]);

  const assetByName = new Map<string, { id: string; currency: string }>();
  (assets || []).forEach((a: any) => assetByName.set(String(a.name), { id: a.id, currency: String(a.currency || 'KRW') }));

  const catKey = (type: string, parentId: string | null, name: string) => `${type}|${parentId || ''}|${name}`;
  const catByKey = new Map<string, string>();
  (categories || []).forEach((c: any) => {
    catByKey.set(catKey(String(c.type), c.parent_id ?? null, String(c.name)), c.id);
  });

  const parsed: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < headers.length) continue;

    const rawKind = values[iKind]?.replace(/"/g, '').trim();
    const kind: CsvRow['kind'] = rawKind === '수입' ? 'income' : 'expense';

    const occurredAt = parseKstDateTimeToIso(values[iDate]);
    const assetName = values[iAsset]?.replace(/"/g, '').trim() || '미분류 자산';
    const categoryMain = values[iCat]?.replace(/"/g, '').trim() || '기타';
    const categorySub = iSub >= 0 ? (values[iSub]?.replace(/"/g, '').trim() || null) : null;
    const description = values[iDesc]?.replace(/"/g, '').trim() || '';
    const memo = iMemo >= 0 ? (values[iMemo]?.replace(/"/g, '').trim() || null) : null;
    const currency = iCur >= 0 ? (values[iCur]?.replace(/"/g, '').trim() || 'KRW') : 'KRW';
    const amount = normalizeAmount(values[iAmount]);

    if (!description || !Number.isFinite(amount) || amount <= 0) continue;

    parsed.push({
      occurredAt,
      assetName,
      categoryMain,
      categorySub,
      description,
      memo,
      amount,
      kind,
      currency,
    });
  }

  // update batch rows_total
  await supabase.from('transaction_import_batches').update({ rows_total: parsed.length }).eq('id', batchId);

  // 3) Ensure assets/categories exist (create missing)
  for (const row of parsed) {
    if (!assetByName.has(row.assetName)) {
      const { data: inserted, error } = await supabase
        .from('assets')
        .insert([{ user_id: user.id, name: row.assetName, currency: row.currency }])
        .select('id, name, currency')
        .maybeSingle();
      if (!error && inserted) {
        assetByName.set(String(inserted.name), { id: inserted.id, currency: String(inserted.currency || row.currency) });
      }
    }

    const type = row.kind;
    const mainKey = catKey(type, null, row.categoryMain);
    if (!catByKey.has(mainKey)) {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert([{ user_id: user.id, type, name: row.categoryMain, parent_id: null }])
        .select('id, type, name, parent_id')
        .maybeSingle();
      if (!error && inserted) {
        catByKey.set(catKey(inserted.type, inserted.parent_id ?? null, inserted.name), inserted.id);
      }
    }

    if (row.categorySub) {
      const parentId = catByKey.get(mainKey)!;
      const subKey = catKey(type, parentId, row.categorySub);
      if (!catByKey.has(subKey)) {
        const { data: inserted, error } = await supabase
          .from('categories')
          .insert([{ user_id: user.id, type, name: row.categorySub, parent_id: parentId }])
          .select('id, type, name, parent_id')
          .maybeSingle();
        if (!error && inserted) {
          catByKey.set(catKey(inserted.type, inserted.parent_id ?? null, inserted.name), inserted.id);
        }
      }
    }
  }

  // 4) Insert transactions (dedupe by source_row_hash)
  const txPayload = parsed.map((row) => {
    const assetId = assetByName.get(row.assetName)?.id;
    const mainId = catByKey.get(catKey(row.kind, null, row.categoryMain));
    const categoryId = row.categorySub
      ? catByKey.get(catKey(row.kind, mainId || null, row.categorySub))
      : mainId;

    return {
      user_id: user.id,
      occurred_at: row.occurredAt,
      type: row.kind,
      asset_id: assetId,
      category_id: categoryId,
      amount: row.amount,
      currency: row.currency,
      description: row.description,
      memo: row.memo || '',
      transfer_pair_id: null,
      deleted_at: null,
      import_batch_id: batchId,
      source: 'csv',
      source_row_hash: buildRowHash(user.id, row),
    };
  }).filter((t) => t.asset_id && t.category_id);

  // chunk insert/upsert
  const chunkSize = 500;
  for (let i = 0; i < txPayload.length; i += chunkSize) {
    const chunk = txPayload.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('transactions')
      .upsert(chunk as any, { onConflict: 'user_id,source_row_hash', ignoreDuplicates: true });
    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
  }

  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('import_batch_id', batchId);

  return NextResponse.json({
    status: 'ok',
    fileHash,
    batchId,
    rowsParsed: parsed.length,
    rowsAttempted: txPayload.length,
    rowsInserted: count ?? null,
  });
}


