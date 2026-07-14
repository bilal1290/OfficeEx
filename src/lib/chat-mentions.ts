import type { UserProfile } from '../types';

export interface MentionOption {
  uid: string;
  displayName: string;
  email: string;
}

/** Active @-mention query at cursor, or null if not mentioning. */
export function getActiveMentionQuery(
  text: string,
  cursor: number,
): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  const match = /(^|\s)@([^\n@]*)$/.exec(before);
  if (!match) return null;
  const query = match[2] ?? '';
  const start = before.length - query.length - 1;
  return { query, start };
}

export function filterMentionOptions(
  users: MentionOption[],
  query: string,
): MentionOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return users.slice(0, 8);
  return users
    .filter(
      (user) =>
        user.displayName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q),
    )
    .slice(0, 8);
}

export function insertMention(
  text: string,
  cursor: number,
  displayName: string,
): { text: string; cursor: number } {
  const active = getActiveMentionQuery(text, cursor);
  if (!active) {
    const mention = `@${displayName} `;
    const next = `${text.slice(0, cursor)}${mention}${text.slice(cursor)}`;
    return { text: next, cursor: cursor + mention.length };
  }

  const before = text.slice(0, active.start);
  const after = text.slice(cursor);
  const mention = `@${displayName} `;
  const next = `${before}${mention}${after}`;
  return { text: next, cursor: before.length + mention.length };
}

export function toMentionOptions(users: UserProfile[]): MentionOption[] {
  return users.map((user) => ({
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
  }));
}

/** Split message text into plain / mention segments for rendering. */
export function splitMessageMentions(
  text: string,
  displayNames: string[],
): Array<{ type: 'text' | 'mention'; value: string }> {
  if (!text || displayNames.length === 0) {
    return [{ type: 'text', value: text }];
  }

  const sorted = [...displayNames].sort((a, b) => b.length - a.length);
  const segments: Array<{ type: 'text' | 'mention'; value: string }> = [];
  let index = 0;

  while (index < text.length) {
    const at = text.indexOf('@', index);
    if (at === -1) {
      segments.push({ type: 'text', value: text.slice(index) });
      break;
    }

    if (at > index) {
      segments.push({ type: 'text', value: text.slice(index, at) });
    }

    const rest = text.slice(at + 1);
    const matched = sorted.find(
      (name) => rest.startsWith(name) && (rest.length === name.length || rest[name.length] === ' '),
    );

    if (matched) {
      segments.push({ type: 'mention', value: matched });
      index = at + 1 + matched.length;
    } else {
      segments.push({ type: 'text', value: '@' });
      index = at + 1;
    }
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

export function extractMentionedUids(
  text: string,
  usersByName: Map<string, string>,
): string[] {
  const segments = splitMessageMentions(text, [...usersByName.keys()]);
  const uids = new Set<string>();
  for (const segment of segments) {
    if (segment.type === 'mention') {
      const uid = usersByName.get(segment.value);
      if (uid) uids.add(uid);
    }
  }
  return [...uids];
}
