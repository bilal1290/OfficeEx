import { Fragment, useMemo, type ReactNode } from 'react';
import { splitMessageMentions } from '../../lib/chat-mentions';

interface ChatMessageBodyProps {
  text: string;
  mentionNames: string[];
}

const TOKEN_PATTERN =
  /(`[^`]+`|\*[^*]+\*|_[^_]+_|https?:\/\/[^\s<]+[^\s<.,;:!?)])/g;

function formatPlainText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  const pattern = new RegExp(TOKEN_PATTERN);
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      nodes.push(
        <code key={`code-${tokenIndex}`} className="chat-inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('*')) {
      nodes.push(<strong key={`bold-${tokenIndex}`}>{token.slice(1, -1)}</strong>);
    } else if (token.startsWith('_')) {
      nodes.push(<em key={`italic-${tokenIndex}`}>{token.slice(1, -1)}</em>);
    } else {
      nodes.push(
        <a
          key={`url-${tokenIndex}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-message-link"
        >
          {token}
        </a>,
      );
    }

    lastIndex = match.index + token.length;
    tokenIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function renderMultilineText(text: string, keyPrefix: string): ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIndex) => {
    const isQuote = line.startsWith('>');
    const content = isQuote ? line.slice(1).trimStart() : line;
    const formatted = formatPlainText(content);

    const lineNode = (
      <Fragment key={`${keyPrefix}-${lineIndex}`}>
        {formatted}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </Fragment>
    );

    if (isQuote) {
      return (
        <blockquote key={`${keyPrefix}-quote-${lineIndex}`} className="chat-message-quote">
          {lineNode}
        </blockquote>
      );
    }

    return lineNode;
  });
}

export function ChatMessageBody({ text, mentionNames }: ChatMessageBodyProps) {
  const segments = useMemo(
    () => splitMessageMentions(text, mentionNames),
    [text, mentionNames],
  );

  return (
    <div className="chat-message-text">
      {segments.map((segment, index) =>
        segment.type === 'mention' ? (
          <span key={`${index}-${segment.value}`} className="chat-mention">
            @{segment.value}
          </span>
        ) : (
          <span key={`${index}-text`}>{renderMultilineText(segment.value, `seg-${index}`)}</span>
        ),
      )}
    </div>
  );
}
