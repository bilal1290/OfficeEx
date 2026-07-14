import { MessageCircle, MessagesSquare, Users } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { EVERYONE_SLUG, getConversationTitle } from '../../lib/supabase-chat';
import { clsx } from '../../lib/utils';
import type { AvatarUser } from '../ui/UserAvatar';
import type { ChatConversation } from '../../types';

interface ConversationAvatarProps {
  conversation: ChatConversation;
  profileUid?: string;
  usersByUid: Map<string, AvatarUser>;
  nameByUid: Map<string, string>;
  size?: 'sm' | 'md';
  className?: string;
  showOnline?: boolean;
  isOnline?: boolean;
}

const iconSize = { sm: 14, md: 18 } as const;

export function ConversationAvatar({
  conversation,
  profileUid,
  usersByUid,
  nameByUid,
  size = 'sm',
  className,
  showOnline = false,
  isOnline = false,
}: ConversationAvatarProps) {
  if (conversation.type === 'direct' && profileUid) {
    const otherUid = conversation.memberIds.find((uid) => uid !== profileUid);
    const user = otherUid ? usersByUid.get(otherUid) : undefined;
    if (user) {
      return (
        <UserAvatar
          user={user}
          size={size}
          className={className}
          showOnline={showOnline}
          isOnline={isOnline}
        />
      );
    }
  }

  const Icon =
    conversation.slug === EVERYONE_SLUG
      ? Users
      : conversation.type === 'group'
        ? MessagesSquare
        : MessageCircle;

  const label = profileUid
    ? getConversationTitle(conversation, profileUid, nameByUid)
    : conversation.name ?? 'Chat';

  return (
    <div
      className={clsx('chat-conversation-icon-avatar', `user-avatar-${size}`, className)}
      aria-hidden
      title={label}
    >
      <Icon size={iconSize[size]} />
    </div>
  );
}
