-- Switch chat auth to anonymous (no fake emails → no bounces/rate limits).
-- Run in Supabase SQL Editor after 001_chat.sql and 002_fix_chat_rls.sql.

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
    nullif(auth.jwt() -> 'user_metadata' ->> 'firebase_uid', '')
  );
$$;

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (id = auth.uid() or firebase_uid = public.current_firebase_uid())
  with check (id = auth.uid());

notify pgrst, 'reload schema';
