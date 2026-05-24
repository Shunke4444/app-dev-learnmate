-- Full persistence layer: prefs, AI cache, research suggestions, prompt suggestions,
-- attachments, home-history view, user-stats view. Idempotent.

-- ---------------------------------------------------------------------------
-- 1. user_preferences (1 row per user). Migrates settings out of localStorage.
-- ---------------------------------------------------------------------------
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sidebar_collapsed boolean not null default false,
  voice_engine text not null default 'auto' check (voice_engine in ('auto','web-speech','whisper')),
  tts_voice text,
  tts_rate numeric(3,2) not null default 1.00 check (tts_rate between 0.10 and 4.00),
  tts_pitch numeric(3,2) not null default 1.00 check (tts_pitch between 0.00 and 2.00),
  theme text not null default 'dark' check (theme in ('dark','light','system')),
  locale text not null default 'en-US',
  last_seen_at timestamptz,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_preferences_user_idx on public.user_preferences(user_id);

-- ---------------------------------------------------------------------------
-- 2. research_suggestions — persist accept/reject across reloads.
-- ---------------------------------------------------------------------------
create table if not exists public.research_suggestions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.research_docs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('spelling','grammar','clarity','style')),
  original text not null,
  replacement text not null,
  explanation text,
  span_start integer,
  span_end integer,
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists research_suggestions_doc_idx
  on public.research_suggestions(doc_id, status);
create index if not exists research_suggestions_user_idx
  on public.research_suggestions(user_id);

-- ---------------------------------------------------------------------------
-- 3. ai_cache — per-user cross-device cache for stable AI calls.
--    Skips /api/ai/chat (conversational, low repeat). Used for quiz/research/notes ops.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('quiz','research','notes_summarize','notes_rewrite','vision')),
  input_hash text not null,
  model text not null,
  response jsonb not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days')
);
create unique index if not exists ai_cache_lookup_unique
  on public.ai_cache(user_id, kind, input_hash, model);
create index if not exists ai_cache_expires_idx on public.ai_cache(expires_at);

-- Sweep helper. Call from a daily pg_cron job if/when enabled, or from app code.
create or replace function public.purge_expired_ai_cache()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  removed integer;
begin
  with deleted as (
    delete from public.ai_cache where expires_at < now() returning 1
  )
  select count(*) into removed from deleted;
  return coalesce(removed, 0);
end;
$$;

revoke execute on function public.purge_expired_ai_cache() from public;
revoke execute on function public.purge_expired_ai_cache() from anon;

-- ---------------------------------------------------------------------------
-- 4. prompt_suggestions — talk presets + quiz topics + notes prompts.
--    Global rows = user_id null (visible to all authenticated). Per-user rows allowed.
-- ---------------------------------------------------------------------------
create table if not exists public.prompt_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,  -- null = global
  kind text not null check (kind in ('talk','quiz','notes')),
  label text not null,
  pinned boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists prompt_suggestions_kind_idx
  on public.prompt_suggestions(kind, position);
create index if not exists prompt_suggestions_user_idx
  on public.prompt_suggestions(user_id, kind);
create unique index if not exists prompt_suggestions_global_unique
  on public.prompt_suggestions(kind, label) where user_id is null;

-- Seed globals (matches current hardcoded arrays in /talk and /quiz).
insert into public.prompt_suggestions (user_id, kind, label, position)
values
  (null, 'talk', 'Take notes for my class', 0),
  (null, 'talk', 'Quiz me on Python loops', 1),
  (null, 'talk', 'Summarize last lecture', 2),
  (null, 'talk', 'Translate to Spanish', 3),
  (null, 'quiz', 'Python loops & comprehensions', 0),
  (null, 'quiz', 'Photosynthesis basics', 1),
  (null, 'quiz', 'World War II causes', 2),
  (null, 'quiz', 'Mitosis vs meiosis', 3),
  (null, 'quiz', 'Pythagorean theorem', 4),
  (null, 'notes', 'Python class', 0),
  (null, 'notes', 'Calculus lecture', 1),
  (null, 'notes', 'History reading', 2)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. note_attachments — audio files attached to note_sessions.
-- ---------------------------------------------------------------------------
create table if not exists public.note_attachments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.note_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime text not null,
  size_bytes integer not null check (size_bytes >= 0),
  duration_ms integer,
  transcript_status text not null default 'pending'
    check (transcript_status in ('pending','done','failed','skipped')),
  created_at timestamptz not null default now()
);
create index if not exists note_attachments_note_idx on public.note_attachments(note_id);
create index if not exists note_attachments_user_idx on public.note_attachments(user_id);

-- ---------------------------------------------------------------------------
-- 6. research_attachments — PDFs/images attached to research_docs.
-- ---------------------------------------------------------------------------
create table if not exists public.research_attachments (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.research_docs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  mime text not null,
  size_bytes integer not null check (size_bytes >= 0),
  parsed_text text,
  created_at timestamptz not null default now()
);
create index if not exists research_attachments_doc_idx on public.research_attachments(doc_id);
create index if not exists research_attachments_user_idx on public.research_attachments(user_id);

