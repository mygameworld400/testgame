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

-- ===========================================================
-- 3단계 — 퀴즈 패키지(주제)
--   문제마다 주제를 달아 묶음으로 고를 수 있게 합니다.
--   기존 문제는 전부 '과자' 패키지로 들어갑니다.
-- ===========================================================

alter table public.cc_quiz add column if not exists pack text not null default '과자';

create or replace function public.cc_quiz_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('id', id, 'image', image, 'pack', pack) order by id), '[]'::json)
    into v from public.cc_quiz;
  return v;
end; $$;

/* 주제 목록 + 문제 수 */
create or replace function public.cc_quiz_packs()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('pack', pack, 'n', n) order by n desc, pack), '[]'::json)
    into v
    from (select pack, count(*) as n from public.cc_quiz group by pack) t;
  return v;
end; $$;

create or replace function public.cc_quiz_add(p_host_code text, p_image text, p_answer text, p_pack text default '과자')
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint; v_pack text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_answer), '') = '' or coalesce(p_image, '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if length(p_image) > 900000 then
    return json_build_object('ok', false, 'error', 'too_big');
  end if;
  v_pack := coalesce(nullif(btrim(p_pack), ''), '과자');
  insert into public.cc_quiz (image, answer, pack) values (p_image, btrim(p_answer), left(v_pack, 20))
    returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'pack', v_pack);
end; $$;

grant execute on function public.cc_quiz_packs()                          to anon, authenticated;
grant execute on function public.cc_quiz_add(text, text, text, text)      to anon, authenticated;

/* 예전 3인자 버전 정리 */
drop function if exists public.cc_quiz_add(text, text, text);

-- ===========================================================
-- 4단계 — 플레이리스트(앨범) 묶음
--   곡마다 플레이리스트 이름을 달아 접었다 폈다 할 수 있게 합니다.
--   기존 곡은 '기본' 플레이리스트로 들어갑니다.
-- ===========================================================

alter table public.cc_tracks add column if not exists pl text not null default '기본';

create or replace function public.cc_track_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('id', id, 'title', title, 'path', path, 'pl', pl) order by pl, id), '[]'::json)
    into v from public.cc_tracks;
  return v;
end; $$;

create or replace function public.cc_track_add(p_host_code text, p_title text, p_path text, p_pl text default '기본')
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint; v_pl text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_path), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  v_pl := coalesce(nullif(btrim(p_pl), ''), '기본');
  insert into public.cc_tracks (title, path, pl) values (btrim(p_title), btrim(p_path), left(v_pl, 24))
    returning id into v_id;
  return json_build_object('ok', true, 'id', v_id, 'pl', v_pl);
end; $$;

grant execute on function public.cc_track_add(text, text, text, text) to anon, authenticated;
drop function if exists public.cc_track_add(text, text, text);

-- ===========================================================
-- 5단계 — 오답일 때도 정답을 알려줍니다 (빨간펜 표시용)
-- ===========================================================
create or replace function public.cc_quiz_check(p_id bigint, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare v_answer text;
begin
  select answer into v_answer from public.cc_quiz where id = p_id;
  if v_answer is null then
    return json_build_object('ok', false, 'error', 'no_quiz');
  end if;
  return json_build_object(
    'ok', true,
    'correct', public.cc_norm(p_guess) = public.cc_norm(v_answer),
    'answer', v_answer
  );
end; $$;

-- ===========================================================
-- 6단계 — 플레이리스트 이름 수정 · 커버 이미지
--   커버는 작게 줄인 이미지를 그대로 DB 에 담습니다(수십 KB).
--   이름 수정과 커버 등록은 호스트만.
-- ===========================================================

create table if not exists public.cc_playlists (
  name       text primary key,
  cover      text,
  updated_at timestamptz not null default now()
);
alter table public.cc_playlists enable row level security;

create or replace function public.cc_pl_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('name', name, 'cover', cover) order by name), '[]'::json)
    into v from public.cc_playlists;
  return v;
