import { memo, useMemo } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { ChatMessageBody } from './ChatMessageBody';
import { formatChatDayLabel, formatChatTime } from '../../lib/datetime';
import { clsx } from '../../lib/utils';
import type { AvatarUser } from '../ui/UserAvatar';
import type { ChatMessage } from '../../types';

interface ChatMessageItemProps {
  message: ChatMessage;
  isMine: boolean;
  sender: AvatarUser;
  mentionNames: string[];
  onRetry?: (messageId: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
  message,
  isMine,
  sender,
  mentionNames,
  onRetry,
}: ChatMessageItemProps) {
  const isPending = message.status === 'pending';
  const isFailed = message.status === 'failed';

  return (
    <article
      className={clsx(
        'chat-message',
        isMine && 'chat-message-mine',
        isPending && 'chat-message-pending',
        isFailed && 'chat-message-failed',
      )}
    >
      <UserAvatar user={sender} size="sm" className="chat-message-avatar" />
      <div className="chat-message-body">
        <div className="chat-message-meta">
          <strong>{isMine ? 'You' : message.senderName}</strong>
          <span title={new Date(message.createdAt).toLocaleString()}>
            {formatChatTime(message.createdAt)}
            {isPending && ' · Sending…'}
          </span>
        </div>
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
                onClick={() => onRetry(message.id)}
              >
                <RotateCcw size={14} />
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </article>
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

export function ChatMessageList({
  messages,
  myUid,
  myProfile,
  usersByUid,
  mentionNames,
  hasMoreOlder,
  loadingOlder,
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
          {group.messages.map((message) => {
            const isMine = message.senderId === myUid;
            return (
              <ChatMessageItem
                key={message.id}
                message={message}
                isMine={isMine}
                sender={resolveSender(message, isMine)}
                mentionNames={mentionNames}
                onRetry={onRetry}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}
