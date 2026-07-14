import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchChatMessages,
  isSupabaseChatReady,
  sendChatMessage,
  subscribeToChatMessages,
} from '../lib/supabase-chat';
import type { ChatMessage } from '../types';

interface ChatContextValue {
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  isConfigured: boolean;
  sendMessage: (text: string) => Promise<void>;
  refreshMessages: () => Promise<void>;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMessages = useCallback(async () => {
    if (!isConfigured) return;

    setLoading(true);
    try {
      setMessages(await fetchChatMessages());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat messages.');
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  const sendMessageHandler = useCallback(
    async (text: string) => {
      if (!senderId || !senderName) {
        throw new Error('Chat is not ready.');
      }

      const trimmed = text.trim();
      if (!trimmed) return;

      setSending(true);
      setError(null);

      try {
        const message = await sendChatMessage(senderId, senderName, trimmed);
        setMessages((current) =>
          current.some((item) => item.id === message.id) ? current : [...current, message],
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send message.');
        throw err;
      } finally {
        setSending(false);
      }
    },
    [senderId, senderName],
  );

  useEffect(() => {
    if (!isConfigured) {
      setMessages([]);
      setError(null);
      return;
    }

    void refreshMessages();
    const unsubscribe = subscribeToChatMessages(() => {
      void refreshMessages();
    });
    return unsubscribe;
  }, [isConfigured, refreshMessages]);

  const value = useMemo(
    () => ({
      messages,
      loading,
      sending,
      error,
      isConfigured,
      sendMessage: sendMessageHandler,
      refreshMessages,
    }),
    [messages, loading, sending, error, isConfigured, sendMessageHandler, refreshMessages],
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
