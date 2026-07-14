-- Chat notifications: DMs, group messages, and @mentions.
-- Run in Supabase SQL Editor after 001–006.

alter table public.chat_messages
  add column if not exists mentioned_uids text[] not null default '{}';

create table if not exists public.chat_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_firebase_uid text not null,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  sender_id text not null,
  sender_name text not null,
  preview text not null,
  type text not null check (type in ('message', 'mention')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_firebase_uid, message_id)
);

create index if not exists chat_notifications_recipient_idx
  on public.chat_notifications (recipient_firebase_uid, created_at desc);

create index if not exists chat_notifications_unread_idx
  on public.chat_notifications (recipient_firebase_uid)
  where read_at is null;

alter table public.chat_notifications enable row level security;

grant all on public.chat_notifications to postgres, anon, authenticated, service_role;

drop policy if exists "chat notifications read own" on public.chat_notifications;
create policy "chat notifications read own"
  on public.chat_notifications for select to authenticated
  using (recipient_firebase_uid = public.current_firebase_uid());

drop policy if exists "chat notifications update own" on public.chat_notifications;
create policy "chat notifications update own"
  on public.chat_notifications for update to authenticated
  using (recipient_firebase_uid = public.current_firebase_uid())
  with check (recipient_firebase_uid = public.current_firebase_uid());

create or replace function public.message_mentions_firebase_uid(
  message_text text,
  mentioned_uids text[],
  recipient_uid text
)
returns boolean
language sql
stable
as $$
  select
    recipient_uid = any(coalesce(mentioned_uids, '{}'))
    or exists (
      select 1
      from public.profiles p
      where p.firebase_uid = recipient_uid
        and (
          message_text like '%@' || p.display_name || ' %'
          or message_text like '%@' || p.display_name
        )
    );
$$;

create or replace function public.notify_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv record;
  member record;
  is_mentioned boolean;
  preview text;
begin
  select type, slug, name
  into conv
  from public.chat_conversations
  where id = new.conversation_id;

  if conv is null then
    return new;
  end if;

  preview := left(trim(new.text), 160);

  for member in
    select m.firebase_uid
    from public.chat_conversation_members m
    where m.conversation_id = new.conversation_id
      and m.firebase_uid <> new.sender_id
  loop
    is_mentioned := public.message_mentions_firebase_uid(
      new.text,
      new.mentioned_uids,
      member.firebase_uid
    );

    if is_mentioned then
      insert into public.chat_notifications (
        recipient_firebase_uid,
        conversation_id,
        message_id,
        sender_id,
        sender_name,
        preview,
        type
      )
      values (
        member.firebase_uid,
        new.conversation_id,
        new.id,
        new.sender_id,
        new.sender_name,
        preview,
        'mention'
      )
      on conflict (recipient_firebase_uid, message_id) do update
      set type = 'mention',
          preview = excluded.preview,
          sender_name = excluded.sender_name;
    elsif conv.type = 'direct' then
      insert into public.chat_notifications (
        recipient_firebase_uid,
        conversation_id,
        message_id,
        sender_id,
        sender_name,
        preview,
        type
      )
      values (
        member.firebase_uid,
        new.conversation_id,
        new.id,
        new.sender_id,
        new.sender_name,
        preview,
        'message'
      )
      on conflict (recipient_firebase_uid, message_id) do nothing;
    elsif conv.type = 'group' and conv.slug is distinct from 'everyone' then
      insert into public.chat_notifications (
        recipient_firebase_uid,
        conversation_id,
        message_id,
        sender_id,
        sender_name,
        preview,
        type
      )
      values (
        member.firebase_uid,
        new.conversation_id,
        new.id,
        new.sender_id,
        new.sender_name,
        preview,
        'message'
      )
      on conflict (recipient_firebase_uid, message_id) do nothing;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists chat_messages_notify on public.chat_messages;
create trigger chat_messages_notify
  after insert on public.chat_messages
  for each row
  execute function public.notify_chat_message();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_notifications'
  ) then
    alter publication supabase_realtime add table public.chat_notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
