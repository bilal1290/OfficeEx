-- Reliable chat delete via RPC (works even when direct table DELETE policies are missing).
-- Run in Supabase SQL Editor after 001–009.

-- Policies (safe to re-run)
drop policy if exists "chat messages delete member" on public.chat_messages;
create policy "chat messages delete member"
  on public.chat_messages for delete to authenticated
  using (public.is_chat_member(conversation_id));

drop policy if exists "conversation members delete" on public.chat_conversation_members;
create policy "conversation members delete"
  on public.chat_conversation_members for delete to authenticated
  using (
    public.current_firebase_uid() is not null
    and public.is_chat_member(conversation_id)
  );

create or replace function public.delete_chat_message(
  p_message_id uuid,
  p_conversation_id uuid
)
returns void
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

  if not public.is_chat_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation';
  end if;

  delete from public.chat_messages
  where id = p_message_id
    and conversation_id = p_conversation_id;

  get diagnostics removed_count = row_count;

  if removed_count = 0 then
    raise exception 'Message not found';
  end if;
end;
$$;

create or replace function public.remove_chat_member(
  p_conversation_id uuid,
  p_target_firebase_uid text
)
returns void
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

  if p_target_firebase_uid is null or length(trim(p_target_firebase_uid)) = 0 then
    raise exception 'Target user is required';
  end if;

  if not public.is_chat_member(p_conversation_id) then
    raise exception 'You are not a member of this conversation';
  end if;

  if not exists (
    select 1
    from public.chat_conversation_members m
    where m.conversation_id = p_conversation_id
      and m.firebase_uid = p_target_firebase_uid
  ) then
    raise exception 'User is not in this conversation';
  end if;

  delete from public.chat_conversation_members
  where conversation_id = p_conversation_id
    and firebase_uid = p_target_firebase_uid;

  get diagnostics removed_count = row_count;

  if removed_count = 0 then
    raise exception 'Could not remove member';
  end if;
end;
$$;

revoke all on function public.delete_chat_message(uuid, uuid) from public;
revoke all on function public.remove_chat_member(uuid, text) from public;
grant execute on function public.delete_chat_message(uuid, uuid) to authenticated;
grant execute on function public.remove_chat_member(uuid, text) to authenticated;

notify pgrst, 'reload schema';
