import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(key: string): string {
  return (import.meta.env[key] as string | undefined)?.trim() ?? '';
}

function readSupabaseKey(): string {
  return readEnv('VITE_SUPABASE_ANON_KEY') || readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabaseConfig = {
  url: readEnv('VITE_SUPABASE_URL'),
  anonKey: readSupabaseKey(),
};

export const isSupabaseConfigured = Boolean(
  supabaseConfig.url && supabaseConfig.anonKey,
);

export const missingSupabaseKeys = (
  [
    ['VITE_SUPABASE_URL', supabaseConfig.url],
    ['VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY', supabaseConfig.anonKey],
  ] as const
).filter(([, value]) => !value).map(([key]) => key);

let supabase: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
  });
}

export { supabase };
