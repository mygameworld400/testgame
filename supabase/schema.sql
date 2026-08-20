-- ===========================================================
-- 구름사탕 마을 — Supabase 스키마
-- 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다.
-- ===========================================================

create table if not exists public.cc_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nickname   text,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- RLS: 켜두지 않으면 누구나 남의 세이브를 읽고 지울 수 있습니다. 반드시 켜세요.
alter table public.cc_saves enable row level security;

drop policy if exists "본인 세이브 읽기" on public.cc_saves;
create policy "본인 세이브 읽기"
  on public.cc_saves for select
  using (auth.uid() = user_id);

drop policy if exists "본인 세이브 만들기" on public.cc_saves;
create policy "본인 세이브 만들기"
  on public.cc_saves for insert
  with check (auth.uid() = user_id);

drop policy if exists "본인 세이브 고치기" on public.cc_saves;
create policy "본인 세이브 고치기"
  on public.cc_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "본인 세이브 지우기" on public.cc_saves;
create policy "본인 세이브 지우기"
  on public.cc_saves for delete
  using (auth.uid() = user_id);
