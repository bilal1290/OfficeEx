import { subscribeToConversationMessages } from './supabase-chat';
import type { ChatMessage } from '../types';

export function syncConversationMessageSubscriptions(
  unsubscribers: Map<string, () => void>,
  conversationIds: Iterable<string>,
  onMessage: (conversationId: string, message: ChatMessage) => void,
  onDelete?: (conversationId: string, messageId: string) => void,
): void {
  const activeIds = new Set(conversationIds);

  for (const [conversationId, unsubscribe] of unsubscribers) {
    if (activeIds.has(conversationId)) continue;
    unsubscribe();
    unsubscribers.delete(conversationId);
  }

  for (const conversationId of activeIds) {
    if (unsubscribers.has(conversationId)) continue;

    unsubscribers.set(
      conversationId,
      subscribeToConversationMessages(
        conversationId,
        (message) => {
          onMessage(conversationId, message);
        },
        onDelete
          ? (messageId) => {
              onDelete(conversationId, messageId);
            }
          : undefined,
      ),
    );
  }
}

export function clearConversationMessageSubscriptions(
  unsubscribers: Map<string, () => void>,
): void {
  for (const unsubscribe of unsubscribers.values()) {
    unsubscribe();
  }
  unsubscribers.clear();
}
