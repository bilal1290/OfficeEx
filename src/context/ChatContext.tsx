import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { buildActivityMap } from '../lib/chat-activity';
import {
  clearConversationMessageSubscriptions,
  syncConversationMessageSubscriptions,
} from '../lib/chat-subscriptions';
import {
  CHAT_MESSAGE_PAGE_SIZE,
  EVERYONE_CONVERSATION_ID,
  addGroupMembers,
  bootstrapChatSession,
  createGroupChat,
  createOptimisticMessageId,
  deleteChatMessage,
  fetchChatMessages,
  fetchChatMessagesBefore,
  fetchChatMessagesSince,
  fetchConversations,
  fetchRecentMessagesForConversations,
  getOrCreateDirectChat,
  isSupabaseChatReady,
  latestMessageByConversation,
  mergeMessages,
  leaveConversation,
  removeGroupMember,
  sendChatMessage,
  subscribeToChatConnectionStatus,
  subscribeToConversationListChanges,
  subscribeToConversationResync,
  type ChatConnectionStatus,
} from '../lib/supabase-chat';
import type { ChatConversation, ChatMessage } from '../types';
import type { ConversationActivity } from '../lib/chat-activity';

function upsertMessage(list: ChatMessage[], message: ChatMessage): ChatMessage[] {
  if (list.some((item) => item.id === message.id)) return list;
  return mergeMessages(list, [message]);
}

function replaceMessage(
  list: ChatMessage[],
  messageId: string,
  nextMessage: ChatMessage,
): ChatMessage[] {
  const index = list.findIndex((item) => item.id === messageId);
  if (index === -1) return upsertMessage(list, nextMessage);
  const next = [...list];
  next[index] = nextMessage;
  return next.sort((a, b) => a.createdAt - b.createdAt);
}

function updateMessageStatus(
  list: ChatMessage[],
  messageId: string,
  status: ChatMessage['status'],
): ChatMessage[] {
  const index = list.findIndex((item) => item.id === messageId);
  if (index === -1) return list;
  const next = [...list];
  next[index] = { ...next[index], status };
  return next;
}

interface ChatContextValue {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  activeConversation: ChatConversation | null;
  messages: ChatMessage[];
  conversationActivity: Map<string, ConversationActivity>;
  connectionStatus: ChatConnectionStatus;
  loading: boolean;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  error: string | null;
  isConfigured: boolean;
  setActiveConversationId: (id: string) => void;
  sendMessage: (text: string, mentionedUids?: string[]) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  loadOlderMessages: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  startDirectChat: (otherFirebaseUid: string) => Promise<void>;
  startGroupChat: (name: string, memberFirebaseUids: string[]) => Promise<void>;
  addGroupMembers: (conversationId: string, memberFirebaseUids: string[]) => Promise<void>;
  removeGroupMember: (conversationId: string, memberFirebaseUid: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({
  children,
  senderId,
  senderName,
}: {
  children: ReactNode;
  senderId?: string;
  senderName?: string;
}) {
  const isConfigured = isSupabaseChatReady();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    EVERYONE_CONVERSATION_ID,
  );
  const [messageCache, setMessageCache] = useState<Record<string, ChatMessage[]>>({});
  const messageCacheRef = useRef<Record<string, ChatMessage[]>>({});
  const messageUnsubscribersRef = useRef<Map<string, () => void>>(new Map());
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlderByConversation, setHasMoreOlderByConversation] = useState<
    Record<string, boolean>
  >({});
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  const messages = activeConversationId ? (messageCache[activeConversationId] ?? []) : [];
  const loading =
    Boolean(activeConversationId) &&
    loadingConversationId === activeConversationId &&
    messages.length === 0;
  const hasMoreOlder = activeConversationId
    ? (hasMoreOlderByConversation[activeConversationId] ?? true)
    : false;

  const setHasMoreOlder = useCallback((conversationId: string, value: boolean) => {
    setHasMoreOlderByConversation((current) => ({ ...current, [conversationId]: value }));
  }, []);

  const conversationActivity = useMemo(
    () => buildActivityMap(messageCache),
    [messageCache],
  );

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const patchCache = useCallback((conversationId: string, nextMessages: ChatMessage[]) => {
    messageCacheRef.current[conversationId] = nextMessages;
    setMessageCache({ ...messageCacheRef.current });
  }, []);