end; $$;

/* 커버 등록·교체 */
create or replace function public.cc_pl_cover(p_host_code text, p_name text, p_cover text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if p_cover is not null and length(p_cover) > 200000 then      -- 약 145KB 제한
    return json_build_object('ok', false, 'error', 'too_big');
  end if;
  insert into public.cc_playlists (name, cover, updated_at)
    values (btrim(p_name), p_cover, now())
  on conflict (name) do update set cover = excluded.cover, updated_at = now();
  return json_build_object('ok', true);
end; $$;

/* 이름 바꾸기 — 곡들의 소속도 같이 옮깁니다 */
create or replace function public.cc_pl_rename(p_host_code text, p_old text, p_new text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_old text; v_new text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  v_old := btrim(coalesce(p_old, ''));
  v_new := left(btrim(coalesce(p_new, '')), 24);
  if v_old = '' or v_new = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if v_old = v_new then
    return json_build_object('ok', true, 'name', v_new);
  end if;

  update public.cc_tracks set pl = v_new where pl = v_old;

  /* 커버도 새 이름으로 옮깁니다 (같은 이름이 이미 있으면 기존 커버 유지) */
  update public.cc_playlists set name = v_new, updated_at = now()
   where name = v_old
     and not exists (select 1 from public.cc_playlists where name = v_new);
  delete from public.cc_playlists where name = v_old;

  return json_build_object('ok', true, 'name', v_new);
end; $$;

grant execute on function public.cc_pl_list()                        to anon, authenticated;
grant execute on function public.cc_pl_cover(text, text, text)       to anon, authenticated;
grant execute on function public.cc_pl_rename(text, text, text)      to anon, authenticated;

-- ===========================================================
-- 7단계 — 떵개방 메뉴 가챠
--   음식 목록은 모두가 함께 보고, 추가·수정·삭제는 호스트만.
-- ===========================================================

create table if not exists public.cc_foods (
  id   bigserial primary key,
  name text not null unique
);
alter table public.cc_foods enable row level security;

/* 처음 한 번만 기본 메뉴를 채웁니다 */
insert into public.cc_foods (name)
select x from unnest(array[
  '김치찌개','된장찌개','순두부찌개','부대찌개','제육볶음','불고기','삼겹살','치킨','피자','햄버거',
  '파스타','리조또','초밥','회덮밥','라멘','우동','돈까스','카레','짜장면','짬뽕',
  '탕수육','마라탕','쌀국수','팟타이','떡볶이','김밥','순대국','설렁탕','갈비탕','냉면',
  '비빔밥','김치볶음밥','오므라이스','샐러드','샌드위치','타코','부리토','스테이크','곱창','닭갈비',
  '찜닭','감자탕','해장국','육개장','만두','쫄면','콩국수','보쌈','족발','국밥'
]) as x
on conflict (name) do nothing;

create or replace function public.cc_food_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('id', id, 'name', name) order by id), '[]'::json)
    into v from public.cc_foods;
  return v;
end; $$;

