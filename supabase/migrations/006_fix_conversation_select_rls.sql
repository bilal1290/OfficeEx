-- Fix: INSERT ... RETURNING fails because creator cannot SELECT row before joining.
-- Run in Supabase SQL Editor

drop policy if exists "conversations read member" on public.chat_conversations;
create policy "conversations read member"
  on public.chat_conversations for select to authenticated
  using (
    public.is_chat_member(id)
    or (
      public.current_firebase_uid() is not null
      and created_by = public.current_firebase_uid()
    )
  );

notify pgrst, 'reload schema';