  const removeFromCache = useCallback(
    (conversationId: string, messageId: string) => {
      const current = messageCacheRef.current[conversationId] ?? [];
      const next = current.filter((message) => message.id !== messageId);
      if (next.length === current.length) return;
      patchCache(conversationId, next);
    },
    [patchCache],
  );

  const appendToCache = useCallback(
    (conversationId: string, message: ChatMessage) => {
      const current = messageCacheRef.current[conversationId] ?? [];
      const next = upsertMessage(current, message);
      if (next === current) return;
      patchCache(conversationId, next);
    },
    [patchCache],
  );

  const syncConversationGap = useCallback(
    async (conversationId: string) => {
      if (!isConfigured) return;

      const cached = messageCacheRef.current[conversationId] ?? [];
      const sentMessages = cached.filter((message) => message.status !== 'pending');
      const lastTimestamp = sentMessages.at(-1)?.createdAt;

      try {
        const fetched = lastTimestamp
          ? await fetchChatMessagesSince(conversationId, lastTimestamp)
          : await fetchChatMessages(conversationId);
        if (fetched.length === 0 && !lastTimestamp) {
          setHasMoreOlder(conversationId, false);
        }
        const merged = mergeMessages(cached, fetched);
        patchCache(conversationId, merged);
      } catch {
        // Keep cached messages if gap sync fails.
      }
    },
    [isConfigured, patchCache, setHasMoreOlder],
  );

  const seedSidebarPreviews = useCallback(
    async (nextConversations: ChatConversation[]) => {
      if (!isConfigured || nextConversations.length === 0) return;

      const missingIds = nextConversations
        .map((conversation) => conversation.id)
        .filter((conversationId) => !messageCacheRef.current[conversationId]?.length);

      if (missingIds.length === 0) return;

      try {
        const recent = await fetchRecentMessagesForConversations(missingIds);
        const latest = latestMessageByConversation(recent);
        for (const [conversationId, message] of latest) {
          if (!messageCacheRef.current[conversationId]?.length) {
            patchCache(conversationId, [{ ...message, status: 'sent' }]);
          }
        }
      } catch {
        // Sidebar previews are optional.
      }
    },
    [isConfigured, patchCache],
  );

  const refreshConversations = useCallback(async () => {
    if (!isConfigured || !senderId) return;

    const next = await fetchConversations(senderId);
    setConversations(next);
    await seedSidebarPreviews(next);
    setActiveConversationId((current) => {
      if (current && next.some((conversation) => conversation.id === current)) {
        return current;
      }
      return next.find((c) => c.id === EVERYONE_CONVERSATION_ID)?.id ?? next[0]?.id ?? null;
    });
  }, [isConfigured, senderId, seedSidebarPreviews]);

  const loadActiveConversationMessages = useCallback(
    async (conversationId: string, mergeWithCache: boolean) => {
      if (!isConfigured) return;

      const cached = messageCacheRef.current[conversationId];
      if (!cached?.length) {
        setLoadingConversationId(conversationId);
      } else if (mergeWithCache) {
        setMessageCache({ ...messageCacheRef.current });
      }

      try {
        const fetched = await fetchChatMessages(conversationId);
        setHasMoreOlder(conversationId, fetched.length >= CHAT_MESSAGE_PAGE_SIZE);
        const merged = mergeWithCache ? mergeMessages(cached ?? [], fetched) : fetched;
        patchCache(conversationId, merged);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load chat messages.');
      } finally {
        setLoadingConversationId((current) => (current === conversationId ? null : current));
      }
    },
    [isConfigured, patchCache, setHasMoreOlder],
  );

  const refreshMessages = useCallback(async () => {
    if (!isConfigured || !activeConversationId) return;
    await loadActiveConversationMessages(activeConversationId, true);
  }, [isConfigured, activeConversationId, loadActiveConversationMessages]);

