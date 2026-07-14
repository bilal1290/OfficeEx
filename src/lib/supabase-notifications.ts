import { isNotificationsSchemaError, fetchLocalChatNotifications } from './chat-notifications-local';
import { supabase } from './supabase';
import type { ChatConversation, ChatNotification } from '../types';

function mapNotification(row: {
  id: string;
  recipient_firebase_uid: string;
  conversation_id: string;
  message_id: string;
  sender_id: string;
  sender_name: string;
  preview: string;
  type: 'message' | 'mention';
  read_at: string | null;
  created_at: string;
}): ChatNotification {
  return {
    id: row.id,
    recipientFirebaseUid: row.recipient_firebase_uid,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    preview: row.preview,
    type: row.type,
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export async function fetchChatNotifications(
  firebaseUid: string,
  limit = 50,
): Promise<ChatNotification[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('chat_notifications')
    .select(
      'id, recipient_firebase_uid, conversation_id, message_id, sender_id, sender_name, preview, type, read_at, created_at',
    )
    .eq('recipient_firebase_uid', firebaseUid)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapNotification);
}

export async function fetchChatNotificationsSafe(
  firebaseUid: string,
  displayName: string,
  conversations: ChatConversation[],
): Promise<{ notifications: ChatNotification[]; source: 'database' | 'messages' }> {
  try {
    const notifications = await fetchChatNotifications(firebaseUid);
    return { notifications, source: 'database' };
  } catch (error) {
    if (!isNotificationsSchemaError(error)) {
      throw error;
    }
  }

  const notifications = await fetchLocalChatNotifications(
    firebaseUid,
    displayName,
    conversations,
  );
  return { notifications, source: 'messages' };
}

export async function markNotificationReadSafe(notificationId: string): Promise<void> {
  if (notificationId.startsWith('local-')) {
    return;
  }

  try {
    await markNotificationRead(notificationId);
  } catch (error) {
    if (!isNotificationsSchemaError(error)) {
      throw error;
    }
  }
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('chat_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markAllNotificationsReadSafe(
  firebaseUid: string,
  conversationIds: string[],
): Promise<void> {
  const { markAllConversationsReadLocal } = await import('./chat-unread');
  markAllConversationsReadLocal(firebaseUid, conversationIds);

  try {
    await markAllNotificationsRead(firebaseUid);
  } catch (error) {
    if (!isNotificationsSchemaError(error)) {
      throw error;
    }
  }
}

export async function markAllNotificationsRead(firebaseUid: string): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('chat_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_firebase_uid', firebaseUid)
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function markConversationNotificationsReadSafe(
  conversationId: string,
  firebaseUid: string,
): Promise<void> {
  const { setConversationLastRead } = await import('./chat-unread');
  setConversationLastRead(firebaseUid, conversationId, Date.now());

  try {
    await markConversationNotificationsRead(conversationId, firebaseUid);
  } catch (error) {
    if (!isNotificationsSchemaError(error)) {
      throw error;
    }
  }
}

export async function markConversationNotificationsRead(
  conversationId: string,
  firebaseUid: string,
): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase
    .from('chat_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_firebase_uid', firebaseUid)
    .eq('conversation_id', conversationId)
    .is('read_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export function subscribeToChatNotifications(
  firebaseUid: string,
  onChange: (notification: ChatNotification, event: 'insert' | 'update') => void,
): () => void {
  if (!supabase) {
    return () => undefined;
  }

  const channel = supabase
    .channel(`officeex-notifications-${firebaseUid}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_notifications',
        filter: `recipient_firebase_uid=eq.${firebaseUid}`,
      },
      (payload) => {
        const row = payload.new as Parameters<typeof mapNotification>[0];
        if (row?.id) {
          onChange(mapNotification(row), 'insert');
        }
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_notifications',
        filter: `recipient_firebase_uid=eq.${firebaseUid}`,
      },
      (payload) => {
        const row = payload.new as Parameters<typeof mapNotification>[0];
        if (row?.id) {
          onChange(mapNotification(row), 'update');
        }
      },
    )
    .subscribe();

  return () => {
    if (!supabase) return;
    void supabase.removeChannel(channel);
  };
}

export function getNotificationLabel(notification: ChatNotification): string {
  if (notification.type === 'mention') {
    return `${notification.senderName} mentioned you`;
  }
  return `${notification.senderName} sent a message`;
}
