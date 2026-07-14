import { useMemo, useState } from 'react';
import { UserMinus, UserPlus, X } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { Button } from '../ui/Button';
import {
  canRemoveGroupMember,
  isEditableGroup,
} from '../../lib/supabase-chat';
import { getChatEligibleUsers } from '../../lib/chat-users';
import { clsx } from '../../lib/utils';
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

export function GroupMembersModal({
  conversation,
  users,
  myUid,
  isUserOnline,
  onClose,
  onAddMembers,
  onRemoveMember,
}: GroupMembersModalProps) {
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isCreator = conversation.createdBy === myUid;
  const canManage = isEditableGroup(conversation) && conversation.memberIds.includes(myUid);

  const members = useMemo(
    () =>
      conversation.memberIds
        .map((uid) => users.find((user) => user.uid === uid))
        .filter((user): user is UserProfile => Boolean(user))
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [conversation.memberIds, users],
  );

  const addCandidates = useMemo(
    () =>
      getChatEligibleUsers(users, myUid).filter(
        (user) => !conversation.memberIds.includes(user.uid),
      ),
    [users, myUid, conversation.memberIds],
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

  return (
    <div className="chat-modal-backdrop" onClick={onClose}>
      <div className="chat-modal chat-modal-wide" onClick={(event) => event.stopPropagation()}>
        <div className="chat-modal-head">
          <h3>Group members</h3>
          <button type="button" className="chat-modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="chat-modal-label">{conversation.name ?? 'Group'}</p>

        <ul className="chat-member-list">
          {members.map((member) => {
            const canRemove = canRemoveGroupMember(conversation, myUid, member.uid);
            const removeLabel = member.uid === myUid ? 'Leave' : 'Remove';

            return (
              <li key={member.uid} className="chat-member-item">
                <UserAvatar user={member} size="sm" showOnline isOnline={isUserOnline(member.uid)} />
                <div className="chat-member-copy">
                  <span className="chat-member-name">{member.displayName}</span>
                  <span className="chat-member-email">
                    {isUserOnline(member.uid) ? 'Online now' : member.email}
                  </span>
                </div>
                {member.uid === conversation.createdBy && (
                  <span className="chat-member-role">Creator</span>
                )}
                {canRemove && (
                  <button
                    type="button"
                    className={clsx(
                      'chat-member-action',
                      member.uid === myUid && 'chat-member-action-leave',
                    )}
                    disabled={removingUid === member.uid}
                    onClick={() => void handleRemove(member.uid)}
                  >
                    <UserMinus size={14} />
                    {removingUid === member.uid ? 'Removing…' : removeLabel}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {addCandidates.length > 0 && (
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

        {!isCreator && (
          <p className="chat-member-hint">Only the group creator can remove other members.</p>
        )}

        {error && <p className="form-error">{error}</p>}
      </div>
    </div>
  );
}
