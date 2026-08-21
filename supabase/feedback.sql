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
