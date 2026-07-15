import { supabase, isSupabaseConfigured } from './supabase';
import { reconnectChatPresenceAfterAuth } from './chat-presence';
import { ensureSupabaseChatProfile, syncSupabaseChatFromFirebase } from './supabase-auth';
import { generateId } from './utils';
import type { ChatConversation, ChatMessage } from '../types';

export const EVERYONE_CONVERSATION_ID = '00000000-0000-4000-a800-000000000001';
export const EVERYONE_SLUG = 'everyone';
export const CHAT_MESSAGE_PAGE_SIZE = 50;
export const CHAT_MESSAGE_INITIAL_LIMIT = 500;

export type ChatConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

function mapMessage(row: {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function mapConversation(
  row: {
    id: string;
    type: 'direct' | 'group';
    name: string | null;
    slug: string | null;
    created_by: string;
    created_at: string;
  },
  memberIds: string[],
): ChatConversation {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    slug: row.slug,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).getTime(),
    memberIds,
  };
}

export function isSupabaseChatReady(): boolean {
  return isSupabaseConfigured;
}

export async function ensureEveryoneMembership(firebaseUid: string): Promise<string> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data: existing, error: readError } = await supabase
    .from('chat_conversation_members')
    .select('conversation_id')
    .eq('conversation_id', EVERYONE_CONVERSATION_ID)
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  if (!existing) {
    const { error: insertError } = await supabase.from('chat_conversation_members').insert({
      conversation_id: EVERYONE_CONVERSATION_ID,
      firebase_uid: firebaseUid,
    });
    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  return EVERYONE_CONVERSATION_ID;
}

export async function fetchConversations(firebaseUid: string): Promise<ChatConversation[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  await ensureEveryoneMembership(firebaseUid);

  const { data: memberships, error: memberError } = await supabase
    .from('chat_conversation_members')
    .select('conversation_id')
    .eq('firebase_uid', firebaseUid);

  if (memberError) {
    throw new Error(memberError.message);
  }

  const conversationIds = [...new Set((memberships ?? []).map((row) => row.conversation_id))];
  if (conversationIds.length === 0) {
    return [];
  }

  const { data: conversations, error: convError } = await supabase
    .from('chat_conversations')
    .select('id, type, name, slug, created_by, created_at')
    .in('id', conversationIds)
    .order('created_at', { ascending: true });

  if (convError) {
    throw new Error(convError.message);
  }

  const { data: allMembers, error: allMembersError } = await supabase
    .from('chat_conversation_members')
    .select('conversation_id, firebase_uid')
    .in('conversation_id', conversationIds);

  if (allMembersError) {
    throw new Error(allMembersError.message);
  }

  const membersByConversation = new Map<string, string[]>();
  for (const member of allMembers ?? []) {
    const list = membersByConversation.get(member.conversation_id) ?? [];
    list.push(member.firebase_uid);
    membersByConversation.set(member.conversation_id, list);
  }

  return (conversations ?? []).map((row) =>
    mapConversation(row, membersByConversation.get(row.id) ?? []),
  );
}

export async function fetchChatMessages(conversationId: string): Promise<ChatMessage[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_id, sender_name, text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(CHAT_MESSAGE_INITIAL_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapMessage);
}

export async function fetchChatMessagesSince(
  conversationId: string,
  sinceMs: number,
): Promise<ChatMessage[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_id, sender_name, text, created_at')
    .eq('conversation_id', conversationId)
    .gt('created_at', new Date(sinceMs).toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapMessage);
}

export async function fetchChatMessagesBefore(
  conversationId: string,
  beforeMs: number,
  limit = CHAT_MESSAGE_PAGE_SIZE,
): Promise<ChatMessage[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_id, sender_name, text, created_at')
    .eq('conversation_id', conversationId)
    .lt('created_at', new Date(beforeMs).toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reverse().map(mapMessage);
}

export async function fetchRecentMessagesForConversations(
  conversationIds: string[],
  limit = 300,
): Promise<ChatMessage[]> {
  if (!supabase || conversationIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, conversation_id, sender_id, sender_name, text, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapMessage);
}

export function latestMessageByConversation(
  messages: ChatMessage[],
): Map<string, ChatMessage> {
  const map = new Map<string, ChatMessage>();
  for (const message of messages) {
    if (!map.has(message.conversationId)) {
      map.set(message.conversationId, message);
    }
  }
  return map;
}

function isMissingMentionedUidsColumn(error: { message?: string }): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return message.includes('mentioned_uids') && message.includes('schema cache');
}

