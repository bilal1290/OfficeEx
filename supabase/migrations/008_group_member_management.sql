-- Allow group members to be added/removed from custom groups (not Everyone).
-- Run in Supabase SQL Editor after 001–007.

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
      or exists (
        select 1
        from public.chat_conversations c
        where c.id = conversation_id
          and c.type = 'group'
          and c.slug is distinct from 'everyone'
          and public.is_chat_member(conversation_id)
      )
    )
  );

drop policy if exists "conversation members delete" on public.chat_conversation_members;
create policy "conversation members delete"
  on public.chat_conversation_members for delete to authenticated
  using (
    public.current_firebase_uid() is not null
    and exists (
      select 1
      from public.chat_conversations c
      where c.id = conversation_id
        and c.type = 'group'
        and c.slug is distinct from 'everyone'
    )
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
