-- OfficeEx Chat — full Supabase setup (run once in SQL Editor)
-- Project: mrspndxusvczftygqjez
-- Firebase = login & expenses | Supabase = chat only
-- Also enable: Authentication → Providers → Anonymous → ON

create extension if not exists "pgcrypto";

-- ── Profiles ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  firebase_uid text not null unique,
  display_name text not null default 'User',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Conversations (Everyone, groups, 1:1) ───────────────────────────────────

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

-- Default Everyone group
insert into public.chat_conversations (id, type, name, slug, created_by)
values (
  '00000000-0000-4000-a800-000000000001',
  'group',
  'Everyone',
  'everyone',
  'system'
)
on conflict (slug) do nothing;

-- ── Messages ────────────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id text not null,
  sender_name text not null,
  text text not null check (char_length(trim(text)) > 0),
  created_at timestamptz not null default now()
);

alter table public.chat_messages
  add column if not exists conversation_id uuid references public.chat_conversations (id) on delete cascade;

update public.chat_messages
set conversation_id = '00000000-0000-4000-a800-000000000001'
where conversation_id is null;

create index if not exists chat_messages_created_at_idx
  on public.chat_messages (created_at asc);

create index if not exists chat_messages_conversation_id_idx
  on public.chat_messages (conversation_id, created_at asc);

-- ── Grants ──────────────────────────────────────────────────────────────────

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on public.profiles to postgres, anon, authenticated, service_role;
grant all on public.chat_conversations to postgres, anon, authenticated, service_role;
grant all on public.chat_conversation_members to postgres, anon, authenticated, service_role;
grant all on public.chat_messages to postgres, anon, authenticated, service_role;

-- ── Helpers ─────────────────────────────────────────────────────────────────

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

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_conversation_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "profiles read team" on public.profiles;
create policy "profiles read team"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update to authenticated
  using (id = auth.uid() or firebase_uid = public.current_firebase_uid())
  with check (id = auth.uid());

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

drop policy if exists "conversations insert own" on public.chat_conversations;
create policy "conversations insert own"
  on public.chat_conversations for insert to authenticated
  with check (
    created_by is not null
    and created_by <> ''
    and public.current_firebase_uid() is not null
    and created_by = public.current_firebase_uid()
  );

drop policy if exists "conversation members read" on public.chat_conversation_members;
create policy "conversation members read"
  on public.chat_conversation_members for select to authenticated
  using (public.is_chat_member(conversation_id));

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

drop policy if exists "chat read team" on public.chat_messages;
drop policy if exists "chat insert own" on public.chat_messages;
drop policy if exists "chat messages read member" on public.chat_messages;
drop policy if exists "chat messages insert member" on public.chat_messages;

create policy "chat messages read member"
  on public.chat_messages for select to authenticated
  using (public.is_chat_member(conversation_id));

create policy "chat messages insert member"
  on public.chat_messages for insert to authenticated
  with check (
    public.is_chat_member(conversation_id)
    and sender_id = public.current_firebase_uid()
  );

-- ── Realtime ────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_conversations'
  ) then
    alter publication supabase_realtime add table public.chat_conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_conversation_members'
  ) then
    alter publication supabase_realtime add table public.chat_conversation_members;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ── Notifications (007) ─────────────────────────────────────────────────────

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
  select type, slug, name into conv from public.chat_conversations where id = new.conversation_id;
  if conv is null then return new; end if;

  preview := left(trim(new.text), 160);

  for member in
    select m.firebase_uid
    from public.chat_conversation_members m
    where m.conversation_id = new.conversation_id and m.firebase_uid <> new.sender_id
  loop
    is_mentioned := public.message_mentions_firebase_uid(new.text, new.mentioned_uids, member.firebase_uid);

    if is_mentioned then
      insert into public.chat_notifications (
        recipient_firebase_uid, conversation_id, message_id, sender_id, sender_name, preview, type
      ) values (
        member.firebase_uid, new.conversation_id, new.id, new.sender_id, new.sender_name, preview, 'mention'
      )
      on conflict (recipient_firebase_uid, message_id) do update
      set type = 'mention', preview = excluded.preview, sender_name = excluded.sender_name;
    elsif conv.type = 'direct' then
      insert into public.chat_notifications (
        recipient_firebase_uid, conversation_id, message_id, sender_id, sender_name, preview, type
      ) values (
        member.firebase_uid, new.conversation_id, new.id, new.sender_id, new.sender_name, preview, 'message'
      )
      on conflict (recipient_firebase_uid, message_id) do nothing;
    elsif conv.type = 'group' and conv.slug is distinct from 'everyone' then
      insert into public.chat_notifications (
        recipient_firebase_uid, conversation_id, message_id, sender_id, sender_name, preview, type
      ) values (
        member.firebase_uid, new.conversation_id, new.id, new.sender_id, new.sender_name, preview, 'message'
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
  for each row execute function public.notify_chat_message();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_notifications'
  ) then
    alter publication supabase_realtime add table public.chat_notifications;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ── Group member management (008) ───────────────────────────────────────────

drop policy if exists "conversation members insert" on public.chat_conversation_members;
create policy "conversation members insert"
  on public.chat_conversation_members for insert to authenticated
  with check (
    public.current_firebase_uid() is not null
    and (
      firebase_uid = public.current_firebase_uid()
      or exists (
        select 1 from public.chat_conversations c
        where c.id = conversation_id and c.created_by = public.current_firebase_uid()
      )
      or exists (
        select 1 from public.chat_conversations c
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
      select 1 from public.chat_conversations c
      where c.id = conversation_id
        and c.type = 'group'
        and c.slug is distinct from 'everyone'
    )
    and (
      firebase_uid = public.current_firebase_uid()
      or exists (
        select 1 from public.chat_conversations c
        where c.id = conversation_id and c.created_by = public.current_firebase_uid()
      )
    )
  );

notify pgrst, 'reload schema';

-- ── Chat moderation (009) ─────────────────────────────────────────────────────

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

-- ── Chat delete RPC (010) ─────────────────────────────────────────────────────

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

-- ── Verify (expect 5 tables) ────────────────────────────────────────────────

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'chat_conversations',
    'chat_conversation_members',
    'chat_messages',
    'chat_notifications'
  )
order by table_name;