-- ---------------------------------------------------------------------------
-- 7. updated_at trigger on user_preferences.
-- ---------------------------------------------------------------------------
drop trigger if exists touch_updated_at on public.user_preferences;
create trigger touch_updated_at
  before update on public.user_preferences
  for each row execute function public.tg_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 8. Auto-create user_preferences row on profile insert (extends handle_new_user).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, name, created_at, updated_at)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    now(),
    now()
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$function$;

-- Backfill prefs row for any existing users without one.
insert into public.user_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. RLS — owner-only on new tables; prompt_suggestions globals readable by all auth'd.
-- ---------------------------------------------------------------------------
alter table public.user_preferences      enable row level security;
alter table public.research_suggestions  enable row level security;
alter table public.ai_cache              enable row level security;
alter table public.prompt_suggestions    enable row level security;
alter table public.note_attachments      enable row level security;
alter table public.research_attachments  enable row level security;

-- Owner-only on user_preferences (single-row-per-user, key on user_id).
drop policy if exists "user_preferences owner select" on public.user_preferences;
create policy "user_preferences owner select" on public.user_preferences
  for select using (auth.uid() = user_id);
drop policy if exists "user_preferences owner insert" on public.user_preferences;
create policy "user_preferences owner insert" on public.user_preferences
  for insert with check (auth.uid() = user_id);
drop policy if exists "user_preferences owner update" on public.user_preferences;
create policy "user_preferences owner update" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Owner-only CRUD across the rest.
do $$
declare
  t text;
begin
  foreach t in array array[
    'research_suggestions','ai_cache','note_attachments','research_attachments'
  ] loop
    execute format('drop policy if exists "%1$s owner select" on public.%1$I; create policy "%1$s owner select" on public.%1$I for select using (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s owner insert" on public.%1$I; create policy "%1$s owner insert" on public.%1$I for insert with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s owner update" on public.%1$I; create policy "%1$s owner update" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s owner delete" on public.%1$I; create policy "%1$s owner delete" on public.%1$I for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- prompt_suggestions: any authenticated user can read globals + own rows;
-- write/update/delete only on own rows.
drop policy if exists "prompt_suggestions read" on public.prompt_suggestions;
create policy "prompt_suggestions read" on public.prompt_suggestions
  for select using (user_id is null or auth.uid() = user_id);
drop policy if exists "prompt_suggestions owner insert" on public.prompt_suggestions;
create policy "prompt_suggestions owner insert" on public.prompt_suggestions
  for insert with check (auth.uid() = user_id);
drop policy if exists "prompt_suggestions owner update" on public.prompt_suggestions;
create policy "prompt_suggestions owner update" on public.prompt_suggestions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "prompt_suggestions owner delete" on public.prompt_suggestions;
create policy "prompt_suggestions owner delete" on public.prompt_suggestions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 10. Views — home_history + user_stats.
--     SECURITY INVOKER so RLS filters by the calling user.
-- ---------------------------------------------------------------------------
create or replace view public.home_history
with (security_invoker = on) as
select user_id, 'chat'::text as kind, id::text as ref_id, title, updated_at as at
  from public.chats
union all
select user_id, 'note'::text, id::text, title, updated_at
  from public.note_sessions
union all
select user_id, 'quiz'::text, id::text, topic as title, created_at as at
  from public.quizzes
union all
select user_id, 'research'::text, id::text, title, updated_at
  from public.research_docs;

create or replace view public.user_stats
with (security_invoker = on) as
with activity_days as (
  select user_id, date_trunc('day', at)::date as day from (
    select user_id, created_at as at from public.chats
    union all select user_id, created_at from public.note_sessions
    union all select user_id, created_at from public.quizzes
    union all select user_id, completed_at from public.quiz_attempts
    union all select user_id, created_at from public.research_docs
  ) s group by user_id, date_trunc('day', at)::date
),
ranked as (
  select user_id, day,
         day - (row_number() over (partition by user_id order by day desc))::int as grp
  from activity_days
),
streaks as (
  select user_id, grp, count(*) as len, max(day) as last_day
  from ranked group by user_id, grp
),
current_streak as (
  select user_id, len
  from streaks
  where last_day >= (current_date - interval '1 day')::date
)
select
  p.id as user_id,
  (select count(*) from public.chats c where c.user_id = p.id) as chats_count,
  (select count(*) from public.messages m where m.user_id = p.id) as messages_count,
  (select count(*) from public.note_sessions n where n.user_id = p.id) as notes_count,
  (select count(*) from public.quizzes q where q.user_id = p.id) as quizzes_count,
  (select count(*) from public.quiz_attempts a where a.user_id = p.id) as attempts_count,
  (select count(*) from public.research_docs r where r.user_id = p.id) as research_count,
  coalesce((select len from current_streak cs where cs.user_id = p.id limit 1), 0) as streak_days
from public.profiles p;

-- ---------------------------------------------------------------------------
-- 11. Grants for authenticated role.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  public.user_preferences,
  public.research_suggestions,
  public.ai_cache,
  public.prompt_suggestions,
  public.note_attachments,
  public.research_attachments
  to authenticated;
grant select on public.home_history, public.user_stats to authenticated;
grant execute on function public.purge_expired_ai_cache() to authenticated;
