import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatProvider, useChat } from '../context/ChatContext';
import { useUsers } from '../hooks/useUsers';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { ChatQuickSwitcher } from '../components/chat/ChatQuickSwitcher';
import { ConversationAvatar } from '../components/chat/ConversationAvatar';
import { useRolePermissions } from '../context/RolePermissionsContext';
import { getChatEligibleUsers } from '../lib/chat-users';
import { UserAvatar } from '../components/ui/UserAvatar';
import { toMentionOptions, extractMentionedUids } from '../lib/chat-mentions';
import { useChatNotifications } from '../context/ChatNotificationContext';
import { GroupMembersModal } from '../components/chat/GroupMembersModal';
import {
  EVERYONE_SLUG,
  canLeaveConversation,
  getConversationTitle,
} from '../lib/supabase-chat';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { clsx } from '../lib/utils';
import {
  sidebarPreviewLine,
  sortConversationsByActivity,
  type ConversationActivity,
} from '../lib/chat-activity';
import {
  getStarredConversationIds,
  isSectionCollapsed,
  setSectionCollapsed,
  toggleStarredConversation,
} from '../lib/chat-preferences';
import {
  countUnreadMessagesSince,
  firstUnreadMessageId,
  getConversationLastRead,
  hasUnreadSince,
} from '../lib/chat-unread';
import { formatSidebarTimestamp } from '../lib/datetime';
import type { ChatConnectionStatus } from '../lib/supabase-chat';
import type { ChatConversation, UserProfile } from '../types';

function connectionStatusLabel(status: ChatConnectionStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'reconnecting') return 'Reconnecting…';
  return 'Connecting…';
}

