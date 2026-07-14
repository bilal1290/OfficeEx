import { splitMessageMentions } from './chat-mentions';
import { supabase } from './supabase';
import type { ChatConversation, ChatMessage, ChatNotification } from '../types';

export function isNotificationsSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('chat_notifications') &&
    (message.includes('schema cache') || message.includes('does not exist'))
  );
}

export function messageToLocalNotification(
  message: ChatMessage,
  recipientFirebaseUid: string,
  recipientDisplayName: string,
): ChatNotification {
  const segments = splitMessageMentions(message.text, [recipientDisplayName]);
  const isMention = segments.some((segment) => segment.type === 'mention');

  return {
    id: `local-${message.id}`,
    recipientFirebaseUid,
    conversationId: message.conversationId,
    messageId: message.id,
    senderId: message.senderId,
    senderName: message.senderName,
    preview: message.text.trim().slice(0, 160),
    type: isMention ? 'mention' : 'message',
    readAt: null,
    createdAt: message.createdAt,
  };
}

export async function fetchLocalChatNotifications(
  firebaseUid: string,
  displayName: string,
  conversations: ChatConversation[],
  limitPerConversation = 20,
): Promise<ChatNotification[]> {
  if (!supabase || conversations.length === 0) {
    return [];
  }

  const { getConversationLastRead } = await import('./chat-unread');
  const notifications: ChatNotification[] = [];

  for (const conversation of conversations) {
    const since = getConversationLastRead(firebaseUid, conversation.id);
    let query = supabase
      .from('chat_messages')
      .select('id, conversation_id, sender_id, sender_name, text, created_at')
      .eq('conversation_id', conversation.id)
      .neq('sender_id', firebaseUid)
      .order('created_at', { ascending: false })
      .limit(limitPerConversation);

    if (since > 0) {
      query = query.gt('created_at', new Date(since).toISOString());
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    for (const row of data ?? []) {
      const message: ChatMessage = {
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        text: row.text,
        createdAt: new Date(row.created_at).getTime(),
      };
      notifications.push(messageToLocalNotification(message, firebaseUid, displayName));
    }
  }

  return notifications.sort((a, b) => b.createdAt - a.createdAt);
}
