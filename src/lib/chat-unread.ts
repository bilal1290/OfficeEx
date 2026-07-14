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