  const loadOlderMessages = useCallback(async () => {
    if (!isConfigured || !activeConversationId || loadingOlder) return;

    const conversationId = activeConversationId;
    const cached = messageCacheRef.current[conversationId] ?? [];
    const earliest = cached.find((message) => message.status !== 'pending');
    if (!earliest) return;

    setLoadingOlder(true);
    try {
      const older = await fetchChatMessagesBefore(conversationId, earliest.createdAt);
      setHasMoreOlder(conversationId, older.length >= CHAT_MESSAGE_PAGE_SIZE);
      if (older.length > 0) {
        patchCache(conversationId, mergeMessages(older, cached));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load older messages.');
    } finally {
      setLoadingOlder(false);
    }
  }, [isConfigured, activeConversationId, loadingOlder, patchCache, setHasMoreOlder]);

  const sendMessageHandler = useCallback(
    async (text: string, mentionedUids: string[] = []) => {
      if (!senderId || !senderName || !activeConversationId) {
        throw new Error('Chat is not ready.');
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      const conversationId = activeConversationId;
      const clientId = createOptimisticMessageId();
      const optimistic: ChatMessage = {
        id: clientId,
        clientId,
        conversationId,
        senderId,
        senderName,
        text: trimmed,
        createdAt: Date.now(),
        status: 'pending',
        mentionedUids,
      };

      appendToCache(conversationId, optimistic);
      setError(null);

      try {
        const message = await sendChatMessage(
          conversationId,
          senderId,
          senderName,
          trimmed,
          mentionedUids,
        );
        const current = messageCacheRef.current[conversationId] ?? [];
        patchCache(conversationId, replaceMessage(current, clientId, { ...message, status: 'sent' }));
      } catch (err) {
        const current = messageCacheRef.current[conversationId] ?? [];
        patchCache(conversationId, updateMessageStatus(current, clientId, 'failed'));
        setError(err instanceof Error ? err.message : 'Could not send message.');
      }
    },
    [senderId, senderName, activeConversationId, appendToCache, patchCache],
  );

  const deleteMessageHandler = useCallback(
    async (messageId: string) => {
      if (!senderId || !senderName || !activeConversationId) {
        throw new Error('Chat is not ready.');
      }

      const conversationId = activeConversationId;
      removeFromCache(conversationId, messageId);
      setError(null);

      try {
        await deleteChatMessage(conversationId, messageId, senderId, senderName);
      } catch (err) {
        await loadActiveConversationMessages(conversationId, true);
        setError(err instanceof Error ? err.message : 'Could not delete message.');
        throw err;
      }
    },
    [senderId, senderName, activeConversationId, removeFromCache, loadActiveConversationMessages],
  );

  const leaveConversationHandler = useCallback(
    async (conversationId: string) => {
      if (!senderId || !senderName) {
        throw new Error('Chat is not ready.');
      }

      await leaveConversation(conversationId, senderId, senderName);
      await refreshConversations();
      setActiveConversationId((current) =>
        current === conversationId ? EVERYONE_CONVERSATION_ID : current,
      );
    },
    [senderId, senderName, refreshConversations],
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (!senderId || !senderName || !activeConversationId) return;

      const conversationId = activeConversationId;
      const current = messageCacheRef.current[conversationId] ?? [];
      const failed = current.find((message) => message.id === messageId);
      if (!failed || failed.status !== 'failed') return;

      patchCache(
        conversationId,
        updateMessageStatus(current, messageId, 'pending'),
      );

      try {
        const message = await sendChatMessage(
          conversationId,
          senderId,
          senderName,
          failed.text,
          failed.mentionedUids ?? [],
        );
        const latest = messageCacheRef.current[conversationId] ?? [];
        patchCache(
          conversationId,
          replaceMessage(latest, messageId, { ...message, status: 'sent' }),
        );
      } catch (err) {
        const latest = messageCacheRef.current[conversationId] ?? [];
        patchCache(conversationId, updateMessageStatus(latest, messageId, 'failed'));
        setError(err instanceof Error ? err.message : 'Could not send message.');
      }
    },
    [senderId, senderName, activeConversationId, patchCache],
  );

  const startDirectChat = useCallback(
    async (otherFirebaseUid: string) => {
      if (!senderId || !senderName) {
        throw new Error('Chat is not ready.');
      }
      const conversation = await getOrCreateDirectChat(
        senderId,
        otherFirebaseUid,
        senderName,
      );
      setConversations((current) => {
        if (current.some((item) => item.id === conversation.id)) return current;
        return [...current, conversation];
      });
      setActiveConversationId(conversation.id);
    },
    [senderId, senderName],
  );

  const startGroupChat = useCallback(
    async (name: string, memberFirebaseUids: string[]) => {
      if (!senderId || !senderName) {
        throw new Error('Chat is not ready.');
      }
      const conversation = await createGroupChat(name, senderId, memberFirebaseUids, senderName);
      setConversations((current) => {
        if (current.some((item) => item.id === conversation.id)) return current;
        return [...current, conversation];
      });
      setActiveConversationId(conversation.id);
    },
    [senderId, senderName],
  );

  const addGroupMembersHandler = useCallback(
    async (conversationId: string, memberFirebaseUids: string[]) => {
      if (!senderId) {
        throw new Error('Chat is not ready.');
      }
      const updated = await addGroupMembers(conversationId, senderId, memberFirebaseUids);
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === updated.id ? updated : conversation,
        ),
      );
    },
    [senderId],
  );

  const removeGroupMemberHandler = useCallback(
    async (conversationId: string, memberFirebaseUid: string) => {
      if (!senderId) {
        throw new Error('Chat is not ready.');
      }
      const updated = await removeGroupMember(
        conversationId,
        senderId,
        memberFirebaseUid,
        senderName ?? 'User',
      );
      const leftGroup = memberFirebaseUid === senderId;

      if (leftGroup || !updated) {
        await refreshConversations();
        setActiveConversationId(EVERYONE_CONVERSATION_ID);
        return;
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === updated.id ? updated : conversation,
        ),
      );
    },
    [senderId, senderName, refreshConversations],
  );

  useEffect(() => {
    if (!isConfigured) {
      setConversations([]);
      messageCacheRef.current = {};
      setHasMoreOlderByConversation({});
      setMessageCache({});
      setError(null);
      return;
    }

    let active = true;

    const boot = async () => {
      if (!senderId || !senderName) return;

      try {
        await bootstrapChatSession(senderId, senderName);
        if (!active) return;
        await refreshConversations();
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Could not connect chat session.');
        }
      }
    };

    void boot();

    return () => {
      active = false;
    };
  }, [isConfigured, senderId, senderName, refreshConversations]);

  useEffect(() => {
    return subscribeToChatConnectionStatus(setConnectionStatus);
  }, []);

  useEffect(() => {
    if (!isConfigured || !senderId) return;

    return subscribeToConversationListChanges(senderId, () => {
      void refreshConversations();
    });
  }, [isConfigured, senderId, refreshConversations]);

  useEffect(() => {
    if (!isConfigured) return;

    return subscribeToConversationResync((conversationId) => {
      void syncConversationGap(conversationId);
    });
  }, [isConfigured, syncConversationGap]);

  useEffect(() => {
    if (!isConfigured) return;

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      for (const conversationId of messageUnsubscribersRef.current.keys()) {
        void syncConversationGap(conversationId);
      }
      void refreshConversations();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isConfigured, syncConversationGap, refreshConversations]);

  useEffect(() => {
    if (!isConfigured) return;

    syncConversationMessageSubscriptions(
      messageUnsubscribersRef.current,
      conversations.map((conversation) => conversation.id),
      (conversationId, message) => {
        appendToCache(conversationId, { ...message, status: 'sent' });
      },
      (conversationId, messageId) => {
        removeFromCache(conversationId, messageId);
      },
    );
  }, [isConfigured, conversations, appendToCache, removeFromCache]);

  useEffect(() => {
    return () => {
      clearConversationMessageSubscriptions(messageUnsubscribersRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isConfigured || !activeConversationId) return;

    let cancelled = false;

    const load = async () => {
      await loadActiveConversationMessages(activeConversationId, true);
      if (cancelled) return;
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isConfigured, activeConversationId, loadActiveConversationMessages]);

  const value = useMemo(
    () => ({
      conversations,
      activeConversationId,
      activeConversation,
      messages,
      conversationActivity,
      connectionStatus,
      loading,
      loadingOlder,
      hasMoreOlder,
      error,
      isConfigured,
      setActiveConversationId,
      sendMessage: sendMessageHandler,
      deleteMessage: deleteMessageHandler,
      retryMessage,
      loadOlderMessages,
      refreshConversations,
      refreshMessages,
      startDirectChat,
      startGroupChat,
      addGroupMembers: addGroupMembersHandler,
      removeGroupMember: removeGroupMemberHandler,
      leaveConversation: leaveConversationHandler,
    }),
    [
      conversations,
      activeConversationId,
      activeConversation,
      messages,
      conversationActivity,
      connectionStatus,
      loading,
      loadingOlder,
      hasMoreOlder,
      error,
      isConfigured,
      sendMessageHandler,
      deleteMessageHandler,
      retryMessage,
      loadOlderMessages,
      refreshConversations,
      refreshMessages,
      startDirectChat,
      startGroupChat,
      addGroupMembersHandler,
      removeGroupMemberHandler,
      leaveConversationHandler,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
