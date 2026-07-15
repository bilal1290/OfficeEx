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
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchChatNotificationsSafe,
  getNotificationLabel,
  markAllNotificationsReadSafe,
  markConversationNotificationsReadSafe,
  markNotificationReadSafe,
  subscribeToChatNotifications,
} from '../lib/supabase-notifications';
import { messageToLocalNotification } from '../lib/chat-notifications-local';
import {
  clearConversationMessageSubscriptions,
  syncConversationMessageSubscriptions,
} from '../lib/chat-subscriptions';
import { subscribeToChatPresence, countOnlineMembers } from '../lib/chat-presence';
import {
  bootstrapChatSession,
  fetchConversations,
  isSupabaseChatReady,
} from '../lib/supabase-chat';
import {
  areDesktopNotificationsEnabled,
  canUseDesktopNotifications,
  requestDesktopNotificationPermission,
  showDesktopNotification,
} from '../lib/browser-notifications';
import { setConversationLastRead } from '../lib/chat-unread';
import type { ChatConversation, ChatMessage, ChatNotification } from '../types';

export interface ChatToast {
  id: string;
  title: string;
  body: string;
  conversationId: string;
  notificationId: string;
}

interface ChatNotificationContextValue {
  notifications: ChatNotification[];
  unreadCount: number;
  unreadByConversationId: Map<string, number>;
  getConversationUnreadCount: (conversationId: string) => number;
  toasts: ChatToast[];
  desktopNotificationsEnabled: boolean;
  canEnableDesktopNotifications: boolean;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  markConversationRead: (conversationId: string, readAt?: number) => Promise<void>;
  openNotification: (notification: ChatNotification) => void;
  dismissToast: (toastId: string) => void;
  setViewingConversationId: (conversationId: string | null) => void;
  enableDesktopNotifications: () => Promise<boolean>;
  onlineUids: ReadonlySet<string>;
  isUserOnline: (firebaseUid: string) => boolean;
  getOnlineCount: (memberIds: string[]) => number;
}

const ChatNotificationContext = createContext<ChatNotificationContextValue | null>(null);

function upsertNotification(
  list: ChatNotification[],
  notification: ChatNotification,
): ChatNotification[] {
  const index = list.findIndex(
    (item) => item.id === notification.id || item.messageId === notification.messageId,
  );
  if (index === -1) {
    return [notification, ...list].sort((a, b) => b.createdAt - a.createdAt);
  }
  const next = [...list];
  next[index] = notification;
  return next.sort((a, b) => b.createdAt - a.createdAt);
}

