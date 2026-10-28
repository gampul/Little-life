-- Diary 글 → Daily "글쓰기" 루틴 자동 체크 (메모·사진 포함)
-- 상태: 작성 완료, 아직 프로덕션 미적용 (2026-10-28 적용 시도 중 승인 대기로 취소됨)
--
-- memos 가 생기거나(insert) 제목·본문·날짜·대표사진이 바뀌거나(update) 지워지면(delete)
-- 그 글의 날짜(KST)에 대해 sync_writing_routine(user, date) 를 다시 계산한다.
--   - 그날 글이 있으면: "글쓰기" 루틴 체크, 메모 = 그날 글 제목들(' · '), 사진 = 대표사진 + 본문 이미지(최대 5장)
--   - 사용자가 직접 쓴 메모·직접 올린 사진은 보존 (diary_sync 에 자동으로 넣은 값만 기록해 구분)
--   - 그날 글이 모두 없어지면: 자동으로 넣은 메모·사진만 빼고, 자동으로 만든 체크면 체크도 지움
-- 대상 루틴: 사용자의 활성 루틴 중 이름이 '글쓰기' 인 것 (없으면 아무 것도 안 함)

alter table public.daily_routine_checks add column if not exists diary_sync jsonb;
comment on column public.daily_routine_checks.diary_sync is 'Diary 글에서 자동으로 넣은 값 {memo, images[], created} — 사용자가 직접 넣은 값과 구분용';

create or replace function public.sync_writing_routine(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_routine uuid;
  v_row public.daily_routine_checks%rowtype;
  v_found boolean;
  v_titles text;
  v_imgs jsonb;
  v_prev jsonb;
  v_prev_memo text;
  v_prev_imgs jsonb;
  v_manual_memo text;
  v_manual_imgs jsonb;
  v_final_imgs jsonb;
  v_count int;
begin
  if p_user is null or p_date is null then
    return;
  end if;

  select id into v_routine
  from public.routine_templates
  where user_id = p_user::text and label = '글쓰기' and deleted_at is null
  order by sort_order
  limit 1;
  if v_routine is null then
    return;
  end if;

  -- 그날 글 (KST 기준)
  select count(*),
         string_agg(
           coalesce(
             nullif(btrim(m.title), ''),
             nullif(btrim(m.excerpt), ''),
             left(btrim(regexp_replace(regexp_replace(coalesce(m.content, ''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')), 40)
           ),
           ' · ' order by m.created_at
         )
    into v_count, v_titles
  from public.memos m
  where m.user_id = p_user
    and (m.created_at at time zone 'Asia/Seoul')::date = p_date;

  -- 사진: 대표사진 → 본문 <img> 순, 중복 제거, 최대 5장
  with src as (
    select m.created_at, 0 as ord, m.cover_image as url
    from public.memos m
    where m.user_id = p_user and (m.created_at at time zone 'Asia/Seoul')::date = p_date and m.cover_image is not null
    union all
    select m.created_at, x.ord, x.url
    from public.memos m
    cross join lateral (
      select row_number() over () as ord, mm[1] as url
      from regexp_matches(coalesce(m.content, ''), '<img[^>]*src="([^"]+)"', 'g') as mm
    ) x
    where m.user_id = p_user and (m.created_at at time zone 'Asia/Seoul')::date = p_date
  ),
  dedup as (
    select url, min(created_at) as c, min(ord) as o
    from src
    where url is not null and url <> '' and url !~* '^data:'
    group by url
  )
  select coalesce(jsonb_agg(url order by c, o), '[]'::jsonb) into v_imgs
  from (select url, c, o from dedup order by c, o limit 5) t;

  select * into v_row
  from public.daily_routine_checks
  where user_id = p_user and date = p_date and routine_id = v_routine;
  v_found := found;

  v_prev := coalesce(v_row.diary_sync, '{}'::jsonb);
  v_prev_memo := v_prev ->> 'memo';
  v_prev_imgs := coalesce(v_prev -> 'images', '[]'::jsonb);

  -- 사용자가 직접 넣은 값 = 지금 값 중 예전에 자동으로 넣은 게 아닌 것
  v_manual_memo := case
    when not v_found then null
    when coalesce(btrim(v_row.memo), '') = '' then null
    when v_row.memo = v_prev_memo then null
    else v_row.memo
  end;
  select coalesce(jsonb_agg(e), '[]'::jsonb) into v_manual_imgs
  from jsonb_array_elements(case when v_found and jsonb_typeof(v_row.image_urls) = 'array' then v_row.image_urls else '[]'::jsonb end) e
  where not (v_prev_imgs @> jsonb_build_array(e));

  if v_count > 0 then
    -- 직접 올린 사진 먼저, 그다음 글 사진 (최대 5장, 중복 제거)
    select coalesce(jsonb_agg(e order by pos), '[]'::jsonb) into v_final_imgs
    from (
      select e, min(pos) as pos
      from (
        select e, ord as pos from jsonb_array_elements(v_manual_imgs) with ordinality as a(e, ord)
        union all
        select e, 100 + ord from jsonb_array_elements(v_imgs) with ordinality as b(e, ord)
      ) u
      group by e
      order by min(pos)
      limit 5
    ) t;

    if not v_found then
      insert into public.daily_routine_checks (user_id, date, routine_id, checked, memo, image_urls, image_url, diary_sync)
      values (
        p_user, p_date, v_routine, true, v_titles, v_final_imgs, v_final_imgs ->> 0,
        jsonb_build_object('memo', v_titles, 'images', v_imgs, 'created', true)
      );
    else
      update public.daily_routine_checks
      set checked = true,
          memo = coalesce(v_manual_memo, v_titles),
          image_urls = v_final_imgs,
          image_url = v_final_imgs ->> 0,
          diary_sync = jsonb_build_object(
            'memo', v_titles, 'images', v_imgs,
            'created', coalesce((v_prev ->> 'created')::boolean, false)
          )
      where id = v_row.id;
    end if;
  elsif v_found and v_row.diary_sync is not null then
    -- 그날 글이 모두 없어짐 → 자동으로 넣은 것만 걷어냄
    if coalesce((v_prev ->> 'created')::boolean, false) and v_manual_memo is null and jsonb_array_length(v_manual_imgs) = 0 then
      delete from public.daily_routine_checks where id = v_row.id;
    else
      update public.daily_routine_checks
      set memo = v_manual_memo,
          image_urls = v_manual_imgs,
          image_url = v_manual_imgs ->> 0,
          diary_sync = null
      where id = v_row.id;
    end if;
  end if;
end;
$$;

revoke execute on function public.sync_writing_routine(uuid, date) from public, anon, authenticated;

create or replace function public.memos_sync_writing_routine()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- 지운 글, 또는 날짜·작성자가 바뀐 글의 예전 날짜
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and (
          old.user_id is distinct from new.user_id
          or (old.created_at at time zone 'Asia/Seoul')::date <> (new.created_at at time zone 'Asia/Seoul')::date)) then
    perform public.sync_writing_routine(old.user_id, (old.created_at at time zone 'Asia/Seoul')::date);
  end if;
  -- 새 글 / 고친 글의 날짜
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.sync_writing_routine(new.user_id, (new.created_at at time zone 'Asia/Seoul')::date);
  end if;
  return null;
end;
$$;

revoke execute on function public.memos_sync_writing_routine() from public, anon, authenticated;

drop trigger if exists trg_memos_sync_writing_routine on public.memos;
create trigger trg_memos_sync_writing_routine
after insert or delete or update of title, content, excerpt, cover_image, created_at, user_id
on public.memos
for each row execute function public.memos_sync_writing_routine();
