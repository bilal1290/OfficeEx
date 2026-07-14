-- Run in Supabase SQL Editor if chat insert fails with RLS error.
-- Fixes: sender_id must match Firebase UID from profile OR synthetic auth email.

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

drop policy if exists "chat insert own" on public.chat_messages;
create policy "chat insert own"
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = public.current_firebase_uid()
    and public.current_firebase_uid() is not null
  );

notify pgrst, 'reload schema';
