-- ===========================================================
-- 구름사탕 마을 — 테스트 입장 관리 스키마
-- 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다. (게임 진행 저장은 없습니다)
--
--  · 회차(round)마다 게스트 5명까지만 입장
--  · 호스트(나)는 정원에 포함되지 않음
--  · 호스트가 회차 번호를 직접 지정해서 리셋 ("이제부터 2번 테스트야")
--  · 게스트마다 슬롯 1~5 를 받고, 슬롯에 따라 캐릭터 모양이 달라집니다
-- ===========================================================

/* ---------- 설정 (한 줄짜리 테이블) ---------- */
create table if not exists public.cc_config (
  id            int  primary key default 1,
  host_code     text not null default 'cloudhost1234',  -- 호스트 입장용 코드
  capacity      int  not null default 5,                -- 회차당 게스트 정원
  current_round int  not null default 1,
  constraint cc_config_one_row check (id = 1)
);
insert into public.cc_config (id) values (1) on conflict (id) do nothing;

/* ---------- 참가자 ---------- */
create table if not exists public.cc_players (
  id        bigserial primary key,
  round     int  not null,
  device    text not null,
  name      text not null,
  role      text not null default 'guest',   -- 'guest' | 'host'
  slot      int  not null default 0,         -- 0=호스트, 1~5=게스트 (캐릭터 모양)
  joined_at timestamptz not null default now(),
  unique (round, device)
);
create index if not exists cc_players_round_idx on public.cc_players (round);

/* 예전 버전으로 이미 만들었던 경우를 위한 보강 */
alter table public.cc_players add column if not exists slot int not null default 0;

/* ---------- RLS: 테이블 직접 접근은 전면 차단 ----------
   정책을 하나도 만들지 않으면 anon 키로는 아무것도 읽고 쓸 수 없습니다.
   아래 security definer 함수를 통해서만 접근하게 됩니다.            */
alter table public.cc_config  enable row level security;
alter table public.cc_players enable row level security;

/* ---------- 현재 상태 ---------- */
create or replace function public.cc_status()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round int;
  v_cap   int;
  v_taken int;
  v_list  json;
begin
  select current_round, capacity into v_round, v_cap from public.cc_config where id = 1;

  select count(*) into v_taken
    from public.cc_players where round = v_round and role = 'guest';

  select coalesce(json_agg(json_build_object('name', name, 'role', role, 'slot', slot)
                           order by joined_at), '[]'::json)
    into v_list
    from public.cc_players where round = v_round;

  return json_build_object(
    'ok', true, 'round', v_round, 'capacity', v_cap,
    'taken', v_taken, 'full', v_taken >= v_cap, 'players', v_list
  );
end;
$$;

