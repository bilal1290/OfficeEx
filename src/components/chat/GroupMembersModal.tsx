import { useMemo, useState } from 'react';
import { UserMinus, UserPlus, X } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { Button } from '../ui/Button';
import {
  canManageConversationMembers,
  canRemoveConversationMember,
  isEditableGroup,
} from '../../lib/supabase-chat';
import { getChatEligibleUsers } from '../../lib/chat-users';
import { useRolePermissions } from '../../context/RolePermissionsContext';
import type { ChatConversation, UserProfile } from '../../types';

interface GroupMembersModalProps {
  conversation: ChatConversation;
  users: UserProfile[];
  myUid: string;
  isUserOnline: (firebaseUid: string) => boolean;
  onClose: () => void;
  onAddMembers: (memberUids: string[]) => Promise<void>;
  onRemoveMember: (memberUid: string) => Promise<void>;
}

function resolveMemberProfile(
  uid: string,
  users: UserProfile[],
): Pick<UserProfile, 'uid' | 'displayName' | 'email' | 'photoURL'> {
  const existing = users.find((user) => user.uid === uid);
  if (existing) return existing;

  return {
    uid,
    displayName: 'Removed user',
    email: 'No longer has access',
  };
}

export function GroupMembersModal({
  conversation,
  users,
  myUid,
  isUserOnline,
  onClose,
  onAddMembers,
  onRemoveMember,
}: GroupMembersModalProps) {
  const { config: rolePermissionsConfig } = useRolePermissions();
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManage = canManageConversationMembers(conversation, myUid);
  const canAddMembers = isEditableGroup(conversation) && canManage;

  const members = useMemo(
    () =>
      conversation.memberIds
        .map((uid) => resolveMemberProfile(uid, users))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [conversation.memberIds, users],
  );

  const addCandidates = useMemo(
    () =>
      getChatEligibleUsers(users, myUid, rolePermissionsConfig).filter(
        (user) => !conversation.memberIds.includes(user.uid),
      ),
    [users, myUid, conversation.memberIds, rolePermissionsConfig],
  );

  const toggleAdd = (uid: string) => {
    setSelectedToAdd((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid],
    );
  };

  const handleAdd = async () => {
    if (selectedToAdd.length === 0) return;
    setError('');
    setSaving(true);
    try {
      await onAddMembers(selectedToAdd);
      setSelectedToAdd([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add members.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (uid: string) => {
    const member = members.find((item) => item.uid === uid);
    const actionLabel = uid === myUid ? 'leave this conversation' : `remove ${member?.displayName ?? 'this member'} from chat`;
    if (!window.confirm(`Are you sure you want to ${actionLabel}?`)) return;

    setError('');
    setRemovingUid(uid);
    try {
      await onRemoveMember(uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member.');
    } finally {
      setRemovingUid(null);
    }
  };

  if (!canManage) {
    return null;
  }

  const title =
    conversation.slug === 'everyone' || conversation.name === 'Everyone'
      ? 'Everyone members'
      : conversation.type === 'direct'
        ? 'Direct message members'
        : 'Group members';

  return (
    <div className="chat-modal-backdrop" onClick={onClose}>
      <div className="chat-modal chat-modal-wide" onClick={(event) => event.stopPropagation()}>
        <div className="chat-modal-head">
          <h3>{title}</h3>
          <button type="button" className="chat-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="chat-modal-label">{conversation.name ?? 'Conversation'}</p>

        <ul className="chat-member-list">
          {members.map((member) => {
            const canRemove = canRemoveConversationMember(conversation, myUid, member.uid);
            const removeLabel = member.uid === myUid ? 'Leave' : 'Remove';

            return (
              <li key={member.uid} className="chat-member-item">
                <UserAvatar
                  user={member}
                  size="sm"
                  showOnline={member.displayName !== 'Removed user'}
                  isOnline={isUserOnline(member.uid)}
                />
                <div className="chat-member-copy">
                  <span className="chat-member-name">{member.displayName}</span>
                  <span className="chat-member-email">
                    {member.displayName === 'Removed user'
                      ? member.email
                      : isUserOnline(member.uid)
                        ? 'Online now'
                        : member.email}
                  </span>
                </div>
                {member.uid === conversation.createdBy && (
                  <span className="chat-member-role">Creator</span>
                )}
                {canRemove && (
                  <Button
                    type="button"
                    variant={member.uid === myUid ? 'secondary' : 'danger'}
                    size="sm"
                    className="chat-member-remove-btn"
                    disabled={removingUid === member.uid}
                    onClick={() => void handleRemove(member.uid)}
                  >
                    <UserMinus size={14} />
                    {removingUid === member.uid ? 'Removing…' : removeLabel}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>

        {canAddMembers && addCandidates.length > 0 && (
          <>
            <p className="chat-modal-label">
              <UserPlus size={14} />
              Add members
            </p>
            <ul className="chat-picker-list chat-picker-list-compact">
              {addCandidates.map((user) => (
                <li key={user.uid}>
                  <label className="chat-picker-check">
                    <input
                      type="checkbox"
                      checked={selectedToAdd.includes(user.uid)}
                      onChange={() => toggleAdd(user.uid)}
                    />
                    <UserAvatar user={user} size="sm" />
                    <span>{user.displayName}</span>
                  </label>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              disabled={saving || selectedToAdd.length === 0}
              onClick={() => void handleAdd()}
            >
              {saving ? 'Adding…' : `Add ${selectedToAdd.length || ''} member${selectedToAdd.length === 1 ? '' : 's'}`}
            </Button>
          </>
        )}

        <p className="chat-member-hint">
          Any member can remove others from this conversation or delete any message.
        </p>

        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
