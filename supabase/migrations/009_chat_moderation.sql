-- Chat moderation: delete messages, remove members, revoke access for deleted users.
-- Run in Supabase SQL Editor after 001–008.

-- Any conversation member can delete any message in that conversation.
drop policy if exists "chat messages delete member" on public.chat_messages;
create policy "chat messages delete member"
  on public.chat_messages for delete to authenticated
  using (public.is_chat_member(conversation_id));

-- Any conversation member can remove any other member (including Everyone and DMs).
drop policy if exists "conversation members delete" on public.chat_conversation_members;
create policy "conversation members delete"
  on public.chat_conversation_members for delete to authenticated
  using (
    public.current_firebase_uid() is not null
    and public.is_chat_member(conversation_id)
  );

-- Remove a user from every conversation the caller shares with them (e.g. admin disabling a user).
create or replace function public.revoke_chat_access(target_firebase_uid text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed_count integer;
begin
  if public.current_firebase_uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_firebase_uid is null or length(trim(target_firebase_uid)) = 0 then
    raise exception 'Target user is required';
  end if;

  if target_firebase_uid = public.current_firebase_uid() then
    raise exception 'Use leave conversation instead of revoking yourself';
  end if;

  delete from public.chat_conversation_members m
  where m.firebase_uid = target_firebase_uid
    and exists (
      select 1
      from public.chat_conversation_members actor
      where actor.conversation_id = m.conversation_id
        and actor.firebase_uid = public.current_firebase_uid()
    );

  get diagnostics removed_count = row_count;
  return removed_count;
end;
$$;

revoke all on function public.revoke_chat_access(text) from public;
grant execute on function public.revoke_chat_access(text) to authenticated;

notify pgrst, 'reload schema';