/* ---------- 입장 ---------- */
create or replace function public.cc_join(p_device text, p_name text, p_host_code text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round int;
  v_cap   int;
  v_code  text;
  v_name  text;
  v_role  text;
  v_slot  int;
  v_taken int;
  v_exist public.cc_players;
begin
  select current_round, capacity, host_code into v_round, v_cap, v_code
    from public.cc_config where id = 1;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    return json_build_object('ok', false, 'error', 'no_name');
  end if;
  v_name := left(v_name, 12);

  /* 같은 기기가 이번 회차에 이미 들어와 있으면 자리를 새로 쓰지 않습니다 (새로고침 대응) */
  select * into v_exist
    from public.cc_players where round = v_round and device = p_device;
  if found then
    if exists (select 1 from public.cc_players
                where round = v_round and lower(name) = lower(v_name) and id <> v_exist.id) then
      return json_build_object('ok', false, 'error', 'name_taken');
    end if;

    /* 호스트 코드를 들고 다시 들어오면 게스트 → 호스트로 승격하고 자리를 반납합니다.
       (폰으로 미리 게스트로 들어가 봤다가 호스트로 다시 들어오는 경우)              */
    if p_host_code is not null and btrim(p_host_code) = v_code and v_exist.role <> 'host' then
      update public.cc_players set name = v_name, role = 'host', slot = 0 where id = v_exist.id;
      select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
      return json_build_object('ok', true, 'rejoined', true, 'upgraded', true, 'name', v_name,
                               'role', 'host', 'slot', 0, 'round', v_round,
                               'capacity', v_cap, 'taken', v_taken);
    end if;

    update public.cc_players set name = v_name where id = v_exist.id;
    select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
    return json_build_object('ok', true, 'rejoined', true, 'name', v_name, 'role', v_exist.role,
                             'slot', v_exist.slot, 'round', v_round, 'capacity', v_cap, 'taken', v_taken);
  end if;

  /* 호스트 코드가 맞으면 정원과 무관하게 입장 (슬롯 0 = 왕관 캐릭터) */
  if p_host_code is not null and btrim(p_host_code) = v_code then
    v_role := 'host';
    v_slot := 0;
  else
    v_role := 'guest';
    select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
    if v_taken >= v_cap then
      return json_build_object('ok', false, 'error', 'full', 'taken', v_taken,
                               'capacity', v_cap, 'round', v_round);
    end if;
    /* 비어 있는 가장 작은 슬롯을 줍니다 (1 ~ capacity) */
    select min(s) into v_slot
      from generate_series(1, v_cap) as s
     where not exists (select 1 from public.cc_players
                        where round = v_round and role = 'guest' and slot = s);
    if v_slot is null then
      return json_build_object('ok', false, 'error', 'full', 'taken', v_cap,
                               'capacity', v_cap, 'round', v_round);
    end if;
  end if;

  if exists (select 1 from public.cc_players where round = v_round and lower(name) = lower(v_name)) then
    return json_build_object('ok', false, 'error', 'name_taken');
  end if;

  insert into public.cc_players (round, device, name, role, slot)
    values (v_round, p_device, v_name, v_role, v_slot);

  select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
  return json_build_object('ok', true, 'name', v_name, 'role', v_role, 'slot', v_slot,
                           'round', v_round, 'capacity', v_cap, 'taken', v_taken);
end;
$$;

/* ---------- 회차 지정 / 리셋 (호스트만) ----------
   p_round 를 주면 그 번호로, 안 주면 현재 회차 + 1 로 갑니다.        */
create or replace function public.cc_new_round(p_host_code text, p_round int default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code  text;
  v_round int;
  v_cap   int;
begin
  select host_code, capacity into v_code, v_cap from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if p_round is not null and (p_round < 1 or p_round > 9999) then
    return json_build_object('ok', false, 'error', 'bad_round');
  end if;

  update public.cc_config
     set current_round = coalesce(p_round, current_round + 1)
   where id = 1
  returning current_round into v_round;

  /* 그 회차에 남아 있던 기록은 지우고 새로 시작합니다 */
  delete from public.cc_players where round = v_round;

  return json_build_object('ok', true, 'round', v_round, 'capacity', v_cap,
                           'taken', 0, 'players', '[]'::json);
end;
$$;

/* ---------- 실행 권한 ---------- */
revoke all on function public.cc_status()                from public;
revoke all on function public.cc_join(text, text, text)   from public;
revoke all on function public.cc_new_round(text, int)     from public;
grant execute on function public.cc_status()              to anon, authenticated;
grant execute on function public.cc_join(text, text, text) to anon, authenticated;
grant execute on function public.cc_new_round(text, int)   to anon, authenticated;

/* 예전 1인자 버전이 남아 있으면 정리 */
drop function if exists public.cc_new_round(text);

/* ===========================================================
   호스트 코드를 바꾸려면:
     update public.cc_config set host_code = '새코드' where id = 1;
   정원을 바꾸려면:
     update public.cc_config set capacity = 8 where id = 1;
   지금 회차 참가자 보기:
     select * from public.cc_players
      where round = (select current_round from public.cc_config) order by joined_at;
   =========================================================== */

-- ===========================================================
-- 2단계 — 게임 안에서 올리는 콘텐츠
--   · 퀴즈: 이미지(작게 줄여 base64) + 정답을 DB 에 저장
--   · 음악: 파일은 Storage 의 music 버킷, 목록은 DB 에 저장
--   추가/삭제는 호스트 코드를 아는 사람만 가능합니다.
-- ===========================================================

create table if not exists public.cc_quiz (
  id         bigserial primary key,
  image      text not null,          -- data:image/jpeg;base64,...
  answer     text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cc_tracks (
  id         bigserial primary key,
  title      text not null,
  path       text not null,          -- music 버킷 안의 파일 경로
  created_at timestamptz not null default now()
);

alter table public.cc_quiz   enable row level security;
alter table public.cc_tracks enable row level security;

/* 답 맞추기용 정규화 — 공백/대소문자 무시 */
create or replace function public.cc_norm(t text)
returns text language sql immutable as $$
  select lower(regexp_replace(coalesce(t, ''), '\s+', '', 'g'))
$$;

/* ---------- 퀴즈 ---------- */

/* 목록에는 정답을 실어 보내지 않습니다 (미리 볼 수 없게) */
create or replace function public.cc_quiz_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('id', id, 'image', image) order by id), '[]'::json)
    into v from public.cc_quiz;
  return v;
end; $$;

create or replace function public.cc_quiz_add(p_host_code text, p_image text, p_answer text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_answer), '') = '' or coalesce(p_image, '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if length(p_image) > 900000 then           -- 약 650KB 이상은 거절
    return json_build_object('ok', false, 'error', 'too_big');
  end if;
  insert into public.cc_quiz (image, answer) values (p_image, btrim(p_answer)) returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end; $$;

create or replace function public.cc_quiz_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_quiz where id = p_id;
  return json_build_object('ok', true);
end; $$;

create or replace function public.cc_quiz_check(p_id bigint, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare v_answer text;
begin
  select answer into v_answer from public.cc_quiz where id = p_id;
  if v_answer is null then
    return json_build_object('ok', false, 'error', 'no_quiz');
  end if;
  if public.cc_norm(p_guess) = public.cc_norm(v_answer) then
    return json_build_object('ok', true, 'correct', true, 'answer', v_answer);
  end if;
  return json_build_object('ok', true, 'correct', false);
end; $$;

/* ---------- 음악 ---------- */

create or replace function public.cc_track_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('id', id, 'title', title, 'path', path) order by id), '[]'::json)
    into v from public.cc_tracks;
  return v;
