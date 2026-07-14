import { useMemo } from 'react';
import { splitMessageMentions } from '../../lib/chat-mentions';

interface ChatMessageBodyProps {
  text: string;
  mentionNames: string[];
}

export function ChatMessageBody({ text, mentionNames }: ChatMessageBodyProps) {
  const segments = useMemo(
    () => splitMessageMentions(text, mentionNames),
    [text, mentionNames],
  );

  return (
    <p className="chat-message-text">
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span key={`${index}-${segment.value}`} className="chat-mention">
            @{segment.value}
          </span>
        ) : (
          <span key={`${index}-text`}>{segment.value}</span>
        ),
      )}
    </p>
  );
}
