-- 📮 피드백(익명) + 🪧 윗동네 팻말 아이디어
-- 이 파일을 통째로 복사해서
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다.

create table if not exists public.cc_feedback (
  id bigserial primary key,
  round int not null default 0,
  body text not null,
  made_at timestamptz not null default now()
);

alter table public.cc_feedback enable row level security;

create or replace function public.cc_fb_add(p_round int, p_body text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_body text;
  v_n int;
begin
  v_body := btrim(coalesce(p_body, ''));
  if v_body = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  select count(*) into v_n
    from public.cc_feedback
   where round = coalesce(p_round, 0);
  if v_n >= 500 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;
  insert into public.cc_feedback (round, body)
    values (coalesce(p_round, 0), left(v_body, 400));
  return json_build_object('ok', true);
end;
$$;

create or replace function public.cc_fb_list(p_host_code text, p_round int default null)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v json;
begin
  select host_code into v_code
    from public.cc_config
   where id = 1;
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
end;
$$;

create or replace function public.cc_fb_del(p_host_code text, p_id bigint)
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
  delete from public.cc_feedback
   where id = p_id;
  return json_build_object('ok', true);
end;
$$;

grant execute
  on function public.cc_fb_add(int, text)
  to anon, authenticated;

grant execute
  on function public.cc_fb_list(text, int)
  to anon, authenticated;

grant execute
  on function public.cc_fb_del(text, bigint)
  to anon, authenticated;


-- 🪧 윗동네 팻말 — "여기 뭐 만들지..?"

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


-- ⏰ 참가자 목록에 들어온 시각 추가 (호스트 패널에서 씁니다)

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


-- 🎬 영화관 — 아무나 틀 수 있고, 트는 순간 끝날 때까지 다 같이 봅니다.
-- 지금 트는 중이면 서버가 새 재생을 막습니다 (클라이언트를 고쳐도 못 바꿔요).

create table if not exists public.cc_movie (
  id int primary key default 1,
  path text,
  title text,
  secs int not null default 0,
  by_name text,
  started_at timestamptz,
  constraint cc_movie_one_row check (id = 1)
);

insert into public.cc_movie (id) values (1) on conflict (id) do nothing;

alter table public.cc_movie enable row level security;

create or replace function public.cc_movie_now()
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.cc_movie;
  v_left numeric;
begin
  select * into m from public.cc_movie where id = 1;
  if m.started_at is null or m.path is null then
    return json_build_object('ok', true, 'playing', false, 'now', now());
  end if;
  v_left := m.secs - extract(epoch from (now() - m.started_at));
  if v_left <= 0 then
    return json_build_object('ok', true, 'playing', false, 'now', now());
  end if;
  return json_build_object(
    'ok', true,
    'playing', true,
    'path', m.path,
    'title', m.title,
    'secs', m.secs,
    'by', m.by_name,
    'at', extract(epoch from (now() - m.started_at)),
    'now', now()
  );
end;
$$;

create or replace function public.cc_movie_play(p_path text, p_title text, p_secs int, p_by text)
returns json language plpgsql security definer set search_path = public as $$
declare
  m public.cc_movie;
  v_left numeric;
begin
  if coalesce(btrim(p_path), '') = '' then
    return json_build_object('ok', false, 'error', 'empty');
  end if;
  select * into m from public.cc_movie where id = 1 for update;
  if m.started_at is not null then
    v_left := m.secs - extract(epoch from (now() - m.started_at));
    if v_left > 0 then
      return json_build_object('ok', false, 'error', 'busy',
                               'title', m.title, 'left', ceil(v_left));
    end if;
  end if;
  update public.cc_movie
     set path = p_path,
         title = left(coalesce(p_title, ''), 40),
         secs = greatest(1, least(7200, coalesce(p_secs, 0))),
         by_name = left(coalesce(p_by, ''), 12),
         started_at = now()
   where id = 1;
  return json_build_object('ok', true);
end;
$$;

create or replace function public.cc_movie_stop(p_host_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  select host_code into v_code from public.cc_config where id = 1;
  if p_host_code is null or btrim(p_host_code) <> v_code then
    return json_build_object('ok', false, 'error', 'bad_code');
  end if;
  update public.cc_movie
     set started_at = null, path = null, title = null, secs = 0
   where id = 1;
  return json_build_object('ok', true);
end;
$$;

grant execute
  on function public.cc_movie_now()
  to anon, authenticated;

grant execute
  on function public.cc_movie_play(text, text, int, text)
  to anon, authenticated;

grant execute
  on function public.cc_movie_stop(text)
  to anon, authenticated;


-- 🏆 미니게임 랭킹 — 영구 저장

create table if not exists public.cc_scores (
  id bigserial primary key,
  game text not null,
  name text not null,
  score int not null,
  made_at timestamptz not null default now()
);

alter table public.cc_scores enable row level security;

create or replace function public.cc_score_add(p_game text, p_name text, p_score int)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if p_game not in ('fart', 'type', 'speed') then
    return json_build_object('ok', false, 'error', 'bad_game');
  end if;
  if p_score is null or p_score < 0 or p_score > 999999 then
    return json_build_object('ok', false, 'error', 'bad_score');
  end if;
  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    v_name := '손님';
  end if;
  insert into public.cc_scores (game, name, score)
    values (p_game, left(v_name, 12), p_score);
  return json_build_object('ok', true);
end;
$$;

/* 낮을수록 좋은 게임(속도)은 오름차순으로 줍니다 */
create or replace function public.cc_score_top(p_game text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v json;
begin
  if p_game = 'speed' then
    select coalesce(json_agg(x order by x.score, x.made_at), '[]'::json) into v
      from (
        select name, score, made_at
          from public.cc_scores
         where game = p_game
         order by score, made_at
         limit 20
      ) x;
  else
    select coalesce(json_agg(x order by x.score desc, x.made_at), '[]'::json) into v
      from (
        select name, score, made_at
          from public.cc_scores
         where game = p_game
         order by score desc, made_at
         limit 20
      ) x;
  end if;
  return v;
end;
$$;

grant execute
  on function public.cc_score_add(text, text, int)
  to anon, authenticated;

grant execute
  on function public.cc_score_top(text)
  to anon, authenticated;


-- 📦 보관함 용량 늘리기 — 영상을 넣으려면 20MB 로는 모자랍니다

update storage.buckets
   set file_size_limit = 62914560,
       public = true
 where id = 'music';
