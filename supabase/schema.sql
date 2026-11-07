-- Director's Board · HHSS — Supabase 스키마 (v1)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여 넣고 Run.
-- 다시 실행해도 안전하도록(idempotent) 작성했습니다.
--
-- 접근 모델
--   · 앱은 공개 anon 키로만 접속합니다. 로그인 없음.
--   · 운영자: 요청 헤더 x-operator-key 가 app_config 의 해시와 맞으면 모든 권한.
--   · 클라이언트: 요청 헤더 x-review-token 이 projects.review_token 과 같은 프로젝트의
--     주석·댓글만 읽고 쓸 수 있습니다. (토큰은 프로젝트 하나에만 유효)
--   · 운영자 키·service_role 키는 어떤 HTML/저장소에도 넣지 않습니다.

create extension if not exists pgcrypto with schema extensions;

-- ---------- 비밀 설정 (anon 이 직접 읽을 수 없음) ----------
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
revoke all on public.app_config from anon, authenticated;
alter table public.app_config enable row level security;  -- 정책 없음 = 아무도 직접 접근 불가 (security definer 함수만 읽음)

-- ---------- 요청 헤더 읽기 ----------
create or replace function public.req_header(name text) returns text
language sql stable as $$
  select coalesce(current_setting('request.headers', true), '{}')::json ->> lower(name)
$$;

-- 운영자 여부: x-operator-key 를 저장된 bcrypt 해시와 비교
create or replace function public.is_operator() returns boolean
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  provided text := public.req_header('x-operator-key');
  stored   text;
begin
  if provided is null or length(provided) < 8 then return false; end if;
  select value into stored from public.app_config where key = 'operator_key_hash';
  if stored is null then return false; end if;
  return extensions.crypt(provided, stored) = stored;
end $$;
grant execute on function public.is_operator() to anon, authenticated;
grant execute on function public.req_header(text) to anon, authenticated;

-- 클라이언트 토큰이 이 프로젝트의 것인지
create or replace function public.has_project_token(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.id = pid
      and p.review_token is not null
      and length(p.review_token) >= 20
      and p.review_token = public.req_header('x-review-token')
  )
$$;
grant execute on function public.has_project_token(uuid) to anon, authenticated;

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
  review_token  text unique not null,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.annotations (
  id          text primary key,                       -- 앱이 만든 안정적인 id (m + base36)
  project_id  uuid not null references public.projects(id) on delete cascade,
  t           numeric not null,                       -- 초
  x           numeric,                                -- 영상 그림 영역 기준 % (포인트 없음 = null)
  y           numeric,
  text        text not null default '',
  strokes     jsonb not null default '[]'::jsonb,     -- 그림 획 [[ [x,y], ... ], ...] (%)
  thumb       text not null default '',               -- data:image/jpeg;base64,... (1280px)
  verdict     text,                                   -- 예약: 컷 판정
  author      text not null default '',
  rev         integer not null default 0,             -- 수정 번호(큰 쪽이 이김)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                             -- soft delete
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

-- ---------- RLS ----------
alter table public.projects    enable row level security;
alter table public.annotations enable row level security;
alter table public.comments    enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to anon, authenticated
  using (public.is_operator() or review_token = public.req_header('x-review-token'));
drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects for all to anon, authenticated
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
grant select, insert, update, delete on public.projects, public.annotations, public.comments to anon, authenticated;

-- ---------- 크기 제한 (썸네일 폭주 방지) ----------
alter table public.annotations drop constraint if exists annotations_thumb_size;
alter table public.annotations add constraint annotations_thumb_size check (length(thumb) <= 1200000);  -- 약 1.2MB
alter table public.annotations drop constraint if exists annotations_text_size;
alter table public.annotations add constraint annotations_text_size check (length(text) <= 20000);

-- ---------- 운영자 키 설정 ----------
-- 아래 한 줄의 '여기에-운영자-키' 를 본인이 정한 긴 문자열(20자 이상 권장)로 바꿔 실행하세요.
-- 앱의 서버 설정 → 운영자 키 칸에 같은 값을 넣습니다. (해시만 저장되므로 잊어버리면 다시 설정)
-- insert into public.app_config(key, value)
--   values ('operator_key_hash', extensions.crypt('여기에-운영자-키', extensions.gen_salt('bf')))
--   on conflict (key) do update set value = excluded.value;
