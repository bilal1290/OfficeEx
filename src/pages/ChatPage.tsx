import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  RefreshCw,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatProvider, useChat } from '../context/ChatContext';
import { useUsers } from '../hooks/useUsers';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { ConversationAvatar } from '../components/chat/ConversationAvatar';
import { getChatEligibleUsers } from '../lib/chat-users';
import { UserAvatar } from '../components/ui/UserAvatar';
import { toMentionOptions, extractMentionedUids } from '../lib/chat-mentions';
import { useChatNotifications } from '../context/ChatNotificationContext';
import { GroupMembersModal } from '../components/chat/GroupMembersModal';
import {
  EVERYONE_SLUG,
  getConversationTitle,
  isEditableGroup,
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
    <div className="chat-modal-backdrop" onClick={onClose}>
      <div className="chat-modal" onClick={(event) => event.stopPropagation()}>
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
    <div className="chat-modal-backdrop" onClick={onClose}>
      <form className="chat-modal" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
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
    retryMessage,
    loadOlderMessages,
    refreshConversations,
    refreshMessages,
    startDirectChat,
    startGroupChat,
    addGroupMembers,
    removeGroupMember,
  } = useChat();

  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const chatUsers = useMemo(
    () => getChatEligibleUsers(users, profile?.uid),
    [users, profile?.uid],
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversationId]);

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
    if (activeConversationId) {
      void markConversationRead(activeConversationId);
    }
    return () => setViewingConversationId(null);
  }, [activeConversationId, markConversationRead, setViewingConversationId]);

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
              title="New message"
              onClick={() => setShowDirectModal(true)}
            >
              <UserPlus size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="New group"
              onClick={() => setShowGroupModal(true)}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>

        <nav className="chat-conversation-list">
          {everyoneConversations.length > 0 && (
            <section className="chat-conversation-section">
              <p className="chat-conversation-section-label">Channels</p>
              {everyoneConversations.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  profileUid={profile?.uid}
                  nameByUid={nameByUid}
                  usersByUid={usersByUid}
                  activity={conversationActivity.get(conversation.id)}
                  unreadCount={getConversationUnreadCount(conversation.id)}
                  isActive={conversation.id === activeConversationId}
                  isUserOnline={isUserOnline}
                  onSelect={handleSelectConversation}
                />
              ))}
            </section>
          )}

          {groupConversations.length > 0 && (
            <section className="chat-conversation-section">
              <p className="chat-conversation-section-label">Groups</p>
              {groupConversations.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  profileUid={profile?.uid}
                  nameByUid={nameByUid}
                  usersByUid={usersByUid}
                  activity={conversationActivity.get(conversation.id)}
                  unreadCount={getConversationUnreadCount(conversation.id)}
                  isActive={conversation.id === activeConversationId}
                  isUserOnline={isUserOnline}
                  onSelect={handleSelectConversation}
                />
              ))}
            </section>
          )}

          {directConversations.length > 0 && (
            <section className="chat-conversation-section">
              <p className="chat-conversation-section-label">Direct</p>
              {directConversations.map((conversation) => (
                <ConversationButton
                  key={conversation.id}
                  conversation={conversation}
                  profileUid={profile?.uid}
                  nameByUid={nameByUid}
                  usersByUid={usersByUid}
                  activity={conversationActivity.get(conversation.id)}
                  unreadCount={getConversationUnreadCount(conversation.id)}
                  isActive={conversation.id === activeConversationId}
                  isUserOnline={isUserOnline}
                  onSelect={handleSelectConversation}
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
              title={connectionStatusLabel(connectionStatus)}
            >
              <span className="chat-connection-dot" />
              {connectionStatusLabel(connectionStatus)}
            </span>
            {activeConversation && isEditableGroup(activeConversation) && (
              <Button variant="ghost" size="sm" onClick={() => setShowMembersModal(true)}>
                <Users size={15} />
                Members
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefresh}>
              <RefreshCw size={15} />
              Refresh
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

        <div className="chat-messages" ref={messagesRef}>
          {loading ? (
            <div className="chat-loading">
              <div className="spinner" />
              <p>Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty-thread">
              <MessageCircle size={28} />
              <p>No messages yet. Say hello.</p>
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
              onLoadOlder={() => void loadOlderMessages()}
              onRetry={(messageId) => void retryMessage(messageId)}
            />
          )}
          <div ref={bottomRef} />
        </div>

        <ChatComposer
          disabled={!activeConversationId}
          mentionOptions={mentionOptions}
          onSend={handleSend}
        />
      </Card>

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
  isUserOnline,
  onSelect,
}: {
  conversation: ChatConversation;
  profileUid?: string;
  nameByUid: Map<string, string>;
  usersByUid: Map<string, { uid: string; displayName: string; photoURL?: string }>;
  activity?: ConversationActivity;
  unreadCount: number;
  isActive: boolean;
  isUserOnline: (firebaseUid: string) => boolean;
  onSelect: (id: string) => void;
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

  return (
    <button
      type="button"
      className={clsx(
        'chat-conversation-item',
        isActive && 'chat-conversation-item-active',
        hasUnread && 'chat-conversation-item-unread',
      )}
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
        <span className="chat-conversation-title-row">
          <span className="chat-conversation-title">{title}</span>
          {activity && (
            <span className="chat-conversation-time">
              {formatSidebarTimestamp(activity.lastMessageAt)}
            </span>
          )}
        </span>
        <span className={clsx('chat-conversation-preview', hasUnread && 'chat-conversation-preview-unread')}>
          {preview}
        </span>
      </span>
      {hasUnread ? (
        <span className="chat-conversation-unread-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      ) : null}
    </button>
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
