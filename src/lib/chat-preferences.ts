const starredKey = (uid: string) => `officeex.chat.starred.${uid}`;
const mutedKey = (uid: string) => `officeex.chat.muted.${uid}`;
const draftsKey = (uid: string) => `officeex.chat.drafts.${uid}`;
const sectionsKey = (uid: string) => `officeex.chat.sections.${uid}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

export function getStarredConversationIds(firebaseUid: string): string[] {
  return readJson<string[]>(starredKey(firebaseUid), []);
}

export function toggleStarredConversation(
  firebaseUid: string,
  conversationId: string,
): string[] {
  const current = new Set(getStarredConversationIds(firebaseUid));
  if (current.has(conversationId)) {
    current.delete(conversationId);
  } else {
    current.add(conversationId);
  }
  const next = [...current];
  writeJson(starredKey(firebaseUid), next);
  return next;
}

export function isConversationMuted(firebaseUid: string, conversationId: string): boolean {
  return readJson<string[]>(mutedKey(firebaseUid), []).includes(conversationId);
}

export function toggleConversationMuted(
  firebaseUid: string,
  conversationId: string,
): boolean {
  const current = new Set(readJson<string[]>(mutedKey(firebaseUid), []));
  const muted = current.has(conversationId);
  if (muted) {
    current.delete(conversationId);
  } else {
    current.add(conversationId);
  }
  writeJson(mutedKey(firebaseUid), [...current]);
  return !muted;
}

export function getConversationDraft(firebaseUid: string, conversationId: string): string {
  const drafts = readJson<Record<string, string>>(draftsKey(firebaseUid), {});
  return drafts[conversationId] ?? '';
}

export function setConversationDraft(
  firebaseUid: string,
  conversationId: string,
  text: string,
): void {
  const drafts = readJson<Record<string, string>>(draftsKey(firebaseUid), {});
  if (text.trim()) {
    drafts[conversationId] = text;
  } else {
    delete drafts[conversationId];
  }
  writeJson(draftsKey(firebaseUid), drafts);
}

export function isSectionCollapsed(
  firebaseUid: string,
  section: 'starred' | 'channels' | 'groups' | 'direct',
): boolean {
  const sections = readJson<Record<string, boolean>>(sectionsKey(firebaseUid), {});
  return sections[section] ?? false;
}

export function setSectionCollapsed(
  firebaseUid: string,
  section: 'starred' | 'channels' | 'groups' | 'direct',
  collapsed: boolean,
): void {
  const sections = readJson<Record<string, boolean>>(sectionsKey(firebaseUid), {});
  sections[section] = collapsed;
  writeJson(sectionsKey(firebaseUid), sections);
}
