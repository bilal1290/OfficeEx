import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

const PRESENCE_CHANNEL = 'officeex-chat-presence';
const HEARTBEAT_MS = 45_000;

export interface ChatPresencePayload {
  firebase_uid: string;
  display_name: string;
  online_at: string;
}

type PresenceListener = (onlineUids: ReadonlySet<string>) => void;

interface PresenceTracker {
  firebaseUid: string;
  displayName: string;
}

interface PresenceHub {
  channel: RealtimeChannel | null;
  listeners: Set<PresenceListener>;
  trackers: Map<string, PresenceTracker>;
  onlineUids: Set<string>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  isChannelReady: boolean;
  shouldBePresent: boolean;
}

const hub: PresenceHub = {
  channel: null,
  listeners: new Set(),
  trackers: new Map(),
  onlineUids: new Set(),
  heartbeatTimer: null,
  isChannelReady: false,
  shouldBePresent: false,
};

function notifyPresenceListeners(): void {
  const snapshot = new Set(hub.onlineUids);
  for (const listener of hub.listeners) {
    listener(snapshot);
  }
}

function parsePresenceState(state: Record<string, ChatPresencePayload[]>): Set<string> {
  const online = new Set<string>();
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      if (entry?.firebase_uid) {
        online.add(entry.firebase_uid);
      }
    }
  }
  return online;
}

function refreshOnlineFromChannel(): void {
  if (!hub.channel) return;
  hub.onlineUids = parsePresenceState(
    hub.channel.presenceState() as Record<string, ChatPresencePayload[]>,
  );
  notifyPresenceListeners();
}

async function publishPresence(): Promise<void> {
  if (!hub.channel || !hub.isChannelReady || !hub.shouldBePresent) return;

  const tracker = [...hub.trackers.values()][0];
  if (!tracker) return;

  await hub.channel.track({
    firebase_uid: tracker.firebaseUid,
    display_name: tracker.displayName,
    online_at: new Date().toISOString(),
  });
}

async function unpublishPresence(): Promise<void> {
  if (!hub.channel || !hub.isChannelReady) return;
  await hub.channel.untrack();
}

function stopHeartbeat(): void {
  if (hub.heartbeatTimer) {
    clearInterval(hub.heartbeatTimer);
    hub.heartbeatTimer = null;
  }
}

function startHeartbeat(): void {
  stopHeartbeat();
  hub.heartbeatTimer = setInterval(() => {
    void publishPresence();
  }, HEARTBEAT_MS);
}

function updateDocumentPresence(): void {
  if (typeof document === 'undefined') return;

  const visible = document.visibilityState === 'visible';
  hub.shouldBePresent = visible && hub.trackers.size > 0;

  if (hub.shouldBePresent) {
    void publishPresence();
    startHeartbeat();
    return;
  }

  stopHeartbeat();
  void unpublishPresence();
}

let documentListenersInitialized = false;

function ensureDocumentListeners(): void {
  if (typeof document === 'undefined' || documentListenersInitialized) {
    return;
  }

  documentListenersInitialized = true;
  document.addEventListener('visibilitychange', updateDocumentPresence);
  window.addEventListener('online', updateDocumentPresence);
  window.addEventListener('offline', () => {
    hub.shouldBePresent = false;
    stopHeartbeat();
    void unpublishPresence();
  });
}

function ensurePresenceChannel(): void {
  if (!supabase || hub.channel) return;

  const tracker = [...hub.trackers.values()][0];
  if (!tracker) return;

  ensureDocumentListeners();

  hub.channel = supabase.channel(PRESENCE_CHANNEL, {
    config: {
      presence: {
        key: tracker.firebaseUid,
      },
    },
  });

  hub.channel
    .on('presence', { event: 'sync' }, () => refreshOnlineFromChannel())
    .on('presence', { event: 'join' }, () => refreshOnlineFromChannel())
    .on('presence', { event: 'leave' }, () => refreshOnlineFromChannel())
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        hub.isChannelReady = true;
        updateDocumentPresence();
        refreshOnlineFromChannel();
        return;
      }

      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        hub.isChannelReady = false;
        stopHeartbeat();
        if (supabase && hub.channel) {
          void supabase.removeChannel(hub.channel);
        }
        hub.channel = null;
        hub.onlineUids.clear();
        notifyPresenceListeners();

        if (hub.listeners.size > 0) {
          window.setTimeout(() => ensurePresenceChannel(), 2000);
        }
      }
    });
}

function teardownPresenceChannel(): void {
  stopHeartbeat();
  hub.shouldBePresent = false;
  hub.isChannelReady = false;

  if (supabase && hub.channel) {
    void supabase.removeChannel(hub.channel);
  }

  hub.channel = null;
  hub.onlineUids.clear();
  notifyPresenceListeners();
}

export function subscribeToChatPresence(
  firebaseUid: string,
  displayName: string,
  onChange: PresenceListener,
): () => void {
  if (!supabase) {
    onChange(new Set());
    return () => undefined;
  }

  hub.listeners.add(onChange);
  hub.trackers.set(firebaseUid, { firebaseUid, displayName });
  ensurePresenceChannel();
  onChange(new Set(hub.onlineUids));

  if (hub.isChannelReady) {
    updateDocumentPresence();
    refreshOnlineFromChannel();
  }

  return () => {
    hub.listeners.delete(onChange);
    hub.trackers.delete(firebaseUid);

    if (hub.trackers.size === 0) {
      void unpublishPresence();
      teardownPresenceChannel();
      return;
    }

    updateDocumentPresence();
  };
}

export async function reconnectChatPresenceAfterAuth(): Promise<void> {
  if (!supabase || hub.listeners.size === 0) return;

  if (hub.channel) {
    hub.isChannelReady = false;
    stopHeartbeat();
    await supabase.removeChannel(hub.channel);
    hub.channel = null;
  }

  ensurePresenceChannel();
}

export function countOnlineMembers(
  memberIds: string[],
  onlineUids: ReadonlySet<string>,
): number {
  let count = 0;
  for (const memberId of memberIds) {
    if (onlineUids.has(memberId)) {
      count += 1;
    }
  }
  return count;
}