create or replace function public.cc_food_add(p_host_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  insert into public.cc_foods (name) values (left(btrim(p_name), 20))
    on conflict (name) do nothing
    returning id into v_id;
  if v_id is null then
    return json_build_object('ok', false, 'error', 'dup');
  end if;
  return json_build_object('ok', true, 'id', v_id);
end; $$;

create or replace function public.cc_food_edit(p_host_code text, p_id bigint, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  update public.cc_foods set name = left(btrim(p_name), 20) where id = p_id;
  return json_build_object('ok', true);
end; $$;

create or replace function public.cc_food_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_foods where id = p_id;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.cc_food_list()                  to anon, authenticated;
grant execute on function public.cc_food_add(text, text)          to anon, authenticated;
grant execute on function public.cc_food_edit(text, bigint, text) to anon, authenticated;
grant execute on function public.cc_food_del(text, bigint)        to anon, authenticated;

-- ===========================================================
-- 8단계 — 중복 정답
--   정답을 쉼표(,) 나 슬래시(/) 로 여러 개 적으면 모두 정답 처리합니다.
--   예) "새우깡, 새우과자, 새우" → 셋 다 맞음
--   오답일 때 화면에는 맨 앞의 것을 대표 정답으로 보여줍니다.
-- ===========================================================
create or replace function public.cc_quiz_check(p_id bigint, p_guess text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_answer text;
  v_ok     boolean := false;
  v_one    text;
begin
  select answer into v_answer from public.cc_quiz where id = p_id;
  if v_answer is null then
    return json_build_object('ok', false, 'error', 'no_quiz');
  end if;

  foreach v_one in array regexp_split_to_array(v_answer, '\s*[,/]\s*') loop
    if v_one <> '' and public.cc_norm(p_guess) = public.cc_norm(v_one) then
      v_ok := true;
    end if;
  end loop;

  return json_build_object(
    'ok', true,
    'correct', v_ok,
    'answer', btrim(split_part(v_answer, ',', 1)),
    'answers', v_answer
  );
end; $$;

-- ===========================================================
-- 9단계 — 포춘쿠키
--   문장은 모두가 함께 보고, 추가·수정·삭제는 호스트만.
-- ===========================================================

create table if not exists public.cc_fortunes (
  id   bigserial primary key,
  text text not null unique
);
alter table public.cc_fortunes enable row level security;

insert into public.cc_fortunes (text)
select x from unnest(array[
  '오늘 당신이 흘린 노력은 하나도 사라지지 않았어요.',
  '미뤄뒀던 연락을 해보세요. 반가운 소식이 기다리고 있어요.',
  '작게 시작한 일이 생각보다 멀리까지 굴러갈 거예요.',
  '지금 걱정하는 일의 대부분은 일어나지 않아요.',
  '오늘은 당신이 웃는 얼굴이 누군가의 하루를 살려요.',
  '조금 느려도 괜찮아요. 방향이 맞으면 결국 도착합니다.',
  '곧 좋아하는 것을 마음껏 하게 될 시간이 생겨요.',
  '당신이 준 친절이 돌고 돌아 오늘 안에 돌아옵니다.',
  '망설이던 그 선택, 하는 쪽이 맞아요.',
  '오늘 만난 사람 중 한 명이 좋은 인연이 됩니다.',
  '쉬어도 돼요. 잘 쉬는 것도 실력이에요.',
  '어제의 당신보다 오늘의 당신이 분명히 나아요.',
  '기다리던 답이 예상보다 빨리 옵니다.',
  '지금의 서투름은 나중에 가장 좋은 이야기가 돼요.',
  '오늘 하늘을 한 번 올려다보세요. 기분 좋은 일이 생겨요.',
  '당신은 생각보다 훨씬 단단한 사람이에요.',
  '작은 지출이 큰 기쁨으로 돌아오는 날이에요.',
  '오래 준비한 일이 드디어 모양을 갖추기 시작합니다.',
  '누군가 조용히 당신을 응원하고 있어요.',
  '오늘의 우연은 우연이 아니에요. 놓치지 마세요.',
  '먹고 싶던 걸 드세요. 그럴 자격이 충분해요.',
  '실수해도 괜찮아요. 아무도 당신만큼 신경 쓰지 않아요.',
  '가벼운 마음으로 시작하면 오늘 일은 술술 풀려요.',
  '잠들기 전, 오늘 잘한 일 하나를 떠올려보세요.',
  '좋은 소식은 늘 조용한 걸음으로 옵니다. 곧 도착해요.'
]) as x
on conflict (text) do nothing;

create or replace function public.cc_fortune_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object('id', id, 'text', text) order by id), '[]'::json)
    into v from public.cc_fortunes;
  return v;
end; $$;

