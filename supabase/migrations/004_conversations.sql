-- Conversations: Everyone group, custom groups, and 1:1 direct messages.
-- Run in Supabase SQL Editor after 001–003.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  name text,
  slug text unique,
  created_by text not null,
  created_at timestamptz not null default now(),
  check (
    (type = 'group' and name is not null)
    or (type = 'direct' and name is null and slug is null)
  )
);

create table if not exists public.chat_conversation_members (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  firebase_uid text not null,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, firebase_uid)
);

create index if not exists chat_conversation_members_uid_idx
  on public.chat_conversation_members (firebase_uid);

alter table public.chat_messages
  add column if not exists conversation_id uuid references public.chat_conversations (id) on delete cascade;

-- Default Everyone group (fixed id for migrations)
insert into public.chat_conversations (id, type, name, slug, created_by)
values (
  '00000000-0000-4000-a800-000000000001',
  'group',
  'Everyone',
  'everyone',
  'system'
)
on conflict (slug) do nothing;

update public.chat_messages
set conversation_id = '00000000-0000-4000-a800-000000000001'
where conversation_id is null;

alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;

grant all on public.chat_conversations to postgres, anon, authenticated, service_role;
grant all on public.chat_conversation_members to postgres, anon, authenticated, service_role;

create or replace function public.is_chat_member(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_conversation_members m
    where m.conversation_id = is_chat_member.conversation_id
      and m.firebase_uid = public.current_firebase_uid()
  );
$$;

drop policy if exists "chat read team" on public.chat_messages;
drop policy if exists "chat insert own" on public.chat_messages;

create policy "chat messages read member"
  on public.chat_messages for select to authenticated
  using (public.is_chat_member(conversation_id));

create policy "chat messages insert member"
  on public.chat_messages for insert to authenticated
  with check (
    public.is_chat_member(conversation_id)
    and sender_id = public.current_firebase_uid()
  );

drop policy if exists "conversations read member" on public.chat_conversations;
create policy "conversations read member"
  on public.chat_conversations for select to authenticated
  using (public.is_chat_member(id));

drop policy if exists "conversations insert own" on public.chat_conversations;
create policy "conversations insert own"
  on public.chat_conversations for insert to authenticated
  with check (created_by = public.current_firebase_uid());

drop policy if exists "conversation members read" on public.chat_conversation_members;
create policy "conversation members read"
  on public.chat_conversation_members for select to authenticated
  using (public.is_chat_member(conversation_id));

drop policy if exists "conversation members insert" on public.chat_conversation_members;
create policy "conversation members insert"
  on public.chat_conversation_members for insert to authenticated
  with check (
    firebase_uid = public.current_firebase_uid()
    or exists (
      select 1
      from public.chat_conversations c
      where c.id = conversation_id
        and c.created_by = public.current_firebase_uid()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_conversations'
  ) then
    alter publication supabase_realtime add table public.chat_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_conversation_members'
  ) then
    alter publication supabase_realtime add table public.chat_conversation_members;
  end if;
end $$;

notify pgrst, 'reload schema';