export function ChatNotificationProvider({
  children,
  firebaseUid,
  displayName,
  enabled,
}: {
  children: ReactNode;
  firebaseUid?: string;
  displayName?: string;
  enabled: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [toasts, setToasts] = useState<ChatToast[]>([]);
  const [loading, setLoading] = useState(false);
  const [desktopEnabled, setDesktopEnabled] = useState(areDesktopNotificationsEnabled());
  const [onlineUids, setOnlineUids] = useState<ReadonlySet<string>>(() => new Set());
  const viewingConversationRef = useRef<string | null>(null);
  const conversationIdsRef = useRef<string[]>([]);
  const notificationsSourceRef = useRef<'database' | 'messages'>('database');
  const displayNameRef = useRef(displayName ?? 'User');
  const isConfigured = isSupabaseChatReady();

  useEffect(() => {
    displayNameRef.current = displayName ?? 'User';
  }, [displayName]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.readAt).length,
    [notifications],
  );

  const unreadByConversationId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const notification of notifications) {
      if (notification.readAt) continue;
      counts.set(
        notification.conversationId,
        (counts.get(notification.conversationId) ?? 0) + 1,
      );
    }
    return counts;
  }, [notifications]);

  const getConversationUnreadCount = useCallback(
    (conversationId: string) => unreadByConversationId.get(conversationId) ?? 0,
    [unreadByConversationId],
  );

  const loadNotifications = useCallback(async (): Promise<{
    conversations: ChatConversation[];
    source: 'database' | 'messages';
  }> => {
    if (!enabled || !isConfigured || !firebaseUid || !displayName) {
      return { conversations: [], source: 'database' };
    }

    setLoading(true);
    try {
      const conversations = await fetchConversations(firebaseUid);
      conversationIdsRef.current = conversations.map((conversation) => conversation.id);
      const result = await fetchChatNotificationsSafe(
        firebaseUid,
        displayName,
        conversations,
      );
      notificationsSourceRef.current = result.source;
      setNotifications(result.notifications);
      return { conversations, source: result.source };
    } finally {
      setLoading(false);
    }
  }, [enabled, isConfigured, firebaseUid, displayName]);

  const refreshNotifications = useCallback(async () => {
    await loadNotifications();
  }, [loadNotifications]);

  const markRead = useCallback(async (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? { ...notification, readAt: Date.now() }
          : notification,
      ),
    );
    await markNotificationReadSafe(notificationId);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!firebaseUid) return;

    const now = Date.now();
    setNotifications((current) =>
      current.map((notification) =>
        notification.readAt ? notification : { ...notification, readAt: now },
      ),
    );
    await markAllNotificationsReadSafe(firebaseUid, conversationIdsRef.current);
  }, [firebaseUid]);

  const markConversationRead = useCallback(
    async (conversationId: string, readAt?: number) => {
      if (!firebaseUid) return;

      setConversationLastRead(firebaseUid, conversationId, readAt ?? Date.now());

      setNotifications((current) =>
        current.map((notification) =>
          notification.conversationId === conversationId && !notification.readAt
            ? { ...notification, readAt: Date.now() }
            : notification,
        ),
      );
      await markConversationNotificationsReadSafe(conversationId, firebaseUid);
    },
    [firebaseUid],
  );

  const setViewingConversationId = useCallback((conversationId: string | null) => {
    viewingConversationRef.current = conversationId;
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToast = useCallback(
    (notification: ChatNotification) => {
      const toast: ChatToast = {
        id: `${notification.id}-${Date.now()}`,
        title: getNotificationLabel(notification),
        body: notification.preview,
        conversationId: notification.conversationId,
        notificationId: notification.id,
      };
      setToasts((current) => [toast, ...current].slice(0, 4));
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 6000);
    },
    [dismissToast],
  );

  const notifyIncoming = useCallback(
    (notification: ChatNotification, event: 'insert' | 'update') => {
      setNotifications((current) => upsertNotification(current, notification));

      if (event !== 'insert' || notification.readAt) return;
      if (notification.senderId === firebaseUid) return;

      const onChatPage = location.pathname === '/chat';
      const viewingConversation = viewingConversationRef.current === notification.conversationId;

      if (onChatPage && viewingConversation) {
        void markRead(notification.id);
        return;
      }

      pushToast(notification);
      showDesktopNotification(getNotificationLabel(notification), {
        body: notification.preview,
        tag: notification.id,
      });
    },
    [firebaseUid, location.pathname, markRead, pushToast],
  );

  const handleIncomingMessage = useCallback(
    (message: ChatMessage) => {
      if (!firebaseUid || message.senderId === firebaseUid) return;

      const notification = messageToLocalNotification(
        message,
        firebaseUid,
        displayNameRef.current,
      );
      notifyIncoming(notification, 'insert');
    },
    [firebaseUid, notifyIncoming],
  );

  const openNotification = useCallback(
    (notification: ChatNotification) => {
      void markRead(notification.id);
      navigate(`/chat?c=${notification.conversationId}`);
    },
    [markRead, navigate],
  );

  const enableDesktopNotifications = useCallback(async () => {
    const permission = await requestDesktopNotificationPermission();
    const granted = permission === 'granted';
    setDesktopEnabled(granted);
    return granted;
  }, []);

  const isUserOnline = useCallback(
    (uid: string) => onlineUids.has(uid),
    [onlineUids],
  );

  const getOnlineCount = useCallback(
    (memberIds: string[]) => countOnlineMembers(memberIds, onlineUids),
    [onlineUids],
  );

  useEffect(() => {
    if (!enabled || !isConfigured || !firebaseUid || !displayName) {
      setOnlineUids(new Set());
      return;
    }

    return subscribeToChatPresence(firebaseUid, displayName, setOnlineUids);
  }, [enabled, isConfigured, firebaseUid, displayName]);

  useEffect(() => {
    if (!enabled || !isConfigured || !firebaseUid || !displayName) {
      setNotifications([]);
      conversationIdsRef.current = [];
      notificationsSourceRef.current = 'database';
      return;
    }

    let active = true;
    const messageUnsubscribers = new Map<string, () => void>();

    const syncMessageSubscriptions = (
      conversationIds: string[],
      source: 'database' | 'messages',
    ) => {
      if (source !== 'messages') {
        clearConversationMessageSubscriptions(messageUnsubscribers);
        return;
      }

      syncConversationMessageSubscriptions(
        messageUnsubscribers,
        conversationIds,
        (_conversationId, message) => {
          handleIncomingMessage(message);
        },
      );
    };

    const boot = async () => {
      try {
        await bootstrapChatSession(firebaseUid, displayName);
        if (!active) return;

        const { conversations, source } = await loadNotifications();
        if (!active) return;

        syncMessageSubscriptions(
          conversations.map((conversation) => conversation.id),
          source,
        );
      } catch {
        if (!active) return;
        const { conversations, source } = await loadNotifications();
        syncMessageSubscriptions(
          conversations.map((conversation) => conversation.id),
          source,
        );
      }
    };

    void boot();

    const unsubscribeDb = subscribeToChatNotifications(firebaseUid, (notification, event) => {
      notifyIncoming(notification, event);
    });

    return () => {
      active = false;
      unsubscribeDb();
      clearConversationMessageSubscriptions(messageUnsubscribers);
    };
  }, [
    enabled,
    isConfigured,
    firebaseUid,
    displayName,
    loadNotifications,
    handleIncomingMessage,
    notifyIncoming,
  ]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      unreadByConversationId,
      getConversationUnreadCount,
      toasts,
      desktopNotificationsEnabled: desktopEnabled,
      canEnableDesktopNotifications: canUseDesktopNotifications(),
      loading,
      refreshNotifications,
      markRead,
      markAllRead,
      markConversationRead,
      openNotification,
      dismissToast,
      setViewingConversationId,
      enableDesktopNotifications,
      onlineUids,
      isUserOnline,
      getOnlineCount,
    }),
    [
      notifications,
      unreadCount,
      unreadByConversationId,
      getConversationUnreadCount,
      toasts,
      desktopEnabled,
      loading,
      refreshNotifications,
      markRead,
      markAllRead,
      markConversationRead,
      openNotification,
      dismissToast,
      setViewingConversationId,
      enableDesktopNotifications,
      onlineUids,
      isUserOnline,
      getOnlineCount,
    ],
  );

  return (
    <ChatNotificationContext.Provider value={value}>{children}</ChatNotificationContext.Provider>
  );
}

export function useChatNotifications() {
  const context = useContext(ChatNotificationContext);
  if (!context) {
    throw new Error('useChatNotifications must be used within ChatNotificationProvider');
  }
  return context;
}

export function useOptionalChatNotifications() {
  return useContext(ChatNotificationContext);
}
