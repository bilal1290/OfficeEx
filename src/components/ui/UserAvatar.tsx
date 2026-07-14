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
}

const sizeClass = {
  sm: 'user-avatar-sm',
  md: 'user-avatar-md',
  lg: 'user-avatar-lg',
  xl: 'user-avatar-xl',
} as const;

export function UserAvatar({ user, size = 'md', className }: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !imageFailed;
  const initials = getInitials(user.displayName);

  useEffect(() => {
    setImageFailed(false);
  }, [user.photoURL, user.uid]);

  return (
    <div
      className={clsx('user-avatar', sizeClass[size], className)}
      aria-hidden={!user.displayName}
      title={user.displayName}
    >
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
  );
}
