-- Director's Board · HHSS — Supabase 스키마 (v2: 관리자 로그인 + 프로젝트별 클라이언트 아이디·비밀번호)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여 넣고 Run.
-- 다시 실행해도 안전하도록(idempotent) 작성했습니다. v1을 실행했던 프로젝트에도 그대로 실행하면 v2로 바뀝니다.
--
-- 접근 모델
--   · 관리자: Supabase Auth(이메일+비밀번호)로 로그인한 사용자 중 public.operators 에 등록된 사람만 모든 권한.
--   · 클라이언트: 프로젝트마다 관리자가 정한 아이디·비밀번호 → rpc/client_login 이 그 프로젝트 전용 토큰을 돌려줌.
--     그 토큰(x-review-token 헤더)으로 그 프로젝트의 주석·댓글만 읽고 쓸 수 있습니다. projects 표는 직접 못 읽습니다.
--   · 비밀번호는 bcrypt 해시로만 저장. 앱/HTML에는 공개 URL과 anon 키만. service_role 키는 어디에도 넣지 않습니다.

create extension if not exists pgcrypto with schema extensions;

-- ---------- 요청 헤더 읽기 ----------
create or replace function public.req_header(name text) returns text
language sql stable as $$
  select coalesce(current_setting('request.headers', true), '{}')::json ->> lower(name)
$$;
grant execute on function public.req_header(text) to anon, authenticated;

-- ---------- 관리자 ----------
create table if not exists public.operators (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.operators enable row level security;   -- 정책 없음 = 앱에서 직접 접근 불가
revoke all on public.operators from anon, authenticated;

create or replace function public.is_operator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.operators where user_id = auth.uid())
$$;
grant execute on function public.is_operator() to anon, authenticated;

-- (v1의 운영자 키 방식 정리)
drop table if exists public.app_config;

-- ---------- 테이블 ----------
create table if not exists public.projects (
  id            uuid primary key,
  title         text not null default '',
  source_kind   text not null check (source_kind in ('youtube','file')),
  youtube_id    text,
  file_name     text,
  file_size     bigint,
  aspect        text,
  fps           numeric,
  review_token  text unique not null,          -- 클라이언트 로그인에 성공하면 받는 토큰 (비밀번호를 바꾸면 새로 만들어짐)
  archived      boolean not null default false, -- 보관 = 클라이언트 로그인 막힘
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.projects add column if not exists client_login   text;
alter table public.projects add column if not exists client_pw_hash text;

create table if not exists public.annotations (
  id          text primary key,
  project_id  uuid not null references public.projects(id) on delete cascade,
  t           numeric not null,
  x           numeric,
  y           numeric,
  text        text not null default '',
  strokes     jsonb not null default '[]'::jsonb,
  thumb       text not null default '',
  verdict     text,
  author      text not null default '',
  rev         integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists annotations_project_idx on public.annotations(project_id, deleted_at, t);

create table if not exists public.comments (
  id             text primary key,
  annotation_id  text not null references public.annotations(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  author         text not null default '',
  text           text not null,
  created_at     timestamptz not null default now()
);
create index if not exists comments_annotation_idx on public.comments(annotation_id);

-- ---------- 클라이언트 토큰 ----------
create or replace function public.has_project_token(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid and not p.archived
      and p.review_token is not null and length(p.review_token) >= 20
      and p.review_token = public.req_header('x-review-token')
  )
$$;
grant execute on function public.has_project_token(uuid) to anon, authenticated;

-- 클라이언트 로그인: 맞으면 그 프로젝트 토큰, 틀리면 null (1초 지연으로 무작위 대입을 늦춤)
create or replace function public.client_login(pid uuid, login text, password text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare p public.projects%rowtype;
begin
  select * into p from public.projects where id = pid;
  if not found or p.archived or p.client_pw_hash is null or p.client_login is null
     or lower(trim(coalesce(login, ''))) <> lower(p.client_login)
     or extensions.crypt(coalesce(password, ''), p.client_pw_hash) <> p.client_pw_hash then
    perform pg_sleep(1);
    return null;
  end if;
  return p.review_token;
end $$;
grant execute on function public.client_login(uuid, text, text) to anon, authenticated;

-- 로그인한 클라이언트가 볼 프로젝트 정보 (토큰 헤더가 맞을 때만)
create or replace function public.client_project(pid uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', id, 'title', title, 'source_kind', source_kind, 'youtube_id', youtube_id,
                           'file_name', file_name, 'file_size', file_size, 'aspect', aspect, 'fps', fps)
  from public.projects where id = pid and public.has_project_token(pid)
$$;
grant execute on function public.client_project(uuid) to anon, authenticated;

-- 관리자: 클라이언트 아이디·비밀번호 설정/재설정 (토큰도 새로 만들어 기존 로그인을 끊음)
create or replace function public.set_client_credentials(pid uuid, login text, password text) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if not public.is_operator() then raise exception '관리자만 할 수 있어요' using errcode = '42501'; end if;
  if length(trim(coalesce(login, ''))) < 2 or length(coalesce(password, '')) < 4 then
    raise exception '아이디 2자, 비밀번호 4자 이상' using errcode = '22023';
  end if;
  update public.projects
     set client_login = trim(login),
         client_pw_hash = extensions.crypt(password, extensions.gen_salt('bf')),
         review_token = encode(extensions.gen_random_bytes(30), 'hex'),
         updated_at = now()
   where id = pid;
end $$;
revoke execute on function public.set_client_credentials(uuid, text, text) from public, anon;
grant execute on function public.set_client_credentials(uuid, text, text) to authenticated;

-- ---------- RLS ----------
alter table public.projects    enable row level security;
alter table public.annotations enable row level security;
alter table public.comments    enable row level security;

drop policy if exists projects_select on public.projects;
drop policy if exists projects_write on public.projects;
drop policy if exists projects_operator on public.projects;
create policy projects_operator on public.projects for all to authenticated
  using (public.is_operator()) with check (public.is_operator());

drop policy if exists annotations_rw on public.annotations;
create policy annotations_rw on public.annotations for all to anon, authenticated
  using (public.is_operator() or public.has_project_token(project_id))
  with check (public.is_operator() or public.has_project_token(project_id));

drop policy if exists comments_rw on public.comments;
create policy comments_rw on public.comments for all to anon, authenticated
  using (public.is_operator() or public.has_project_token(project_id))
  with check (public.is_operator() or public.has_project_token(project_id));

grant usage on schema public to anon, authenticated;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.annotations, public.comments to anon, authenticated;

-- ---------- 크기 제한 ----------
alter table public.annotations drop constraint if exists annotations_thumb_size;
alter table public.annotations add constraint annotations_thumb_size check (length(thumb) <= 1200000);
alter table public.annotations drop constraint if exists annotations_text_size;
alter table public.annotations add constraint annotations_text_size check (length(text) <= 20000);

-- ---------- 관리자 등록 (SETUP.md 1-3) ----------
-- 1) Authentication → Users → Add user → Create new user 에서 이메일(예: 아이디@hhss.studio)과 비밀번호를 넣고 'Auto Confirm User' 체크.
-- 2) 아래의 이메일을 바꿔서 실행:
-- insert into public.operators(user_id)
--   select id from auth.users where email = '아이디@hhss.studio'
--   on conflict do nothing;
