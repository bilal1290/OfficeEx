-- Quick fix: add mentioned_uids column for chat @mentions + notifications.
-- Run in Supabase SQL Editor if send fails with "mentioned_uids" schema cache error.
-- For full notifications, run 007_chat_notifications.sql instead.

alter table public.chat_messages
  add column if not exists mentioned_uids text[] not null default '{}';

notify pgrst, 'reload schema';
