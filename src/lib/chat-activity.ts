import { EVERYONE_SLUG, getConversationTitle } from './supabase-chat';
import type { ChatConversation, ChatMessage } from '../types';

export interface ConversationActivity {
  lastMessageAt: number;
  lastMessagePreview: string;
  lastSenderId: string;
  lastSenderName: string;
}

function messagePreview(text: string, maxLength = 72): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function activityFromMessages(messages: ChatMessage[]): ConversationActivity | null {
  const sent = messages.filter((message) => message.status !== 'failed');
  if (sent.length === 0) return null;

  const last = sent[sent.length - 1];
  return {
    lastMessageAt: last.createdAt,
    lastMessagePreview: messagePreview(last.text),
    lastSenderId: last.senderId,
    lastSenderName: last.senderName,
  };
}

export function buildActivityMap(
  messageCache: Record<string, ChatMessage[]>,
): Map<string, ConversationActivity> {
  const map = new Map<string, ConversationActivity>();
  for (const [conversationId, messages] of Object.entries(messageCache)) {
    const activity = activityFromMessages(messages);
    if (activity) {
      map.set(conversationId, activity);
    }
  }
  return map;
}

export function sortConversationsByActivity(
  conversations: ChatConversation[],
  activityMap: Map<string, ConversationActivity>,
  myUid: string,
  nameByUid: Map<string, string>,
): ChatConversation[] {
  return [...conversations].sort((a, b) => {
    if (a.slug === EVERYONE_SLUG) return -1;
    if (b.slug === EVERYONE_SLUG) return 1;

    const activityA = activityMap.get(a.id);
    const activityB = activityMap.get(b.id);

    if (activityA && activityB) {
      return activityB.lastMessageAt - activityA.lastMessageAt;
    }
    if (activityA) return -1;
    if (activityB) return 1;

    const titleA = getConversationTitle(a, myUid, nameByUid);
    const titleB = getConversationTitle(b, myUid, nameByUid);
    return titleA.localeCompare(titleB);
  });
}

export function sidebarPreviewLine(
  activity: ConversationActivity | undefined,
  myUid: string | undefined,
): string {
  if (!activity) return 'No messages yet';

  const prefix =
    activity.lastSenderId === myUid
      ? 'You: '
      : `${activity.lastSenderName.split(' ')[0]}: `;
  return `${prefix}${activity.lastMessagePreview}`;
}