end; $$;

create or replace function public.cc_track_add(p_host_code text, p_title text, p_path text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_path), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  insert into public.cc_tracks (title, path) values (btrim(p_title), btrim(p_path)) returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end; $$;

create or replace function public.cc_track_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_path text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  select path into v_path from public.cc_tracks where id = p_id;
  delete from public.cc_tracks where id = p_id;
  return json_build_object('ok', true, 'path', v_path);
end; $$;

/* ---------- 음악 파일 보관함(Storage) ---------- */
insert into storage.buckets (id, name, public, file_size_limit)
values ('music', 'music', true, 20971520)          -- 20MB 제한
on conflict (id) do update set public = true, file_size_limit = 20971520;

drop policy if exists "music 듣기" on storage.objects;
create policy "music 듣기" on storage.objects
  for select using (bucket_id = 'music');

drop policy if exists "music 올리기" on storage.objects;
create policy "music 올리기" on storage.objects
  for insert with check (bucket_id = 'music');

drop policy if exists "music 지우기" on storage.objects;
create policy "music 지우기" on storage.objects
  for delete using (bucket_id = 'music');

/* ---------- 실행 권한 ---------- */
grant execute on function public.cc_quiz_list()                    to anon, authenticated;
grant execute on function public.cc_quiz_add(text, text, text)      to anon, authenticated;
grant execute on function public.cc_quiz_del(text, bigint)          to anon, authenticated;
grant execute on function public.cc_quiz_check(bigint, text)        to anon, authenticated;
grant execute on function public.cc_track_list()                    to anon, authenticated;
grant execute on function public.cc_track_add(text, text, text)     to anon, authenticated;
grant execute on function public.cc_track_del(text, bigint)         to anon, authenticated;
