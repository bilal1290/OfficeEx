-- Fix: "new row violates row-level security policy for table chat_conversations"
-- Run in Supabase SQL Editor

create or replace function public.current_firebase_uid()
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid text;
begin
  select p.firebase_uid
  into v_uid
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  if v_uid is not null and v_uid <> '' then
    return v_uid;
  end if;

  v_uid := nullif(auth.jwt() -> 'user_metadata' ->> 'firebase_uid', '');
  if v_uid is not null then
    return v_uid;
  end if;

  select nullif(u.raw_user_meta_data ->> 'firebase_uid', '')
  into v_uid
  from auth.users u
  where u.id = auth.uid();

  return v_uid;
end;
$$;

drop policy if exists "conversations insert own" on public.chat_conversations;
create policy "conversations insert own"
  on public.chat_conversations for insert to authenticated
  with check (
    created_by is not null
    and created_by <> ''
    and public.current_firebase_uid() is not null
    and created_by = public.current_firebase_uid()
  );

drop policy if exists "conversation members insert" on public.chat_conversation_members;
create policy "conversation members insert"
  on public.chat_conversation_members for insert to authenticated
  with check (
    public.current_firebase_uid() is not null
    and (
      firebase_uid = public.current_firebase_uid()
      or exists (
        select 1
        from public.chat_conversations c
        where c.id = conversation_id
          and c.created_by = public.current_firebase_uid()
      )
    )
  );

notify pgrst, 'reload schema';
