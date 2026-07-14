import { supabase, isSupabaseConfigured } from './supabase';
import type { ChatMessage } from '../types';

function mapRow(row: {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
}): ChatMessage {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    text: row.text,
    createdAt: new Date(row.created_at).getTime(),
  };
}

export function isSupabaseChatReady(): boolean {
  return isSupabaseConfigured;
}

export async function fetchChatMessages(): Promise<ChatMessage[]> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, sender_id, sender_name, text, created_at')
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapRow);
}

export async function sendChatMessage(
  senderId: string,
  senderName: string,
  text: string,
): Promise<ChatMessage> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message text is required.');
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      sender_id: senderId,
      sender_name: senderName,
      text: trimmed,
    })
    .select('id, sender_id, sender_name, text, created_at')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data);
}

export function subscribeToChatMessages(onChange: () => void): () => void {
  if (!supabase) {
    return () => undefined;
  }

  const channel = supabase
    .channel('officeex-team-chat')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages' },
      () => onChange(),
    )
    .subscribe();

  return () => {
    if (!supabase) return;
    void supabase.removeChannel(channel);
  };
}