export async function sendChatMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string,
  mentionedUids: string[] = [],
): Promise<ChatMessage> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message text is required.');
  }

  await ensureSupabaseChatProfile(senderId, senderName);

  const uniqueMentions = [...new Set(mentionedUids.filter(Boolean))];
  const baseRow = {
    conversation_id: conversationId,
    sender_id: senderId,
    sender_name: senderName,
    text: trimmed,
  };

  let result = await supabase
    .from('chat_messages')
    .insert({
      ...baseRow,
      mentioned_uids: uniqueMentions,
    })
    .select('id, conversation_id, sender_id, sender_name, text, created_at')
    .single();

  if (result.error && isMissingMentionedUidsColumn(result.error)) {
    result = await supabase
      .from('chat_messages')
      .insert(baseRow)
      .select('id, conversation_id, sender_id, sender_name, text, created_at')
      .single();
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return mapMessage(result.data);
}

export async function getOrCreateDirectChat(
  myFirebaseUid: string,
  otherFirebaseUid: string,
  myDisplayName: string,
): Promise<ChatConversation> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  if (myFirebaseUid === otherFirebaseUid) {
    throw new Error('You cannot start a chat with yourself.');
  }

  await ensureSupabaseChatProfile(myFirebaseUid, myDisplayName);
  await ensureEveryoneMembership(myFirebaseUid);

  const conversations = await fetchConversations(myFirebaseUid);
  const existing = conversations.find(
    (conversation) =>
      conversation.type === 'direct' &&
      conversation.memberIds.includes(otherFirebaseUid) &&
      conversation.memberIds.includes(myFirebaseUid),
  );

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from('chat_conversations')
    .insert({
      type: 'direct',
      created_by: myFirebaseUid,
    })
    .select('id, type, name, slug, created_by, created_at')
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const { error: membersError } = await supabase.from('chat_conversation_members').insert([
    { conversation_id: created.id, firebase_uid: myFirebaseUid },
    { conversation_id: created.id, firebase_uid: otherFirebaseUid },
  ]);

  if (membersError) {
    throw new Error(membersError.message);
  }

  return mapConversation(created, [myFirebaseUid, otherFirebaseUid]);
}

export async function createGroupChat(
  name: string,
  creatorFirebaseUid: string,
  memberFirebaseUids: string[],
  creatorDisplayName: string,
): Promise<ChatConversation> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Group name is required.');
  }

  const uniqueMembers = [...new Set([creatorFirebaseUid, ...memberFirebaseUids])];
  if (uniqueMembers.length < 2) {
    throw new Error('Pick at least one other person for the group.');
  }

  await ensureSupabaseChatProfile(creatorFirebaseUid, creatorDisplayName);

  const { data: created, error: createError } = await supabase
    .from('chat_conversations')
    .insert({
      type: 'group',
      name: trimmedName,
      created_by: creatorFirebaseUid,
    })
    .select('id, type, name, slug, created_by, created_at')
    .single();

  if (createError) {
    throw new Error(createError.message);
  }

  const { error: membersError } = await supabase.from('chat_conversation_members').insert(
    uniqueMembers.map((firebaseUid) => ({
      conversation_id: created.id,
      firebase_uid: firebaseUid,
    })),
  );

  if (membersError) {
    throw new Error(membersError.message);
  }

  return mapConversation(created, uniqueMembers);
}

export function isEditableGroup(conversation: ChatConversation): boolean {
  return (
    conversation.type === 'group' &&
    conversation.slug !== EVERYONE_SLUG &&
    conversation.slug !== 'everyone'
  );
}

