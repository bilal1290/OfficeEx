import { memo, useMemo, useState } from 'react';
import { AlertCircle, Check, Copy, RotateCcw } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { ChatMessageBody } from './ChatMessageBody';
import { formatChatDayLabel, formatChatTime } from '../../lib/datetime';
import { clsx } from '../../lib/utils';
import type { AvatarUser } from '../ui/UserAvatar';
import type { ChatMessage } from '../../types';

const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface ChatMessageItemProps {
  message: ChatMessage;
  isMine: boolean;
  sender: AvatarUser;
  mentionNames: string[];
  compact: boolean;
  showUnreadDivider?: boolean;
  onRetry?: (messageId: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  isMine,
  sender,
  mentionNames,
  compact,
  showUnreadDivider,
  onRetry,
}: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isPending = message.status === 'pending';
  const isFailed = message.status === 'failed';
  const fullTimestamp = new Date(message.createdAt).toLocaleString();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures.
    }
  };

  return (
    <>
      {showUnreadDivider && (
        <div className="chat-unread-divider" aria-label="New messages">
          <span>New</span>
        </div>
      )}
      <article
        id={`chat-message-${message.id}`}
        className={clsx(
          'chat-message',
          isMine && 'chat-message-mine',
          compact && 'chat-message-compact',
          isPending && 'chat-message-pending',
          isFailed && 'chat-message-failed',
        )}
      >
        {!compact ? (
          <UserAvatar user={sender} size="sm" className="chat-message-avatar" />
        ) : (
          <span className="chat-message-avatar-spacer" aria-hidden />
        )}
        <div className="chat-message-body">
          <div className="chat-message-actions" aria-label="Message actions">
            <button
              type="button"
              className="chat-message-action-btn"
              aria-label={copied ? 'Copied' : 'Copy message'}
              onClick={() => void handleCopy()}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          {!compact && (
            <div className="chat-message-meta">
              <strong>{isMine ? 'You' : message.senderName}</strong>
              <span className="chat-message-time">{formatChatTime(message.createdAt)}</span>
            </div>
          )}
          {compact && (
            <span className="chat-message-time-compact">
              {formatChatTime(message.createdAt)}
              {isPending && ' · Sending…'}
            </span>
          )}
          <ChatMessageBody text={message.text} mentionNames={mentionNames} />
          {isFailed && (
            <div className="chat-message-failed-actions">
              <span className="chat-message-failed-label">
                <AlertCircle size={14} />
                Failed to send
              </span>
              {onRetry && (
                <button
                  type="button"
                  className="chat-message-retry-btn"
                  aria-label="Retry sending this message"
                  onClick={() => onRetry(message.id)}
                >
                  <RotateCcw size={14} />
                  Retry
                </button>
              )}
            </div>
          )}
          {!compact && (
            <span className="chat-message-time-full" aria-hidden>
              {fullTimestamp}
            </span>
          )}
        </div>
      </article>
    </>
  );
});

export function groupMessagesByDay(messages: ChatMessage[]): Array<{
  dayKey: string;
  label: string;
  messages: ChatMessage[];
}> {
  const groups: Array<{ dayKey: string; label: string; messages: ChatMessage[] }> = [];
  let currentKey = '';

  for (const message of messages) {
    const date = new Date(message.createdAt);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (dayKey !== currentKey) {
      currentKey = dayKey;
      groups.push({
        dayKey,
        label: formatChatDayLabel(message.createdAt),
        messages: [message],
      });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }

  return groups;
}

function isCompactWithPrevious(previous: ChatMessage | undefined, current: ChatMessage): boolean {
  if (!previous) return false;
  if (previous.senderId !== current.senderId) return false;
  if (previous.status === 'failed' || current.status === 'failed') return false;
  if (previous.status === 'pending' || current.status === 'pending') return false;
  return current.createdAt - previous.createdAt <= GROUP_WINDOW_MS;
}

export function ChatMessageList({
  messages,
  myUid,
  myProfile,
  usersByUid,
  mentionNames,
  hasMoreOlder,
  loadingOlder,
  firstUnreadMessageId,
  onLoadOlder,
  onRetry,
}: {
  messages: ChatMessage[];
  myUid?: string;
  myProfile?: AvatarUser;
  usersByUid: Map<string, AvatarUser>;
  mentionNames: string[];
  hasMoreOlder?: boolean;
  loadingOlder?: boolean;
  firstUnreadMessageId?: string | null;
  onLoadOlder?: () => void;
  onRetry?: (messageId: string) => void;
}) {
  const groups = useMemo(() => groupMessagesByDay(messages), [messages]);

  const resolveSender = (message: ChatMessage, isMine: boolean): AvatarUser => {
    if (isMine && myProfile) {
      return myProfile;
    }
    return (
      usersByUid.get(message.senderId) ?? {
        uid: message.senderId,
        displayName: message.senderName,
      }
    );
  };

  return (
    <>
      {hasMoreOlder && onLoadOlder && (
        <div className="chat-load-older-wrap">
          <button
            type="button"
            className="chat-load-older-btn"
            aria-label="Load older messages"
            disabled={loadingOlder}
            onClick={() => onLoadOlder()}
          >
            {loadingOlder ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.dayKey} className="chat-day-group">
          <div className="chat-day-separator">
            <span>{group.label}</span>
          </div>
          {group.messages.map((message, index) => {
            const isMine = message.senderId === myUid;
            const previous = index > 0 ? group.messages[index - 1] : undefined;
            const compact = isCompactWithPrevious(previous, message);

            return (
              <ChatMessageItem
                key={message.id}
                message={message}
                isMine={isMine}
                sender={resolveSender(message, isMine)}
                mentionNames={mentionNames}
                compact={compact}
                showUnreadDivider={firstUnreadMessageId === message.id}
                onRetry={onRetry}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}
