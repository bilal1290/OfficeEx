-- Run in Supabase Dashboard → SQL Editor (chat only; Firebase handles auth & expenses)
-- Project must match VITE_SUPABASE_URL in .env (e.g. mrspndxusvczftygqjez)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  firebase_uid text not null unique,
  display_name text not null default 'User',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  sender_name text not null,
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at asc);

alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;

-- Required so the Supabase API (PostgREST) can read/write these tables
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on public.profiles to postgres, anon, authenticated, service_role;
grant all on public.chat_messages to postgres, anon, authenticated, service_role;

create or replace function public.current_firebase_uid()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select firebase_uid
      from public.profiles
      where id = auth.uid()
      limit 1
    ),
    split_part(
      (select email from auth.users where id = auth.uid()),
      '@',
      1
    )
  );
$$;

drop policy if exists "profiles read team" on public.profiles;
create policy "profiles read team"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "chat read team" on public.chat_messages;
create policy "chat read team"
  on public.chat_messages for select to authenticated using (true);

drop policy if exists "chat insert own" on public.chat_messages;
create policy "chat insert own"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = public.current_firebase_uid()
    and public.current_firebase_uid() is not null
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Verify (should return 2 rows: profiles, chat_messages)
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles', 'chat_messages')
order by table_name;