export function canRemoveGroupMember(
  conversation: ChatConversation,
  actorFirebaseUid: string,
  targetFirebaseUid: string,
): boolean {
  if (!isEditableGroup(conversation)) return false;
  if (!conversation.memberIds.includes(actorFirebaseUid)) return false;
  if (targetFirebaseUid === actorFirebaseUid) return true;
  return conversation.createdBy === actorFirebaseUid;
}

async function getGroupConversation(conversationId: string): Promise<ChatConversation> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('chat_conversations')
    .select('id, type, name, slug, created_by, created_at')
    .eq('id', conversationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const { data: members, error: membersError } = await supabase
    .from('chat_conversation_members')
    .select('firebase_uid')
    .eq('conversation_id', conversationId);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const conversation = mapConversation(
    data,
    (members ?? []).map((row) => row.firebase_uid),
  );

  if (!isEditableGroup(conversation)) {
    throw new Error('Members can only be changed in custom groups.');
  }

  return conversation;
}

export async function addGroupMembers(
  conversationId: string,
  actorFirebaseUid: string,
  memberFirebaseUids: string[],
): Promise<ChatConversation> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const conversation = await getGroupConversation(conversationId);
  if (!conversation.memberIds.includes(actorFirebaseUid)) {
    throw new Error('You are not a member of this group.');
  }

  const toAdd = [...new Set(memberFirebaseUids.filter(Boolean))].filter(
    (uid) => !conversation.memberIds.includes(uid),
  );

  if (toAdd.length === 0) {
    return conversation;
  }

  const { error } = await supabase.from('chat_conversation_members').insert(
    toAdd.map((firebaseUid) => ({
      conversation_id: conversationId,
      firebase_uid: firebaseUid,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }

  return {
    ...conversation,
    memberIds: [...conversation.memberIds, ...toAdd],
  };
}

export async function removeGroupMember(
  conversationId: string,
  actorFirebaseUid: string,
  targetFirebaseUid: string,
): Promise<ChatConversation | null> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const conversation = await getGroupConversation(conversationId);
  if (!canRemoveGroupMember(conversation, actorFirebaseUid, targetFirebaseUid)) {
    throw new Error('You cannot remove this member.');
  }

  if (!conversation.memberIds.includes(targetFirebaseUid)) {
    return conversation;
  }

  if (conversation.memberIds.length <= 2 && targetFirebaseUid !== actorFirebaseUid) {
    throw new Error('A group must keep at least two members.');
  }

  const { error } = await supabase
    .from('chat_conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('firebase_uid', targetFirebaseUid);

  if (error) {
    throw new Error(error.message);
  }

  const nextMemberIds = conversation.memberIds.filter((uid) => uid !== targetFirebaseUid);
  if (nextMemberIds.length === 0) {
    return null;
  }

  return {
    ...conversation,
    memberIds: nextMemberIds,
  };
}

type MessageListener = (message: ChatMessage) => void;
type ResyncListener = (conversationId: string) => void;
type ConnectionListener = (status: ChatConnectionStatus) => void;

const resyncListeners = new Set<ResyncListener>();
const connectionListeners = new Set<ConnectionListener>();
let connectionStatus: ChatConnectionStatus = 'connecting';
let connectionMonitorInitialized = false;
let authReconnectInitialized = false;

function setConnectionStatus(next: ChatConnectionStatus): void {
  if (connectionStatus === next) return;
  connectionStatus = next;
  for (const listener of connectionListeners) {
    listener(next);
  }
}

function getActiveSubscriptions(): ConversationSubscription[] {
  return [...conversationSubscriptions.values()].filter((entry) => entry.listeners.size > 0);
}

function refreshConnectionStatus(): void {
  if (!supabase) {
    setConnectionStatus('connecting');
    return;
  }

  const activeEntries = getActiveSubscriptions();
  if (activeEntries.length === 0) {
    setConnectionStatus('connecting');
    return;
  }

  const subscribedCount = activeEntries.filter((entry) => entry.isSubscribed).length;
  const socketConnected = supabase.realtime.isConnected();

  if (!socketConnected) {
    setConnectionStatus('reconnecting');
    return;
  }

  if (subscribedCount === 0) {
    setConnectionStatus('connecting');
    return;
  }

  if (subscribedCount < activeEntries.length) {
    setConnectionStatus('reconnecting');
    return;
  }

  setConnectionStatus('connected');
}

function ensureChatConnectionMonitor(): void {
  if (!supabase || connectionMonitorInitialized || typeof window === 'undefined') {
    return;
  }

  connectionMonitorInitialized = true;

  window.addEventListener('online', () => {
    if (!supabase) return;
    if (!supabase.realtime.isConnected()) {
      supabase.realtime.connect();
    }
    void reconnectChatRealtimeAfterAuth();
  });

  window.addEventListener('offline', () => {
    for (const entry of conversationSubscriptions.values()) {
      entry.isSubscribed = false;
    }
    refreshConnectionStatus();
  });

  supabase.realtime.onHeartbeat((event) => {
    if (event === 'ok') {
      refreshConnectionStatus();
      return;
    }
    if (event === 'timeout' || event === 'disconnected' || event === 'error') {
      for (const entry of conversationSubscriptions.values()) {
        entry.isSubscribed = false;
      }
      refreshConnectionStatus();
    }
  });
}

function ensureChatAuthReconnect(): void {
  if (!supabase || authReconnectInitialized) {
    return;
  }

  authReconnectInitialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!supabase) return;

    if (session?.access_token) {
      void supabase.realtime.setAuth(session.access_token).then(() => {
        void reconnectChatRealtimeAfterAuth();
      });
      return;
    }

    for (const entry of conversationSubscriptions.values()) {
      entry.isSubscribed = false;
    }
    refreshConnectionStatus();
  });
}

