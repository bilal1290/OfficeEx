import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  getConversationDraft,
  setConversationDraft,
} from '../../lib/chat-preferences';
import {
  filterMentionOptions,
  getActiveMentionQuery,
  insertMention,
  type MentionOption,
} from '../../lib/chat-mentions';
import { clsx } from '../../lib/utils';

interface ChatComposerProps {
  firebaseUid?: string;
  conversationId?: string | null;
  conversationLabel?: string;
  disabled?: boolean;
  mentionOptions: MentionOption[];
  onSend: (text: string) => Promise<void>;
}

export function ChatComposer({
  firebaseUid,
  conversationId,
  conversationLabel,
  disabled,
  mentionOptions,
  onSend,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousConversationRef = useRef<string | null | undefined>(conversationId);
  const cursorRef = useRef(0);

  const activeMention = useMemo(() => {
    return getActiveMentionQuery(draft, cursorRef.current);
  }, [draft]);

  const mentionSuggestions = useMemo(() => {
    if (!activeMention) return [];
    return filterMentionOptions(mentionOptions, activeMention.query);
  }, [activeMention, mentionOptions]);

  const showMentions = Boolean(activeMention && mentionSuggestions.length > 0);

  const placeholder = conversationLabel
    ? `Message ${conversationLabel}`
    : 'Message #channel or @someone';

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, mentionSuggestions.length]);

  useEffect(() => {
    const previousId = previousConversationRef.current;
    if (firebaseUid && previousId && previousId !== conversationId) {
      setConversationDraft(firebaseUid, previousId, draft);
    }

    if (firebaseUid && conversationId) {
      setDraft(getConversationDraft(firebaseUid, conversationId));
    } else {
      setDraft('');
    }

    setSendError('');
    previousConversationRef.current = conversationId;
    cursorRef.current = 0;
    requestAnimationFrame(resizeTextarea);
  }, [conversationId, firebaseUid, resizeTextarea]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    resizeTextarea();
  }, [draft, resizeTextarea]);

  const persistDraft = useCallback(
    (value: string) => {
      if (firebaseUid && conversationId) {
        setConversationDraft(firebaseUid, conversationId, value);
      }
    },
    [firebaseUid, conversationId],
  );

  const submit = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;

    setSendError('');
    const sentText = trimmed;
    setDraft('');
    persistDraft('');
    cursorRef.current = 0;
    requestAnimationFrame(resizeTextarea);

    try {
      await onSend(sentText);
    } catch (err) {
      setDraft(sentText);
      persistDraft(sentText);
      setSendError(err instanceof Error ? err.message : 'Could not send message.');
    }
  }, [draft, disabled, onSend, persistDraft, resizeTextarea]);

  const pickMention = useCallback(
    (option: MentionOption) => {
      const cursor = textareaRef.current?.selectionStart ?? cursorRef.current;
      const result = insertMention(draft, cursor, option.displayName);
      setDraft(result.text);
      persistDraft(result.text);
      cursorRef.current = result.cursor;
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(result.cursor, result.cursor);
        resizeTextarea();
      });
    },
    [draft, persistDraft, resizeTextarea],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionIndex((current) => (current + 1) % mentionSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex(
          (current) => (current - 1 + mentionSuggestions.length) % mentionSuggestions.length,
        );
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const option = mentionSuggestions[mentionIndex];
        if (option) pickMention(option);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDraft((current) => {
          const cursor = textareaRef.current?.selectionStart ?? cursorRef.current;
          const active = getActiveMentionQuery(current, cursor);
          if (!active) return current;
          const next = `${current.slice(0, active.start)}${current.slice(cursor)}`;
          persistDraft(next);
          return next;
        });
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <div className="chat-composer-field">
        {showMentions && (
          <ul className="chat-mention-menu" role="listbox" aria-label="Mention suggestions">
            {mentionSuggestions.map((option, index) => (
              <li key={option.uid}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === mentionIndex}
                  aria-label={`Mention ${option.displayName}`}
                  className={clsx(
                    'chat-mention-option',
                    index === mentionIndex && 'chat-mention-option-active',
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pickMention(option);
                  }}
                >
                  <span className="chat-mention-option-name">{option.displayName}</span>
                  <span className="chat-mention-option-email">{option.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={draft}
          onChange={(event) => {
            cursorRef.current = event.target.selectionStart;
            setDraft(event.target.value);
            persistDraft(event.target.value);
          }}
          onClick={(event) => {
            cursorRef.current = event.currentTarget.selectionStart;
          }}
          onKeyUp={(event) => {
            cursorRef.current = event.currentTarget.selectionStart;
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          aria-label={placeholder}
        />
        <p className="chat-composer-hint">Enter to send · Shift+Enter for new line</p>
      </div>
      <Button type="submit" disabled={disabled || !draft.trim()} aria-label="Send message">
        <Send size={16} />
        <span className="chat-composer-send-label">Send</span>
      </Button>
      {sendError && <p className="chat-composer-error form-error">{sendError}</p>}
    </form>
  );
}
