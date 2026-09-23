-- Diary 중요공지(고정) 기능: memos.is_pinned
-- Supabase SQL Editor 에서 1회 실행. 여러 번 실행해도 안전.

alter table memos add column if not exists is_pinned boolean not null default false;

create index if not exists memos_pinned_idx
  on memos (created_at desc) where is_pinned;