export function subscribeToChatConnectionStatus(
  onChange: ConnectionListener,
): () => void {
  ensureChatConnectionMonitor();
  ensureChatAuthReconnect();
  connectionListeners.add(onChange);
  onChange(connectionStatus);
  refreshConnectionStatus();
  return () => {
    connectionListeners.delete(onChange);
  };
}

export async function reconnectChatRealtimeAfterAuth(): Promise<void> {
  if (!supabase) return;

  ensureChatConnectionMonitor();
  ensureChatAuthReconnect();

  if (!supabase.realtime.isConnected()) {
    supabase.realtime.connect();
  }

  for (const [conversationId, entry] of conversationSubscriptions) {
    if (entry.listeners.size === 0) continue;

    if (entry.retryTimer) {
      clearTimeout(entry.retryTimer);
      entry.retryTimer = null;
    }

    if (entry.channel) {
      entry.isSubscribed = false;
      await supabase.removeChannel(entry.channel);
      entry.channel = null;
    }

    ensureConversationChannel(conversationId, entry);
  }

  refreshConnectionStatus();
  await reconnectChatPresenceAfterAuth();
}

const bootstrapPromises = new Map<string, Promise<void>>();

export async function bootstrapChatSession(
  firebaseUid: string,
  displayName: string,
): Promise<void> {
  const inFlight = bootstrapPromises.get(firebaseUid);
  if (inFlight) {
    await inFlight;
    return;
  }

  const promise = (async () => {
    await syncSupabaseChatFromFirebase(firebaseUid, displayName);
    await reconnectChatRealtimeAfterAuth();
  })();

  bootstrapPromises.set(firebaseUid, promise);
  try {
    await promise;
  } finally {
    bootstrapPromises.delete(firebaseUid);
  }
}

export function subscribeToConversationResync(onResync: ResyncListener): () => void {
  resyncListeners.add(onResync);
  return () => {
    resyncListeners.delete(onResync);
  };
}

function notifyConversationResync(conversationId: string): void {
  for (const listener of resyncListeners) {
    listener(conversationId);
  }
}

function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of existing) {
    byId.set(message.id, message);
  }

  for (const message of incoming) {
    const pendingMatch = [...byId.values()].find(
      (candidate) =>
        candidate.status === 'pending' &&
        candidate.senderId === message.senderId &&
        candidate.text === message.text,
    );
    if (pendingMatch) {
      byId.delete(pendingMatch.id);
    }
    byId.set(message.id, { ...message, status: message.status ?? 'sent' });
  }

  return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
}

export function createOptimisticMessageId(): string {
  return `pending-${generateId()}`;
}

