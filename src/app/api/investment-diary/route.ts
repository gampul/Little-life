import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '../../../lib/supabase_ssr';

// GET: 투자일기 목록 조회 (최신순)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('investment_diary_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entries: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: 투자일기 업서트 (하루 1개만 저장)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { entry_date, content } = body;

    if (!entry_date || content === undefined || content === null) {
      return NextResponse.json(
        { error: 'entry_date and content are required' },
        { status: 400 }
      );
    }

    // Upsert: 같은 날짜면 덮어쓰기
    const { data, error } = await supabase
      .from('investment_diary_entries')
      .upsert(
        {
          user_id: user.id,
          entry_date,
          content,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,entry_date',
        }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

