import { useState } from 'react';
import { ClipboardCopy, Database, ExternalLink, PlayCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { checkSupabaseConnection } from '../../lib/supabase-auth';
import { checkChatDeleteSupport } from '../../lib/supabase-chat';
import {
  CHAT_DELETE_NOT_SETUP_MESSAGE,
  CHAT_DELETE_SETUP_SQL,
  CHAT_DELETE_SQL_EDITOR_URL,
} from '../../lib/chat-delete-setup-sql';
import { isSupabaseConfigured, missingSupabaseKeys, supabaseConfig } from '../../lib/supabase';
import { copyTextToClipboard } from '../../lib/utils';
import { Button } from '../ui/Button';

export function SupabaseChatSetup() {
  const { isAdmin, profile } = useAuth();
  const [testing, setTesting] = useState(false);
  const [testingDelete, setTestingDelete] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin) {
    return null;
  }

  const handleCopySql = async () => {
    const ok = await copyTextToClipboard(CHAT_DELETE_SETUP_SQL);
    setCopyState(ok ? 'copied' : 'failed');
    window.setTimeout(() => setCopyState('idle'), 2500);
  };

  const handleTest = async () => {
    if (!profile?.uid) {
      setError('Sign in to OfficeEx first, then test chat connection.');
      return;
    }

    setTesting(true);
    setResult('');
    setError('');
    try {
      const status = await checkSupabaseConnection({
        firebaseUid: profile.uid,
        displayName: profile.displayName,
      });
      if (status.connected) {
        setResult(status.message);
      } else {
        setError(status.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Supabase test failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleTestDelete = async () => {
    if (!profile?.uid) {
      setError('Sign in to OfficeEx first, then test chat delete.');
      return;
    }

    setTestingDelete(true);
    setResult('');
    setError('');
    try {
      await checkSupabaseConnection({
        firebaseUid: profile.uid,
        displayName: profile.displayName,
      });
      const status = await checkChatDeleteSupport();
      if (status.ready) {
        setResult(status.message);
      } else {
        setError(status.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat delete test failed.');
    } finally {
      setTestingDelete(false);
    }
  };

  return (
    <div className="chat-drive-setup">
      <p className="chat-drive-project-url">
        Supabase project:{' '}
        <a href={CHAT_DELETE_SQL_EDITOR_URL} target="_blank" rel="noreferrer">
          <code>{supabaseConfig.url || 'not set'}</code>
        </a>
      </p>

      <div className="chat-delete-setup-box">
        <h4>Enable chat delete (required once)</h4>
        <ol className="chat-drive-checklist-list">
          <li>
            <Button variant="secondary" size="sm" onClick={() => void handleCopySql()}>
              <ClipboardCopy size={15} />
              {copyState === 'copied' ? 'Copied!' : copyState === 'failed' ? 'Copy failed' : 'Copy SQL'}
            </Button>
          </li>
          <li>
            <a href={CHAT_DELETE_SQL_EDITOR_URL} target="_blank" rel="noreferrer">
              Open Supabase SQL Editor <ExternalLink size={14} />
            </a>
          </li>
          <li>Paste the SQL and click <strong>Run</strong></li>
          <li>Reload OfficeEx, then click <strong>Test chat delete</strong> below</li>
        </ol>
      </div>

      <ol className="chat-drive-checklist-list">
        <li>
          Enable{' '}
          <a
            href="https://supabase.com/dashboard/project/mrspndxusvczftygqjez/auth/providers?provider=Anonymous"
            target="_blank"
            rel="noreferrer"
          >
            Anonymous sign-in
          </a>{' '}
          → toggle <strong>ON</strong> → <strong>Save</strong>
        </li>
        <li>
          Add <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env</code>, restart{' '}
          <code>npm run dev</code>
        </li>
      </ol>

      <div className="chat-drive-status">
        <div className="chat-drive-status-row">
          <Database size={18} />
          <span>
            {isSupabaseConfigured
              ? 'Supabase env detected'
              : `Missing: ${missingSupabaseKeys.join(', ')}`}
          </span>
        </div>
        <Button variant="secondary" onClick={handleTest} disabled={testing || !profile}>
          <PlayCircle size={16} />
          {testing ? 'Connecting...' : 'Test chat connection'}
        </Button>
        <Button variant="secondary" onClick={handleTestDelete} disabled={testingDelete || !profile}>
          <PlayCircle size={16} />
          {testingDelete ? 'Checking...' : 'Test chat delete'}
        </Button>
      </div>

      {!profile && (
        <p className="form-error">Sign in to OfficeEx before testing chat connection.</p>
      )}

      {result && <p className="form-success">{result}</p>}
      {error && (
        <p className="form-error">
          {error.includes('not enabled') ? CHAT_DELETE_NOT_SETUP_MESSAGE : error}
        </p>
      )}
    </div>
  );
}
