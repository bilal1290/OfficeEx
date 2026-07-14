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
  filterMentionOptions,
  getActiveMentionQuery,
  insertMention,
  type MentionOption,
} from '../../lib/chat-mentions';
import { clsx } from '../../lib/utils';

interface ChatComposerProps {
  disabled?: boolean;
  mentionOptions: MentionOption[];
  onSend: (text: string) => Promise<void>;
}

export function ChatComposer({
  disabled,
  mentionOptions,
  onSend,
}: ChatComposerProps) {
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const cursorRef = useRef(0);

  const activeMention = useMemo(() => {
    return getActiveMentionQuery(draft, cursorRef.current);
  }, [draft]);

  const mentionSuggestions = useMemo(() => {
    if (!activeMention) return [];
    return filterMentionOptions(mentionOptions, activeMention.query);
  }, [activeMention, mentionOptions]);

  const showMentions = Boolean(activeMention && mentionSuggestions.length > 0);

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, mentionSuggestions.length]);

  const submit = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || disabled) return;

    setSendError('');
    setDraft('');
    cursorRef.current = 0;

    try {
      await onSend(trimmed);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send message.');
    }
  }, [draft, disabled, onSend]);

  const pickMention = useCallback(
    (option: MentionOption) => {
      const cursor = textareaRef.current?.selectionStart ?? cursorRef.current;
      const result = insertMention(draft, cursor, option.displayName);
      setDraft(result.text);
      cursorRef.current = result.cursor;
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(result.cursor, result.cursor);
      });
    },
    [draft],
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
          return `${current.slice(0, active.start)}${current.slice(cursor)}`;
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
          <ul className="chat-mention-menu" role="listbox">
            {mentionSuggestions.map((option, index) => (
              <li key={option.uid}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === mentionIndex}
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
          }}
          onClick={(event) => {
            cursorRef.current = event.currentTarget.selectionStart;
          }}
          onKeyUp={(event) => {
            cursorRef.current = event.currentTarget.selectionStart;
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message #channel or @someone"
          rows={2}
          disabled={disabled}
        />
      </div>
      <Button type="submit" disabled={disabled || !draft.trim()}>
        <Send size={16} />
        Send
      </Button>
      {sendError && <p className="chat-composer-error form-error">{sendError}</p>}
    </form>
  );
}
