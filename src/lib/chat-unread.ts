const PREFIX = 'officeex.chat.lastRead';

export function getConversationLastRead(
  firebaseUid: string,
  conversationId: string,
): number {
  try {
    const raw = localStorage.getItem(`${PREFIX}.${firebaseUid}.${conversationId}`);
    return raw ? Number(raw) : 0;
  } catch {
    return 0;
  }
}

export function setConversationLastRead(
  firebaseUid: string,
  conversationId: string,
  timestamp: number,
): void {
  try {
    localStorage.setItem(`${PREFIX}.${firebaseUid}.${conversationId}`, String(timestamp));
  } catch {
    // Ignore storage failures.
  }
}

export function markAllConversationsReadLocal(
  firebaseUid: string,
  conversationIds: string[],
  timestamp = Date.now(),
): void {
  for (const conversationId of conversationIds) {
    setConversationLastRead(firebaseUid, conversationId, timestamp);
  }
}

export function countUnreadMessagesSince(
  messages: Array<{ createdAt: number; senderId: string; status?: string }>,
  lastReadAt: number,
  myUid: string,
): number {
  return messages.filter(
    (message) =>
      message.status !== 'failed' &&
      message.status !== 'pending' &&
      message.createdAt > lastReadAt &&
      message.senderId !== myUid,
  ).length;
}

export function hasUnreadSince(
  lastMessageAt: number | undefined,
  lastReadAt: number,
  myUid: string,
  lastSenderId?: string,
): boolean {
  if (!lastMessageAt || lastMessageAt <= lastReadAt) return false;
  if (lastSenderId === myUid) return false;
  return true;
}

export function firstUnreadMessageId(
  messages: Array<{ id: string; createdAt: number; senderId: string; status?: string }>,
  lastReadAt: number,
  myUid: string,
): string | null {
  const unread = messages.find(
    (message) =>
      message.status !== 'failed' &&
      message.status !== 'pending' &&
      message.createdAt > lastReadAt &&
      message.senderId !== myUid,
  );
  return unread?.id ?? null;
}