interface ConversationSubscription {
  listeners: Set<MessageListener>;
  channel: ReturnType<NonNullable<typeof supabase>['channel']> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  isSubscribed: boolean;
}

const conversationSubscriptions = new Map<string, ConversationSubscription>();

function dispatchConversationMessage(conversationId: string, message: ChatMessage): void {
  const entry = conversationSubscriptions.get(conversationId);
  if (!entry) return;

  for (const listener of entry.listeners) {
    listener(message);
  }
}

function ensureConversationChannel(
  conversationId: string,
  entry: ConversationSubscription,
): void {
  if (!supabase || entry.channel) return;

  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }

  entry.channel = supabase
    .channel(`officeex-chat-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const row = payload.new as {
          id: string;
          conversation_id: string;
          sender_id: string;
          sender_name: string;
          text: string;
          created_at: string;
        };
        if (row?.id) {
          dispatchConversationMessage(conversationId, mapMessage(row));
        }
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        if (!entry.isSubscribed) {
          entry.isSubscribed = true;
          refreshConnectionStatus();
          notifyConversationResync(conversationId);
        }
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        const wasSubscribed = entry.isSubscribed;
        entry.isSubscribed = false;
        if (wasSubscribed) {
          refreshConnectionStatus();
        }

        if (supabase && entry.channel) {
          void supabase.removeChannel(entry.channel);
        }
        entry.channel = null;

        if (entry.listeners.size > 0 && !entry.retryTimer) {
          entry.retryTimer = setTimeout(() => {
            entry.retryTimer = null;
            ensureConversationChannel(conversationId, entry);
          }, 2000);
        }
      }
    });
}

function teardownConversationChannel(
  conversationId: string,
  entry: ConversationSubscription,
): void {
  if (entry.retryTimer) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }
  if (supabase && entry.channel) {
    entry.isSubscribed = false;
    void supabase.removeChannel(entry.channel);
  }
  entry.channel = null;
  conversationSubscriptions.delete(conversationId);
  refreshConnectionStatus();
}

export function subscribeToConversationMessages(
  conversationId: string,
  onInsert: (message: ChatMessage) => void,
): () => void {
  if (!supabase) {
    return () => undefined;
  }

  let entry = conversationSubscriptions.get(conversationId);
  if (!entry) {
    entry = { listeners: new Set(), channel: null, retryTimer: null, isSubscribed: false };
    conversationSubscriptions.set(conversationId, entry);
  }

  entry.listeners.add(onInsert);
  ensureChatConnectionMonitor();
  ensureChatAuthReconnect();
  ensureConversationChannel(conversationId, entry);
  refreshConnectionStatus();

  return () => {
    const current = conversationSubscriptions.get(conversationId);
    if (!current) return;

    current.listeners.delete(onInsert);
    if (current.listeners.size === 0) {
      teardownConversationChannel(conversationId, current);
    } else {
      refreshConnectionStatus();
    }
  };
}

export function subscribeToConversationListChanges(
  firebaseUid: string,
  onChange: () => void,
): () => void {
  if (!supabase) {
    return () => undefined;
  }

  const channel = supabase
    .channel(`officeex-sidebar-${firebaseUid}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_conversation_members',
        filter: `firebase_uid=eq.${firebaseUid}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_conversation_members',
        filter: `firebase_uid=eq.${firebaseUid}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_conversation_members',
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_conversation_members',
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_conversations',
      },
      () => onChange(),
    )
    .subscribe();

  return () => {
    if (!supabase) return;
    void supabase.removeChannel(channel);
  };
}

export { mergeMessages };

export function getConversationTitle(
  conversation: ChatConversation,
  myFirebaseUid: string,
  nameByUid: Map<string, string>,
): string {
  if (conversation.slug === EVERYONE_SLUG || conversation.name === 'Everyone') {
    return 'Everyone';
  }
  if (conversation.type === 'group' && conversation.name) {
    return conversation.name;
  }
  const otherUid = conversation.memberIds.find((uid) => uid !== myFirebaseUid);
  if (otherUid) {
    return nameByUid.get(otherUid) ?? 'Direct message';
  }
  return 'Direct message';
}