create or replace function public.cc_fortune_add(p_host_code text, p_text text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_text), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  insert into public.cc_fortunes (text) values (left(btrim(p_text), 80))
    on conflict (text) do nothing returning id into v_id;
  if v_id is null then return json_build_object('ok', false, 'error', 'dup'); end if;
  return json_build_object('ok', true, 'id', v_id);
end; $$;

create or replace function public.cc_fortune_edit(p_host_code text, p_id bigint, p_text text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_text), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  update public.cc_fortunes set text = left(btrim(p_text), 80) where id = p_id;
  return json_build_object('ok', true);
end; $$;

create or replace function public.cc_fortune_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_fortunes where id = p_id;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.cc_fortune_list()                   to anon, authenticated;
grant execute on function public.cc_fortune_add(text, text)           to anon, authenticated;
grant execute on function public.cc_fortune_edit(text, bigint, text)  to anon, authenticated;
grant execute on function public.cc_fortune_del(text, bigint)         to anon, authenticated;

-- ===========================================================
-- 10단계 — 비공개 모드
--   켜면 호스트 외에는 아무도 입장할 수 없습니다.
-- ===========================================================

alter table public.cc_config add column if not exists closed boolean not null default false;

create or replace function public.cc_status()
returns json language plpgsql security definer set search_path = public as $$
declare v_round int; v_cap int; v_taken int; v_list json; v_closed boolean;
begin
  select current_round, capacity, closed into v_round, v_cap, v_closed
    from public.cc_config where id = 1;

  select count(*) into v_taken
    from public.cc_players where round = v_round and role = 'guest';

  select coalesce(json_agg(json_build_object('name', name, 'role', role, 'slot', slot)
                           order by joined_at), '[]'::json)
    into v_list
    from public.cc_players where round = v_round;

  return json_build_object(
    'ok', true, 'round', v_round, 'capacity', v_cap, 'closed', v_closed,
    'taken', v_taken, 'full', v_taken >= v_cap, 'players', v_list
  );
end; $$;

create or replace function public.cc_set_closed(p_host_code text, p_closed boolean)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  update public.cc_config set closed = coalesce(p_closed, false) where id = 1;
  return json_build_object('ok', true, 'closed', coalesce(p_closed, false));
end; $$;

