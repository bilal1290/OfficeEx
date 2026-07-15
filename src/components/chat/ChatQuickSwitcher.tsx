import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getConversationTitle } from '../../lib/supabase-chat';
import { sidebarPreviewLine, type ConversationActivity } from '../../lib/chat-activity';
import { ConversationAvatar } from './ConversationAvatar';
import type { ChatConversation } from '../../types';

interface ChatQuickSwitcherProps {
  conversations: ChatConversation[];
  profileUid: string;
  nameByUid: Map<string, string>;
  usersByUid: Map<string, { uid: string; displayName: string; photoURL?: string }>;
  conversationActivity: Map<string, ConversationActivity>;
  onSelect: (conversationId: string) => void;
  onClose: () => void;
}

export function ChatQuickSwitcher({
  conversations,
  profileUid,
  nameByUid,
  usersByUid,
  conversationActivity,
  onSelect,
  onClose,
}: ChatQuickSwitcherProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...conversations].sort((a, b) => {
      const titleA = getConversationTitle(a, profileUid, nameByUid).toLowerCase();
      const titleB = getConversationTitle(b, profileUid, nameByUid).toLowerCase();
      return titleA.localeCompare(titleB);
    });

    if (!q) return sorted.slice(0, 12);

    return sorted.filter((conversation) => {
      const title = getConversationTitle(conversation, profileUid, nameByUid).toLowerCase();
      const preview = sidebarPreviewLine(
        conversationActivity.get(conversation.id),
        profileUid,
      ).toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [conversations, query, profileUid, nameByUid, conversationActivity]);

  return (
    <div
      className="chat-quick-switcher-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="chat-quick-switcher"
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
      >
        <div className="chat-quick-switcher-head">
          <Search size={18} aria-hidden />
          <input
            type="search"
            className="chat-quick-switcher-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Jump to channel or conversation"
            aria-label="Jump to channel or conversation"
            autoFocus
          />
          <button type="button" className="chat-quick-switcher-close" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <ul className="chat-quick-switcher-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="chat-quick-switcher-empty">No conversations found</li>
          ) : (
            filtered.map((conversation) => {
              const title = getConversationTitle(conversation, profileUid, nameByUid);
              const preview = sidebarPreviewLine(
                conversationActivity.get(conversation.id),
                profileUid,
              );

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    className="chat-quick-switcher-item"
                    role="option"
                    onClick={() => {
                      onSelect(conversation.id);
                      onClose();
                    }}
                  >
                    <ConversationAvatar
                      conversation={conversation}
                      profileUid={profileUid}
                      usersByUid={usersByUid}
                      nameByUid={nameByUid}
                      size="sm"
                    />
                    <span className="chat-quick-switcher-copy">
                      <span className="chat-quick-switcher-title">{title}</span>
                      <span className="chat-quick-switcher-preview">{preview}</span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <p className="chat-quick-switcher-hint">
          <kbd>Enter</kbd> open · <kbd>Esc</kbd> close · <kbd>⌘K</kbd> anytime
        </p>
      </div>
    </div>
  );
}
