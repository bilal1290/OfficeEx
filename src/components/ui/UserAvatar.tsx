import { useEffect, useState } from 'react';
import { getInitials, getUserAvatarUrl } from '../../lib/users';
import { clsx } from '../../lib/utils';

export interface AvatarUser {
  uid: string;
  displayName: string;
  photoURL?: string;
}

interface UserAvatarProps {
  user: AvatarUser;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnline?: boolean;
  isOnline?: boolean;
}

const sizeClass = {
  sm: 'user-avatar-sm',
  md: 'user-avatar-md',
  lg: 'user-avatar-lg',
  xl: 'user-avatar-xl',
} as const;

export function UserAvatar({
  user,
  size = 'md',
  className,
  showOnline = false,
  isOnline = false,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !imageFailed;
  const initials = getInitials(user.displayName);

  useEffect(() => {
    setImageFailed(false);
  }, [user.photoURL, user.uid]);

  return (
    <div
      className={clsx(
        'user-avatar',
        sizeClass[size],
        showOnline && 'user-avatar-with-status',
        className,
      )}
      aria-hidden={!user.displayName}
      title={
        showOnline
          ? `${user.displayName} · ${isOnline ? 'Online now' : 'Offline'}`
          : user.displayName
      }
    >
      <div className="user-avatar-inner">
        {showImage ? (
          <img
            key={user.photoURL}
            src={getUserAvatarUrl(user)}
            alt=""
            className="user-avatar-image"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="user-avatar-fallback">{initials}</span>
        )}
      </div>
      {showOnline && isOnline && (
        <span className="user-avatar-status-dot user-avatar-status-dot-online" aria-hidden />
      )}
    </div>
  );
}
