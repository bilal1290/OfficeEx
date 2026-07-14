import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatProvider, useChat } from '../context/ChatContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { formatDateTime } from '../lib/datetime';
import { clsx } from '../lib/utils';

function ChatPageContent() {
  const { profile } = useAuth();
  const { messages, loading, sending, error, isConfigured, sendMessage, refreshMessages } =
    useChat();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    setSendError('');
    try {
      await sendMessage(draft);
      setDraft('');
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send message.');
    }
  };

  if (!isConfigured) {
    return (
      <Card className="chat-empty-card">
        <CardHeader title="Team chat" subtitle="Stored in Supabase" />
        <p className="chat-empty-text">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to{' '}
          <code>.env</code>, run <code>supabase/migrations/001_chat.sql</code>, then reload.
          Firebase login and expenses are unchanged.
        </p>
      </Card>
    );
  }

  return (
    <div className="chat-page">
      <Card className="chat-shell" padding={false}>
        <div className="chat-head">
          <CardHeader
            title="Team chat"
            subtitle="Realtime messages stored in Supabase"
          />
          <div className="chat-head-actions">
            <Button variant="ghost" size="sm" onClick={() => void refreshMessages()}>
              <RefreshCw size={15} />
              Refresh
            </Button>
          </div>
        </div>

        {(error || sendError) && (
          <div className="chat-banner-wrap">
            <div className="alert-banner">
              <p>{error ?? sendError}</p>
              <p className="chat-error-hint">
                Sign out and back in if messages fail after setup. Chat uses Supabase;
                login uses Firebase.
              </p>
            </div>
          </div>
        )}

        <div className="chat-messages">
          {loading && messages.length === 0 ? (
            <div className="chat-loading">
              <div className="spinner" />
              <p>Loading chat...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty-thread">
              <MessageCircle size={28} />
              <p>No messages yet. Start the conversation.</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === profile?.uid;
              return (
                <article
                  key={message.id}
                  className={clsx('chat-message', isMine && 'chat-message-mine')}
                >
                  <div className="chat-message-meta">
                    <strong>{message.senderName}</strong>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p className="chat-message-text">{message.text}</p>
                </article>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form className="chat-composer" onSubmit={handleSend}>
          <textarea
            className="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message..."
            rows={2}
            disabled={sending}
          />
          <Button type="submit" disabled={sending || !draft.trim()}>
            <Send size={16} />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function ChatPage() {
  const { profile } = useAuth();

  return (
    <ChatProvider senderId={profile?.uid} senderName={profile?.displayName ?? 'User'}>
      <ChatPageContent />
    </ChatProvider>
  );
}
