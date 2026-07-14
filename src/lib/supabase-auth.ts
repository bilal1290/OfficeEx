/**
 * Internal Supabase session for chat RLS. Users sign in with Firebase only.
 */
import type { User } from 'firebase/auth';
import { supabase, isSupabaseConfigured } from './supabase';

const SUPABASE_EMAIL_SUFFIX = '@users.officeex.app';

function toSupabaseEmail(firebaseUid: string): string {
  return `${firebaseUid}${SUPABASE_EMAIL_SUFFIX}`;
}

async function deriveSupabasePassword(firebaseUid: string, anonKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(anonKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`officeex:${firebaseUid}`),
  );
  const bytes = new Uint8Array(signature);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readSupabaseKey(): string {
  return (
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    ''
  ).trim();
}

async function upsertSupabaseProfile(
  firebaseUser: User,
  displayName?: string,
): Promise<void> {
  if (!supabase) return;

  const session = await supabase.auth.getSession();
  const supabaseUserId = session.data.session?.user?.id;
  if (!supabaseUserId) return;

  const resolvedName =
    displayName?.trim() ||
    firebaseUser.displayName?.trim() ||
    firebaseUser.email?.split('@')[0] ||
    'User';

  const { error } = await supabase.from('profiles').upsert(
    {
      id: supabaseUserId,
      firebase_uid: firebaseUser.uid,
      display_name: resolvedName,
      email: firebaseUser.email ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncSupabaseSession(
  firebaseUser: User,
  displayName?: string,
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    return;
  }

  const anonKey = readSupabaseKey();
  const email = toSupabaseEmail(firebaseUser.uid);
  const password = await deriveSupabasePassword(firebaseUser.uid, anonKey);

  const existing = await supabase.auth.getSession();
  if (existing.data.session?.user?.email === email) {
    await upsertSupabaseProfile(firebaseUser, displayName);
    return;
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) {
    await upsertSupabaseProfile(firebaseUser, displayName);
    return;
  }

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        firebase_uid: firebaseUser.uid,
        display_name: displayName ?? firebaseUser.displayName ?? 'User',
      },
    },
  });

  if (signUp.error && !signUp.error.message.toLowerCase().includes('already registered')) {
    throw new Error(signUp.error.message);
  }

  const retrySignIn = await supabase.auth.signInWithPassword({ email, password });
  if (retrySignIn.error) {
    throw new Error(retrySignIn.error.message);
  }

  await upsertSupabaseProfile(firebaseUser, displayName);
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function checkSupabaseConnection(): Promise<{
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
          'Chat tables are missing in Supabase. Open Supabase Dashboard → SQL Editor, run supabase/migrations/001_chat.sql, then sign out and back in.',
      };
    }

    return { connected: false, message: error.message };
  }

  return { connected: true, message: 'Supabase chat is connected.' };
}
