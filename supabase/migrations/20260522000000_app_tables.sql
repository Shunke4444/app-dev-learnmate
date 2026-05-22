-- LearnMate per-user data + RLS
-- Run via Supabase Dashboard -> SQL Editor (paste this file, hit Run).
-- Idempotent: safe to re-run after partial application.

-- ---------------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 2. profiles — mirrors auth.users 1:1, populated by trigger below.
--    Prisma migration 20260521132334_init already created this table without
--    the auth.users FK. We add the FK + name/email defaults here.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. chats + messages
-- ---------------------------------------------------------------------------
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('chat', 'talk')),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chats_user_updated_idx
  on public.chats(user_id, updated_at desc);
create unique index if not exists chats_user_mode_unique
  on public.chats(user_id, mode);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_created_idx
  on public.messages(chat_id, created_at asc);
create index if not exists messages_user_idx
  on public.messages(user_id);

-- ---------------------------------------------------------------------------
-- 4. note_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.note_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default 'General',
  status text not null default 'live' check (status in ('live', 'done', 'saved')),
  transcript text not null default '',
  summary text,
  rewrite text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists note_sessions_user_updated_idx
  on public.note_sessions(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 5. quizzes + quiz_attempts
-- ---------------------------------------------------------------------------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  source_note_id uuid references public.note_sessions(id) on delete set null,
  questions jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists quizzes_user_created_idx
  on public.quizzes(user_id, created_at desc);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  answers integer[] not null,
  score integer not null,
  total integer not null,
  completed_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_completed_idx
  on public.quiz_attempts(user_id, completed_at desc);
create index if not exists quiz_attempts_quiz_idx
  on public.quiz_attempts(quiz_id);

-- ---------------------------------------------------------------------------
-- 6. research_docs
-- ---------------------------------------------------------------------------
create table if not exists public.research_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  text text not null,
  score integer,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_docs_user_updated_idx
  on public.research_docs(user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- 7. updated_at auto-bump trigger
-- ---------------------------------------------------------------------------
create or replace function public.tg_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'chats', 'note_sessions', 'research_docs'] loop
    execute format(
      'drop trigger if exists touch_updated_at on public.%I;
       create trigger touch_updated_at before update on public.%I
         for each row execute function public.tg_touch_updated_at();',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Auto-create profile on new auth.users insert
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.chats         enable row level security;
alter table public.messages      enable row level security;
alter table public.note_sessions enable row level security;
alter table public.quizzes       enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.research_docs enable row level security;

-- profiles: own row only
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- chats, note_sessions, quizzes, quiz_attempts, messages, research_docs: own rows
do $$
declare
  t text;
begin
  foreach t in array array['chats','messages','note_sessions','quizzes','quiz_attempts','research_docs'] loop
    execute format('drop policy if exists "%1$s owner select" on public.%1$I; create policy "%1$s owner select" on public.%1$I for select using (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s owner insert" on public.%1$I; create policy "%1$s owner insert" on public.%1$I for insert with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s owner update" on public.%1$I; create policy "%1$s owner update" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s owner delete" on public.%1$I; create policy "%1$s owner delete" on public.%1$I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. Data API grants for authenticated role
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.chats,
  public.messages,
  public.note_sessions,
  public.quizzes,
  public.quiz_attempts,
  public.research_docs
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