function NewDirectModal({
  users,
  onClose,
  onSelect,
}: {
  users: UserProfile[];
  onClose: () => void;
  onSelect: (uid: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [loadingUid, setLoadingUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const filtered = users.filter((user) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      user.displayName.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q)
    );
  });

  const handleSelect = async (uid: string) => {
    setError('');
    setLoadingUid(uid);
    try {
      await onSelect(uid);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start chat.');
    } finally {
      setLoadingUid(null);
    }
  };

  return (
    <div
      className="chat-modal-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-label="New message"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="chat-modal-head">
          <h3>New message</h3>
          <button type="button" className="chat-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <Input
          label="Search team"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or email"
        />
        <ul className="chat-picker-list">
          {filtered.map((user) => (
            <li key={user.uid}>
              <button
                type="button"
                className="chat-picker-item"
                disabled={loadingUid === user.uid}
                onClick={() => void handleSelect(user.uid)}
              >
                <UserAvatar user={user} size="sm" />
                <span className="chat-picker-copy">
                  <span className="chat-picker-name">{user.displayName}</span>
                  <span className="chat-picker-email">{user.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="chat-picker-empty">No team members found.</p>}
        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}

function NewGroupModal({
  users,
  onClose,
  onCreate,
}: {
  users: UserProfile[];
  onClose: () => void;
  onCreate: (name: string, memberUids: string[]) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleMember = (uid: string) => {
    setSelected((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onCreate(name, selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="chat-modal-backdrop"
      role="presentation"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <form
        className="chat-modal"
        role="dialog"
        aria-modal="true"
        aria-label="New group"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="chat-modal-head">
          <h3>New group</h3>
          <button type="button" className="chat-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <Input
          label="Group name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Finance, Project Alpha"
          required
        />
        <p className="chat-modal-label">Add members</p>
        <ul className="chat-picker-list chat-picker-list-compact">
          {users.map((user) => (
            <li key={user.uid}>
              <label className="chat-picker-check">
                <input
                  type="checkbox"
                  checked={selected.includes(user.uid)}
                  onChange={() => toggleMember(user.uid)}
                />
                <span>{user.displayName}</span>
              </label>
            </li>
          ))}
        </ul>
        {error && <p className="form-error">{error}</p>}
        <Button type="submit" disabled={saving || !name.trim() || selected.length === 0}>
          {saving ? 'Creating...' : 'Create group'}
        </Button>
      </form>
    </div>
  );
}

function ChatPageContent() {
  const { profile } = useAuth();
  const { config: rolePermissionsConfig } = useRolePermissions();
  const { users } = useUsers();
  const [searchParams, setSearchParams] = useSearchParams();
  const { markConversationRead, setViewingConversationId, getConversationUnreadCount, isUserOnline, getOnlineCount } =
    useChatNotifications();
  const {
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
    sendMessage,
    deleteMessage,
    retryMessage,
    loadOlderMessages,
    refreshConversations,
    refreshMessages,
    startDirectChat,
    startGroupChat,
    addGroupMembers,
    removeGroupMember,
    leaveConversation,
  } = useChat();

  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [starredIds, setStarredIds] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [newMessagesBelow, setNewMessagesBelow] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const prevConversationRef = useRef<string | null>(null);
  const prevLastMessageIdRef = useRef<string | null>(null);
  const isNearBottomRef = useRef(true);
  const unreadAnchorRef = useRef<string | null>(null);

  const chatUsers = useMemo(
    () => getChatEligibleUsers(users, profile?.uid, rolePermissionsConfig),
    [users, profile?.uid, rolePermissionsConfig],
  );

  const mentionOptions = useMemo(() => toMentionOptions(chatUsers), [chatUsers]);
  const mentionNames = useMemo(
    () => chatUsers.map((user) => user.displayName),
    [chatUsers],
  );

  const usersByDisplayName = useMemo(
    () => new Map(chatUsers.map((user) => [user.displayName, user.uid])),
    [chatUsers],
  );

  const nameByUid = useMemo(
    () => new Map(users.map((user) => [user.uid, user.displayName])),
    [users],
  );

  const myProfile = useMemo(
    () =>
      profile
        ? { uid: profile.uid, displayName: profile.displayName, photoURL: profile.photoURL }
        : undefined,
    [profile],
  );

  const usersByUid = useMemo(
    () =>
      new Map(
        users.map((user) => [
          user.uid,
          { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL },
        ]),
      ),
    [users],
  );

  const sortedConversations = useMemo(() => {
    if (!profile?.uid) return conversations;
    return sortConversationsByActivity(conversations, conversationActivity, profile.uid, nameByUid);
  }, [conversations, conversationActivity, profile?.uid, nameByUid]);

  const everyoneConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.slug === EVERYONE_SLUG),
    [sortedConversations],
  );

  const groupConversations = useMemo(
    () =>
      sortedConversations.filter(
        (conversation) => conversation.type === 'group' && conversation.slug !== EVERYONE_SLUG,
      ),
    [sortedConversations],
  );

  const directConversations = useMemo(
    () => sortedConversations.filter((conversation) => conversation.type === 'direct'),
    [sortedConversations],
  );

  const starredConversations = useMemo(
    () => sortedConversations.filter((conversation) => starredIds.includes(conversation.id)),
    [sortedConversations, starredIds],
  );

  useEffect(() => {
    if (!profile?.uid) return;
    setStarredIds(getStarredConversationIds(profile.uid));
    setCollapsedSections({
      starred: isSectionCollapsed(profile.uid, 'starred'),
      channels: isSectionCollapsed(profile.uid, 'channels'),
      groups: isSectionCollapsed(profile.uid, 'groups'),
      direct: isSectionCollapsed(profile.uid, 'direct'),
    });
  }, [profile?.uid]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowQuickSwitcher(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const resolveUnreadCount = useCallback(
    (conversationId: string, activity?: ConversationActivity) => {
      const notificationUnread = getConversationUnreadCount(conversationId);
      if (!profile?.uid || !activity) return notificationUnread;

      const lastRead = getConversationLastRead(profile.uid, conversationId);
      if (!hasUnreadSince(activity.lastMessageAt, lastRead, profile.uid, activity.lastSenderId)) {
        return notificationUnread;
      }

      if (conversationId === activeConversationId) {
        return Math.max(
          notificationUnread,
          countUnreadMessagesSince(messages, lastRead, profile.uid),
        );
      }

      return Math.max(notificationUnread, 1);
    },
    [getConversationUnreadCount, profile?.uid, activeConversationId, messages],
  );

  const toggleSection = (section: 'starred' | 'channels' | 'groups' | 'direct') => {
    if (!profile?.uid) return;
    const next = !collapsedSections[section];
    setCollapsedSections((current) => ({ ...current, [section]: next }));
    setSectionCollapsed(profile.uid, section, next);
  };

  const handleToggleStar = (conversationId: string) => {
    if (!profile?.uid) return;
    setStarredIds(toggleStarredConversation(profile.uid, conversationId));
  };

  const activeTitle = activeConversation && profile?.uid
    ? getConversationTitle(activeConversation, profile.uid, nameByUid)
    : 'Chat';

  const activeSubtitle = useMemo(() => {
    if (!activeConversation) return 'Direct message';
    if (activeConversation.slug === EVERYONE_SLUG) {
      const onlineCount = getOnlineCount(activeConversation.memberIds);
      return `${onlineCount} online · Team-wide channel`;
    }
    if (activeConversation.type === 'group') {
      const onlineCount = getOnlineCount(activeConversation.memberIds);
      return `${onlineCount} online · ${activeConversation.memberIds.length} members`;
    }
    const otherUid = activeConversation.memberIds.find((uid) => uid !== profile?.uid);
    if (otherUid && isUserOnline(otherUid)) {
      return 'Online now';
    }
    return 'Offline';
  }, [activeConversation, profile?.uid, getOnlineCount, isUserOnline]);

  const filterConversations = useCallback(
    (items: ChatConversation[]) => {
      const query = sidebarQuery.trim().toLowerCase();
      if (!query) return items;

      return items.filter((conversation) => {
        const title = profile?.uid
          ? getConversationTitle(conversation, profile.uid, nameByUid).toLowerCase()
          : (conversation.name ?? 'Chat').toLowerCase();
        const preview = sidebarPreviewLine(
          conversationActivity.get(conversation.id),
          profile?.uid,
        ).toLowerCase();
        return title.includes(query) || preview.includes(query);
      });
    },
    [sidebarQuery, profile?.uid, nameByUid, conversationActivity],
  );

  const filteredEveryone = useMemo(
    () => filterConversations(everyoneConversations),
    [filterConversations, everyoneConversations],
  );
  const filteredGroups = useMemo(
    () => filterConversations(groupConversations),
    [filterConversations, groupConversations],
  );
  const filteredDirect = useMemo(
    () => filterConversations(directConversations),
    [filterConversations, directConversations],
  );

  const hasSidebarResults =
    filteredEveryone.length + filteredGroups.length + filteredDirect.length > 0;

  const composerLabel = useMemo(() => {
    if (!activeConversation || !profile?.uid) return undefined;
    const title = getConversationTitle(activeConversation, profile.uid, nameByUid);
    if (activeConversation.slug === EVERYONE_SLUG) return `#${title.replace(/^#/, '')}`;
    if (activeConversation.type === 'group') return title;
    return title;
  }, [activeConversation, profile?.uid, nameByUid]);

  const firstUnreadId = useMemo(() => {
    if (!profile?.uid || !activeConversationId) return null;
    const lastRead = getConversationLastRead(profile.uid, activeConversationId);
    return firstUnreadMessageId(messages, lastRead, profile.uid);
  }, [profile?.uid, activeConversationId, messages]);

  const emptyThreadCopy = useMemo(() => {
    if (!activeConversation) return 'Select a conversation to start messaging.';
    if (activeConversation.slug === EVERYONE_SLUG) {
      return 'This is your team channel. Say hi to everyone.';
    }
    if (activeConversation.type === 'group') {
      return 'No messages in this group yet. Start the conversation.';
    }
    return 'This is the beginning of your direct message history.';
  }, [activeConversation]);

  const handleMessagesScroll = () => {
    const element = messagesRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
    if (isNearBottomRef.current) {
      setNewMessagesBelow(0);
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setNewMessagesBelow(0);
    isNearBottomRef.current = true;
  };

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id ?? null;
    const conversationChanged = activeConversationId !== prevConversationRef.current;

    if (conversationChanged) {
      prevConversationRef.current = activeConversationId;
      prevLastMessageIdRef.current = lastMessageId;
      isNearBottomRef.current = true;
      setNewMessagesBelow(0);

      if (firstUnreadId && unreadAnchorRef.current !== activeConversationId) {
        unreadAnchorRef.current = activeConversationId;
        requestAnimationFrame(() => {
          document.getElementById(`chat-message-${firstUnreadId}`)?.scrollIntoView({
            behavior: 'auto',
            block: 'center',
          });
        });
        return;
      }

      scrollToBottom('auto');
      return;
    }

    if (lastMessageId && lastMessageId !== prevLastMessageIdRef.current) {
      prevLastMessageIdRef.current = lastMessageId;
      if (isNearBottomRef.current) {
        scrollToBottom(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
      } else if (lastMessage?.senderId !== profile?.uid) {
        setNewMessagesBelow((current) => current + 1);
      }
    }
  }, [messages, activeConversationId, firstUnreadId, profile?.uid]);

  useEffect(() => {
    const conversationParam = searchParams.get('c');
    if (conversationParam && conversationParam !== activeConversationId) {
      setActiveConversationId(conversationParam);
      setMobileShowThread(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, activeConversationId, setActiveConversationId, setSearchParams]);

  useEffect(() => {
    setViewingConversationId(activeConversationId);
    if (activeConversationId && profile?.uid) {
      const latest = [...messages]
        .reverse()
        .find((message) => message.status !== 'pending' && message.status !== 'failed');
      void markConversationRead(activeConversationId, latest?.createdAt ?? Date.now());
    }
    return () => setViewingConversationId(null);
  }, [activeConversationId, messages, markConversationRead, profile?.uid, setViewingConversationId]);

  const handleSend = async (text: string) => {
    const mentionedUids = extractMentionedUids(text, usersByDisplayName);
    await sendMessage(text, mentionedUids);
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setMobileShowThread(true);
  };

  const handleRefresh = () => {
    void refreshConversations().then(() => refreshMessages());
  };

  const handleLoadOlder = () => {
    const element = messagesRef.current;
    const previousHeight = element?.scrollHeight ?? 0;
    void loadOlderMessages().then(() => {
      requestAnimationFrame(() => {
        if (!element) return;
        element.scrollTop = element.scrollHeight - previousHeight;
      });
    });
  };

  const handleLeaveConversation = async (conversation: ChatConversation) => {
    const title = profile?.uid
      ? getConversationTitle(conversation, profile.uid, nameByUid)
      : conversation.name ?? 'Chat';

    if (
      !window.confirm(
        conversation.type === 'direct'
          ? `Remove ${title} from your chat list?`
          : `Leave "${title}" and remove it from your chat list?`,
      )
    ) {
      return;
    }

    try {
      await leaveConversation(conversation.id);
      if (activeConversationId === conversation.id) {
        setMobileShowThread(false);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not remove conversation.');
    }
  };

  if (!isConfigured) {
    return (
      <Card className="chat-empty-card">
        <CardHeader title="Messages" subtitle="Stored in Supabase" />
        <p className="chat-empty-text">
          Add Supabase env vars and run migrations, then reload.
        </p>
      </Card>
    );
  }

  return (
    <div
      className={clsx(
        'chat-layout',
        mobileShowThread && 'chat-layout-mobile-thread',
      )}
    >
      <Card
        className={clsx('chat-sidebar', mobileShowThread && 'chat-sidebar-mobile-hidden')}
        padding={false}
      >
        <div className="chat-sidebar-head">
          <h3>Messages</h3>
          <div className="chat-sidebar-actions">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Start a direct message"
              onClick={() => setShowDirectModal(true)}
            >
              <UserPlus size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Create a group"
              onClick={() => setShowGroupModal(true)}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>

        <div className="chat-sidebar-search">
          <Search size={15} className="chat-sidebar-search-icon" aria-hidden />
          <input
            type="search"
            className="chat-sidebar-search-input"
            value={sidebarQuery}
            onChange={(event) => setSidebarQuery(event.target.value)}
            placeholder="Search or jump with ⌘K"
            aria-label="Search conversations"
          />
          {sidebarQuery && (
            <button
              type="button"
              className="chat-sidebar-search-clear"
              aria-label="Clear search"
              onClick={() => setSidebarQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <nav className="chat-conversation-list">
          {loading && conversations.length === 0 && (
            <div className="chat-sidebar-empty">
              <div className="spinner" />
              <p>Loading conversations…</p>
            </div>
          )}

          {!loading && !hasSidebarResults && starredConversations.length === 0 && (
            <div className="chat-sidebar-empty">
              <MessageCircle size={22} />
              <p>{sidebarQuery ? 'No conversations match your search.' : 'No conversations yet.'}</p>
              {!sidebarQuery && (
                <Button variant="secondary" size="sm" onClick={() => setShowDirectModal(true)}>
                  Start a message
                </Button>
              )}
            </div>
          )}

          {starredConversations.length > 0 && (
            <section className="chat-conversation-section">
              <button
                type="button"
                className="chat-conversation-section-toggle"
                onClick={() => toggleSection('starred')}
                aria-expanded={!collapsedSections.starred}
              >
                {collapsedSections.starred ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Starred</span>
              </button>
              {!collapsedSections.starred &&
                starredConversations.map((conversation) => (
                  <ConversationButton
                    key={`starred-${conversation.id}`}
                    conversation={conversation}
                    profileUid={profile?.uid}
                    nameByUid={nameByUid}
                    usersByUid={usersByUid}
                    activity={conversationActivity.get(conversation.id)}
                    unreadCount={resolveUnreadCount(
                      conversation.id,
                      conversationActivity.get(conversation.id),
                    )}
                    isActive={conversation.id === activeConversationId}
                    isStarred
                    isUserOnline={isUserOnline}
                    onSelect={handleSelectConversation}
                    onToggleStar={handleToggleStar}
                    onLeave={handleLeaveConversation}
                  />
                ))}
            </section>
          )}

          {filteredEveryone.length > 0 && (
            <section className="chat-conversation-section">
              <button
                type="button"
                className="chat-conversation-section-toggle"
                onClick={() => toggleSection('channels')}
                aria-expanded={!collapsedSections.channels}
              >
                {collapsedSections.channels ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Channels</span>
              </button>
              {!collapsedSections.channels &&
                filteredEveryone.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  profileUid={profile?.uid}
                  nameByUid={nameByUid}
                  usersByUid={usersByUid}
                  activity={conversationActivity.get(conversation.id)}
                  unreadCount={resolveUnreadCount(
                    conversation.id,
                    conversationActivity.get(conversation.id),
                  )}
                  isActive={conversation.id === activeConversationId}
                  isStarred={starredIds.includes(conversation.id)}
                  isUserOnline={isUserOnline}
                  onSelect={handleSelectConversation}
                  onToggleStar={handleToggleStar}
                  onLeave={handleLeaveConversation}
                />
              ))}
            </section>
          )}

          {filteredGroups.length > 0 && (
            <section className="chat-conversation-section">
              <button
                type="button"
                className="chat-conversation-section-toggle"
                onClick={() => toggleSection('groups')}
                aria-expanded={!collapsedSections.groups}
              >
                {collapsedSections.groups ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Groups</span>
              </button>
              {!collapsedSections.groups &&
                filteredGroups.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  profileUid={profile?.uid}
                  nameByUid={nameByUid}
                  usersByUid={usersByUid}
                  activity={conversationActivity.get(conversation.id)}
                  unreadCount={resolveUnreadCount(
                    conversation.id,
                    conversationActivity.get(conversation.id),
                  )}
                  isActive={conversation.id === activeConversationId}
                  isStarred={starredIds.includes(conversation.id)}
                  isUserOnline={isUserOnline}
                  onSelect={handleSelectConversation}
                  onToggleStar={handleToggleStar}
                  onLeave={handleLeaveConversation}
                />
              ))}
            </section>
          )}

          {filteredDirect.length > 0 && (
            <section className="chat-conversation-section">
              <button
                type="button"
                className="chat-conversation-section-toggle"
                onClick={() => toggleSection('direct')}
                aria-expanded={!collapsedSections.direct}
              >
                {collapsedSections.direct ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>Direct messages</span>
              </button>
              {!collapsedSections.direct &&
                filteredDirect.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  profileUid={profile?.uid}
                  nameByUid={nameByUid}
                  usersByUid={usersByUid}
                  activity={conversationActivity.get(conversation.id)}
                  unreadCount={resolveUnreadCount(
                    conversation.id,
                    conversationActivity.get(conversation.id),
                  )}
                  isActive={conversation.id === activeConversationId}
                  isStarred={starredIds.includes(conversation.id)}
                  isUserOnline={isUserOnline}
                  onSelect={handleSelectConversation}
                  onToggleStar={handleToggleStar}
                  onLeave={handleLeaveConversation}
                />
              ))}
            </section>
          )}
        </nav>
      </Card>

      <Card
        className={clsx('chat-shell', !mobileShowThread && 'chat-shell-mobile-hidden')}
        padding={false}
      >
        <div className="chat-head">
          <div className="chat-head-main">
            {mobileShowThread && (
              <Button
                variant="ghost"
                size="sm"
                className="chat-back-btn"
                onClick={() => setMobileShowThread(false)}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={18} />
              </Button>
            )}
            {activeConversation && (
              <ConversationAvatar
                conversation={activeConversation}
                profileUid={profile?.uid}
                usersByUid={usersByUid}
                nameByUid={nameByUid}
                size="md"
                className="chat-head-avatar"
                showOnline={activeConversation.type === 'direct'}
                isOnline={
                  activeConversation.type === 'direct'
                    ? isUserOnline(
                        activeConversation.memberIds.find((uid) => uid !== profile?.uid) ?? '',
                      )
                    : false
                }
              />
            )}
            <CardHeader title={activeTitle} subtitle={activeSubtitle} />
          </div>
          <div className="chat-head-actions">
            <span
              className={clsx(
                'chat-connection-status',
                connectionStatus === 'connected' && 'chat-connection-status-live',
                connectionStatus === 'reconnecting' && 'chat-connection-status-reconnecting',
              )}
              aria-label={connectionStatusLabel(connectionStatus)}
            >
              <span className="chat-connection-dot" />
              <span className="chat-head-action-text">
                {connectionStatusLabel(connectionStatus)}
              </span>
            </span>
            {activeConversation && (
              <Button
                variant="secondary"
                size="sm"
                className="chat-manage-members-btn"
                aria-label="Manage conversation members"
                onClick={() => setShowMembersModal(true)}
              >
                <Users size={15} />
                <span>Members</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Refresh messages"
              onClick={handleRefresh}
            >
              <RefreshCw size={15} />
              <span className="chat-head-action-text">Refresh</span>
            </Button>
          </div>
        </div>

        {error && (
          <div className="chat-banner-wrap">
            <div className="alert-banner">
              <p>{error}</p>
            </div>
          </div>
        )}

        <div
          className="chat-messages"
          ref={messagesRef}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Messages"
          onScroll={handleMessagesScroll}
        >
          {loading ? (
            <div className="chat-loading">
              <div className="spinner" />
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty-thread">
              <MessageCircle size={28} />
              <p>{emptyThreadCopy}</p>
            </div>
          ) : (
            <ChatMessageList
              messages={messages}
              myUid={profile?.uid}
              myProfile={myProfile}
              usersByUid={usersByUid}
              mentionNames={mentionNames}
              hasMoreOlder={hasMoreOlder}
              loadingOlder={loadingOlder}
              firstUnreadMessageId={firstUnreadId}
              onLoadOlder={handleLoadOlder}
              onRetry={(messageId) => void retryMessage(messageId)}
              onDelete={async (messageId) => {
                try {
                  await deleteMessage(messageId);
                } catch (err) {
                  window.alert(
                    err instanceof Error ? err.message : 'Could not delete message.',
                  );
                }
              }}
            />
          )}
          <div ref={bottomRef} />
        </div>

        {newMessagesBelow > 0 && (
          <div className="chat-new-messages-banner-wrap">
            <button
              type="button"
              className="chat-new-messages-banner"
              onClick={() => scrollToBottom('smooth')}
            >
              ↓ {newMessagesBelow} new message{newMessagesBelow === 1 ? '' : 's'}
            </button>
          </div>
        )}

        <ChatComposer
          firebaseUid={profile?.uid}
          conversationId={activeConversationId}
          conversationLabel={composerLabel}
          disabled={!activeConversationId}
          mentionOptions={mentionOptions}
          onSend={handleSend}
        />
      </Card>

      {showQuickSwitcher && profile?.uid && (
        <ChatQuickSwitcher
          conversations={sortedConversations}
          profileUid={profile.uid}
          nameByUid={nameByUid}
          usersByUid={usersByUid}
          conversationActivity={conversationActivity}
          onSelect={(conversationId) => {
            handleSelectConversation(conversationId);
          }}
          onClose={() => setShowQuickSwitcher(false)}
        />
      )}

      {showDirectModal && (
        <NewDirectModal
          users={chatUsers}
          onClose={() => setShowDirectModal(false)}
          onSelect={startDirectChat}
        />
      )}

      {showGroupModal && (
        <NewGroupModal
          users={chatUsers}
          onClose={() => setShowGroupModal(false)}
          onCreate={startGroupChat}
        />
      )}

      {showMembersModal && activeConversation && profile?.uid && (
        <GroupMembersModal
          conversation={activeConversation}
          users={users}
          myUid={profile.uid}
          isUserOnline={isUserOnline}
          onClose={() => setShowMembersModal(false)}
          onAddMembers={async (memberUids) => {
            await addGroupMembers(activeConversation.id, memberUids);
          }}
          onRemoveMember={async (memberUid) => {
            await removeGroupMember(activeConversation.id, memberUid);
            if (memberUid === profile.uid) {
              setShowMembersModal(false);
            }
          }}
        />
      )}
    </div>
  );
}

function ConversationButton({
  conversation,
  profileUid,
  nameByUid,
  usersByUid,
  activity,
  unreadCount,
  isActive,
  isStarred,
  isUserOnline,
  onSelect,
  onToggleStar,
  onLeave,
}: {
  conversation: ChatConversation;
  profileUid?: string;
  nameByUid: Map<string, string>;
  usersByUid: Map<string, { uid: string; displayName: string; photoURL?: string }>;
  activity?: ConversationActivity;
  unreadCount: number;
  isActive: boolean;
  isStarred: boolean;
  isUserOnline: (firebaseUid: string) => boolean;
  onSelect: (id: string) => void;
  onToggleStar: (id: string) => void;
  onLeave?: (conversation: ChatConversation) => void;
}) {
  const title = profileUid
    ? getConversationTitle(conversation, profileUid, nameByUid)
    : conversation.name ?? 'Chat';
  const hasUnread = unreadCount > 0;
  const preview = sidebarPreviewLine(activity, profileUid);
  const otherUid =
    conversation.type === 'direct' && profileUid
      ? conversation.memberIds.find((uid) => uid !== profileUid)
      : undefined;
  const showLeave = Boolean(onLeave) && canLeaveConversation(conversation);

  return (
    <div className={clsx('chat-conversation-row', isActive && 'chat-conversation-row-active')}>
      <button
        type="button"
        id={`chat-conversation-${conversation.id}`}
        className={clsx(
          'chat-conversation-item',
          isActive && 'chat-conversation-item-active',
          hasUnread && 'chat-conversation-item-unread',
          showLeave && 'chat-conversation-item-with-actions',
        )}
        aria-label={hasUnread ? `${title}, ${unreadCount} unread` : title}
        onClick={() => onSelect(conversation.id)}
      >
        <ConversationAvatar
          conversation={conversation}
          profileUid={profileUid}
          usersByUid={usersByUid}
          nameByUid={nameByUid}
          showOnline={conversation.type === 'direct'}
          isOnline={otherUid ? isUserOnline(otherUid) : false}
        />
        <span className="chat-conversation-copy">
          {activity && !hasUnread && (
            <span className="chat-conversation-time">
              {formatSidebarTimestamp(activity.lastMessageAt)}
            </span>
          )}
          <span className="chat-conversation-title">{title}</span>
          <span className={clsx('chat-conversation-preview', hasUnread && 'chat-conversation-preview-unread')}>
            {preview}
          </span>
          {hasUnread ? (
            <span className="chat-conversation-unread-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </span>
      </button>
      {showLeave && (
        <button
          type="button"
          className="chat-conversation-leave"
          aria-label={
            conversation.type === 'direct'
              ? `Remove ${title} from chat list`
              : `Leave ${title}`
          }
          onClick={(event) => {
            event.stopPropagation();
            void onLeave?.(conversation);
          }}
        >
          <Trash2 size={14} />
        </button>
      )}
      <button
        type="button"
        className={clsx('chat-conversation-star', isStarred && 'chat-conversation-star-active')}
        aria-label={isStarred ? 'Unstar conversation' : 'Star conversation'}
        onClick={() => onToggleStar(conversation.id)}
      >
        <Star size={14} fill={isStarred ? 'currentColor' : 'none'} />
      </button>
    </div>
  );
}

export function ChatPage() {
  const { profile } = useAuth();

  return (
    <ChatProvider senderId={profile?.uid} senderName={profile?.displayName ?? 'User'}>
      <ChatPageContent />
    </ChatProvider>
  );
}