/* 비공개일 때는 호스트 코드가 있어야만 들어올 수 있습니다 */
create or replace function public.cc_join(p_device text, p_name text, p_host_code text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_round int; v_cap int; v_code text; v_name text; v_role text;
  v_slot int; v_taken int; v_closed boolean; v_is_host boolean;
  v_exist public.cc_players;
begin
  select current_round, capacity, host_code, closed
    into v_round, v_cap, v_code, v_closed
    from public.cc_config where id = 1;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    return json_build_object('ok', false, 'error', 'no_name');
  end if;
  v_name := left(v_name, 12);
  v_is_host := p_host_code is not null and btrim(p_host_code) = v_code;

  if v_closed and not v_is_host then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  select * into v_exist
    from public.cc_players where round = v_round and device = p_device;
  if found then
    if exists (select 1 from public.cc_players
                where round = v_round and lower(name) = lower(v_name) and id <> v_exist.id) then
      return json_build_object('ok', false, 'error', 'name_taken');
    end if;
    if v_is_host and v_exist.role <> 'host' then
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

  if v_is_host then
    v_role := 'host';
    v_slot := 0;
  else
    v_role := 'guest';
    select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
    if v_taken >= v_cap then
      return json_build_object('ok', false, 'error', 'full', 'taken', v_taken,
                               'capacity', v_cap, 'round', v_round);
    end if;
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
end; $$;

grant execute on function public.cc_set_closed(text, boolean) to anon, authenticated;


-- ===========================================================
-- 인원 제한 없애기
-- 베타테스트는 호스트가 비공개 모드로 열었다 닫았다 하니까,
-- 자리 수로 막을 필요가 없어졌습니다. capacity 칸은 예전 것과
-- 호환을 위해 남겨두지만 더 이상 쓰지 않아요.
-- ===========================================================

create or replace function public.cc_status()
returns json language plpgsql security definer set search_path = public as $$
declare v_round int; v_taken int; v_list json; v_closed boolean;
begin
  select current_round, closed into v_round, v_closed
    from public.cc_config where id = 1;

  select count(*) into v_taken
    from public.cc_players where round = v_round and role = 'guest';

  select coalesce(json_agg(json_build_object('name', name, 'role', role, 'slot', slot)
                           order by joined_at), '[]'::json)
    into v_list
    from public.cc_players where round = v_round;

  return json_build_object(
    'ok', true, 'round', v_round, 'closed', v_closed,
    'taken', v_taken, 'full', false, 'players', v_list
  );
end; $$;

create or replace function public.cc_join(p_device text, p_name text, p_host_code text default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_round int; v_code text; v_name text; v_role text;
  v_slot int; v_taken int; v_closed boolean; v_is_host boolean;
  v_exist public.cc_players;
begin
  select current_round, host_code, closed
    into v_round, v_code, v_closed
    from public.cc_config where id = 1;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    return json_build_object('ok', false, 'error', 'no_name');
  end if;
  v_name := left(v_name, 12);
  v_is_host := p_host_code is not null and btrim(p_host_code) = v_code;

  /* 비공개일 때는 호스트만 들어옵니다 */
  if v_closed and not v_is_host then
    return json_build_object('ok', false, 'error', 'closed');
  end if;

  /* 같은 기기가 이번 회차에 이미 있으면 그 자리로 돌아갑니다 (새로고침 대응) */
  select * into v_exist
    from public.cc_players where round = v_round and device = p_device;
  if found then
    if exists (select 1 from public.cc_players
                where round = v_round and lower(name) = lower(v_name) and id <> v_exist.id) then
      return json_build_object('ok', false, 'error', 'name_taken');
    end if;
    if v_is_host and v_exist.role <> 'host' then
      update public.cc_players set name = v_name, role = 'host', slot = 0 where id = v_exist.id;
      select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
      return json_build_object('ok', true, 'rejoined', true, 'upgraded', true, 'name', v_name,
                               'role', 'host', 'slot', 0, 'round', v_round, 'taken', v_taken);
    end if;
    update public.cc_players set name = v_name where id = v_exist.id;
    select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
    return json_build_object('ok', true, 'rejoined', true, 'name', v_name, 'role', v_exist.role,
                             'slot', v_exist.slot, 'round', v_round, 'taken', v_taken);
  end if;

  if v_is_host then
    v_role := 'host';
    v_slot := 0;
  else
    v_role := 'guest';
    select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
    /* 비어 있는 가장 작은 슬롯. 사람이 n 명이면 1..n+1 안에 반드시 빈 칸이 있습니다 */
    select min(s) into v_slot
      from generate_series(1, v_taken + 1) as s
     where not exists (select 1 from public.cc_players
                        where round = v_round and role = 'guest' and slot = s);
  end if;

  if exists (select 1 from public.cc_players where round = v_round and lower(name) = lower(v_name)) then
    return json_build_object('ok', false, 'error', 'name_taken');
  end if;

  insert into public.cc_players (round, device, name, role, slot)
    values (v_round, p_device, v_name, v_role, v_slot);

  select count(*) into v_taken from public.cc_players where round = v_round and role = 'guest';
  return json_build_object('ok', true, 'name', v_name, 'role', v_role, 'slot', v_slot,
                           'round', v_round, 'taken', v_taken);
end; $$;

grant execute on function public.cc_status() to anon, authenticated;
grant execute on function public.cc_join(text, text, text) to anon, authenticated;


-- ===========================================================
-- 👗 캐릭터 이미지 (스킨)
-- 호스트가 사진을 올리면 구름옷가게 '얼굴' 칸에 나타나고,
-- 별로 사면 그 사람 캐릭터가 그 사진으로 바뀝니다.
-- 사진은 퀴즈 이미지처럼 줄여서 base64 로 그대로 담습니다.
-- ===========================================================

create table if not exists public.cc_skins (
  id      bigserial primary key,
  name    text not null,
  image   text not null,
  price   int  not null default 3,
  made_at timestamptz not null default now()
);
alter table public.cc_skins enable row level security;

create or replace function public.cc_skin_list()
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(json_build_object(
           'id', id, 'name', name, 'image', image, 'price', price) order by id), '[]'::json)
    into v from public.cc_skins;
  return v;
end; $$;

create or replace function public.cc_skin_add(p_host_code text, p_name text, p_image text, p_price int)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id bigint;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  if coalesce(btrim(p_name), '') = '' or coalesce(p_image, '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if length(p_image) > 900000 then
    return json_build_object('ok', false, 'error', 'too_big');
  end if;
  insert into public.cc_skins (name, image, price)
    values (left(btrim(p_name), 16), p_image, greatest(0, least(99, coalesce(p_price, 3))))
    returning id into v_id;
  return json_build_object('ok', true, 'id', v_id);
end; $$;

create or replace function public.cc_skin_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_skins where id = p_id;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.cc_skin_list()                        to anon, authenticated;
grant execute on function public.cc_skin_add(text, text, text, int)    to anon, authenticated;
grant execute on function public.cc_skin_del(text, bigint)             to anon, authenticated;


-- ===========================================================
-- 📮 구름옷가게 우체통
-- "생겼으면 하는 캐릭터를 적어주세요!" 에 적은 것을 회차별로 남깁니다.
-- ===========================================================

create table if not exists public.cc_wishes (
  id      bigserial primary key,
  round   int  not null,
  name    text not null,
  body    text not null,
  made_at timestamptz not null default now()
);
create index if not exists cc_wishes_round_idx on public.cc_wishes (round);
alter table public.cc_wishes enable row level security;

create or replace function public.cc_wish_add(p_round int, p_name text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare v_body text; v_name text; v_n int;
begin
  v_body := btrim(coalesce(p_body, ''));
  v_name := btrim(coalesce(p_name, ''));
  if v_body = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if v_name = '' then v_name := '손님'; end if;

  /* 한 회차에 너무 많이 쌓이지 않게 */
  select count(*) into v_n from public.cc_wishes where round = coalesce(p_round, 0);
  if v_n >= 300 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  insert into public.cc_wishes (round, name, body)
    values (coalesce(p_round, 0), left(v_name, 12), left(v_body, 120));
  return json_build_object('ok', true);
end; $$;

/* p_round 를 안 주면 모든 회차를 봅니다 (호스트가 몰아 보려고) */
create or replace function public.cc_wish_list(p_round int default null)
returns json language plpgsql security definer set search_path = public as $$
declare v json;
begin
  select coalesce(json_agg(x order by x.id desc), '[]'::json) into v
    from (
      select id, round, name, body
        from public.cc_wishes
       where p_round is null or round = p_round
       order by id desc
       limit 300
    ) x;
  return v;
end; $$;

create or replace function public.cc_wish_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_wishes where id = p_id;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.cc_wish_add(int, text, text) to anon, authenticated;
grant execute on function public.cc_wish_list(int)            to anon, authenticated;
grant execute on function public.cc_wish_del(text, bigint)    to anon, authenticated;


-- ===========================================================
-- 📮 피드백 (익명)
-- 투두리스트 아래 우체통으로 들어옵니다. 이름·기기 표식을 남기지
-- 않아서 누가 썼는지 알 수 없습니다. 회차별로 쌓여요.
-- ===========================================================

create table if not exists public.cc_feedback (
  id      bigserial primary key,
  round   int  not null default 0,
  body    text not null,
  made_at timestamptz not null default now()
);
alter table public.cc_feedback enable row level security;

create or replace function public.cc_fb_add(p_round int, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare v_body text; v_n int;
begin
  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  select count(*) into v_n from public.cc_feedback where round = coalesce(p_round, 0);
  if v_n >= 500 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;
  insert into public.cc_feedback (round, body) values (coalesce(p_round, 0), left(v_body, 400));
  return json_build_object('ok', true);
end; $$;

/* 목록은 호스트만 봅니다 (익명이어도 아무나 다 읽게 두진 않아요) */
create or replace function public.cc_fb_list(p_host_code text, p_round int default null)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v json;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  select coalesce(json_agg(x order by x.id desc), '[]'::json) into v
    from (
      select id, round, body, made_at
        from public.cc_feedback
       where p_round is null or round = p_round
       order by id desc
       limit 400
    ) x;
  return json_build_object('ok', true, 'list', v);
end; $$;

create or replace function public.cc_fb_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_feedback where id = p_id;
  return json_build_object('ok', true);
end; $$;

grant execute on function public.cc_fb_add(int, text)        to anon, authenticated;
grant execute on function public.cc_fb_list(text, int)       to anon, authenticated;
grant execute on function public.cc_fb_del(text, bigint)     to anon, authenticated;


-- ===========================================================
-- 🪧 윗동네 팻말 아이디어 (내용은 supabase/feedback.sql 과 같습니다)
-- ===========================================================
create table if not exists public.cc_ideas (
  id bigserial primary key,
  round int not null default 0,
  name text not null,
  body text not null,
  made_at timestamptz not null default now()
);

alter table public.cc_ideas enable row level security;

create or replace function public.cc_idea_add(p_round int, p_name text, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_body text;
  v_name text;
  v_n int;
begin
  v_body := btrim(coalesce(p_body, ''));
  v_name := btrim(coalesce(p_name, ''));
  if v_body = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  if v_name = '' then
    v_name := '손님';
  end if;
  select count(*) into v_n
    from public.cc_ideas
   where round = coalesce(p_round, 0);
  if v_n >= 300 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;
  insert into public.cc_ideas (round, name, body)
    values (coalesce(p_round, 0), left(v_name, 12), left(v_body, 120));
  return json_build_object('ok', true);
end;
$$;

create or replace function public.cc_idea_list(p_round int default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v json;
begin
  select coalesce(json_agg(x order by x.id desc), '[]'::json) into v
    from (
      select id, round, name, body
        from public.cc_ideas
       where p_round is null or round = p_round
       order by id desc
       limit 300
    ) x;
  return v;
end;
$$;

create or replace function public.cc_idea_del(p_host_code text, p_id bigint)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  select host_code into v_code
    from public.cc_config
   where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  delete from public.cc_ideas
   where id = p_id;
  return json_build_object('ok', true);
end;
$$;

grant execute
  on function public.cc_idea_add(int, text, text)
  to anon, authenticated;

grant execute
  on function public.cc_idea_list(int)
  to anon, authenticated;

grant execute
  on function public.cc_idea_del(text, bigint)
  to anon, authenticated;


-- ===========================================================
-- ⏰ 참가자 목록에 들어온 시각 (supabase/feedback.sql 과 같은 내용)
-- ===========================================================
create or replace function public.cc_status()
returns json language plpgsql security definer set search_path = public as $$
declare
  v_round int;
  v_taken int;
  v_list json;
  v_closed boolean;
begin
  select current_round, closed into v_round, v_closed
    from public.cc_config
   where id = 1;

  select count(*) into v_taken
    from public.cc_players
   where round = v_round
     and role = 'guest';

  select coalesce(json_agg(json_build_object(
           'name', name,
           'role', role,
           'slot', slot,
           'joined', joined_at) order by joined_at), '[]'::json)
    into v_list
    from public.cc_players
   where round = v_round;

  return json_build_object(
    'ok', true,
    'round', v_round,
    'closed', v_closed,
    'taken', v_taken,
    'full', false,
    'players', v_list
  );
end;
$$;

grant execute
  on function public.cc_status()
  to anon, authenticated;
