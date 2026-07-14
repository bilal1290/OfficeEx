/**
 * Supabase anonymous session for chat RLS. Firebase handles login; no emails sent.
 */
import type { User } from 'firebase/auth';
import { supabase, isSupabaseConfigured } from './supabase';

const syncPromises = new Map<string, Promise<void>>();

function formatSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('anonymous') && lower.includes('disabled')) {
    return 'Enable Anonymous sign-in: Supabase → Authentication → Providers → Anonymous → ON.';
  }
  return message;
}

async function upsertSupabaseProfile(
  supabaseUserId: string,
  firebaseUid: string,
  displayName: string,
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('profiles').upsert(
    {
      id: supabaseUserId,
      firebase_uid: firebaseUid,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'firebase_uid' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function runSupabaseChatSync(
  firebaseUid: string,
  displayName: string,
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    return;
  }

  const resolvedName = displayName.trim() || 'User';
  const existing = await supabase.auth.getSession();
  const sessionUser = existing.data.session?.user;
  const linkedUid = sessionUser?.user_metadata?.firebase_uid as string | undefined;

  if (existing.data.session && linkedUid === firebaseUid) {
    await upsertSupabaseProfile(sessionUser!.id, firebaseUid, resolvedName);
    await applySupabaseRealtimeAuth();
    return;
  }

  if (existing.data.session) {
    await supabase.auth.signOut();
  }

  const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
  if (anonError || !anonData.user) {
    throw new Error(formatSupabaseAuthError(anonError?.message ?? 'Anonymous sign-in failed.'));
  }

  const { error: updateError } = await supabase.auth.updateUser({
    data: {
      firebase_uid: firebaseUid,
      display_name: resolvedName,
    },
  });

  if (updateError) {
    throw new Error(formatSupabaseAuthError(updateError.message));
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    throw new Error(formatSupabaseAuthError(refreshError.message));
  }

  const supabaseUserId = refreshed.session?.user.id ?? anonData.user.id;
  await upsertSupabaseProfile(supabaseUserId, firebaseUid, resolvedName);
  await applySupabaseRealtimeAuth();
}

async function applySupabaseRealtimeAuth(): Promise<void> {
  if (!supabase) return;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    await supabase.realtime.setAuth(token);
  }
}

export async function syncSupabaseChatFromFirebase(
  firebaseUid: string,
  displayName: string,
): Promise<void> {
  const inFlight = syncPromises.get(firebaseUid);
  if (inFlight) {
    await inFlight;
    return;
  }

  const promise = runSupabaseChatSync(firebaseUid, displayName);
  syncPromises.set(firebaseUid, promise);

  try {
    await promise;
  } finally {
    syncPromises.delete(firebaseUid);
  }
}

export async function syncSupabaseSession(
  firebaseUser: User,
  displayName?: string,
): Promise<void> {
  await syncSupabaseChatFromFirebase(
    firebaseUser.uid,
    displayName ?? firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'User',
  );
}

export async function ensureSupabaseChatProfile(
  firebaseUid: string,
  displayName: string,
): Promise<void> {
  await syncSupabaseChatFromFirebase(firebaseUid, displayName);
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function checkSupabaseConnection(options?: {
  firebaseUid?: string;
  displayName?: string;
}): Promise<{
  connected: boolean;
  message: string;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { connected: false, message: 'Supabase env vars are missing.' };
  }

  const { error } = await supabase.from('profiles').select('id').limit(1);
  if (error) {
    const schemaCacheError =
      error.message.includes('schema cache') ||
      error.message.includes('Could not find the table');

    if (schemaCacheError) {
      return {
        connected: false,
        message:
          'Chat tables are missing. Run supabase/migrations/001_chat.sql in Supabase SQL Editor.',
      };
    }

    return { connected: false, message: error.message };
  }

  if (options?.firebaseUid) {
    try {
      await syncSupabaseChatFromFirebase(
        options.firebaseUid,
        options.displayName ?? 'User',
      );
    } catch (syncError) {
      return {
        connected: false,
        message:
          syncError instanceof Error ? syncError.message : 'Chat session sync failed.',
      };
    }
  }

  const session = await supabase.auth.getSession();
  if (!session.data.session) {
    return {
      connected: false,
      message: 'Sign in to OfficeEx, then test chat connection once.',
    };
  }

  const linkedUid = session.data.session.user.user_metadata?.firebase_uid as string | undefined;
  return {
    connected: true,
    message: linkedUid
      ? `Chat connected for Firebase user ${linkedUid.slice(0, 8)}…`
      : 'Supabase chat session is active.',
  };
}
