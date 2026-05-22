-- Fix: signup blocked by NOT NULL profiles.updated_at with no default.
--
-- Symptom: HTTP 500 "Database error saving new user" on auth.users insert.
-- Cause: Prisma init migration (20260521132334) created public.profiles with
--        updated_at NOT NULL but without a DEFAULT. The handle_new_user
--        trigger inserted only (id, email, name), so the row failed the
--        NOT NULL check and the whole auth.users transaction rolled back.
-- Fix:   Add DEFAULT now() to updated_at, and set both timestamps explicitly
--        in handle_new_user so the trigger is independent of column defaults.

alter table public.profiles
  alter column updated_at set default now();

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
  return new;
end;
$function$;
