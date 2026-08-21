-- 📮 피드백 (익명) — 이 파일을 통째로 복사해서
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
