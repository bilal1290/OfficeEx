import { useState } from 'react';
import { Database, PlayCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { checkSupabaseConnection } from '../../lib/supabase-auth';
import { isSupabaseConfigured, missingSupabaseKeys, supabaseConfig } from '../../lib/supabase';
import { Button } from '../ui/Button';

export function SupabaseChatSetup() {
  const { isAdmin, profile } = useAuth();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin) {
    return null;
  }

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

  return (
    <div className="chat-drive-setup">
      <p className="chat-drive-project-url">
        Supabase project:{' '}
        <a
          href="https://supabase.com/dashboard/project/mrspndxusvczftygqjez/sql/new"
          target="_blank"
          rel="noreferrer"
        >
          <code>{supabaseConfig.url || 'not set'}</code>
        </a>
      </p>

      <ol className="chat-drive-checklist-list">
        <li>Run SQL migrations through <code>007_chat_notifications.sql</code></li>
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
          Delete old <code>@users.officeex.app</code> users (they caused email bounces)
        </li>
        <li>
          Add <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code>, restart{' '}
          <code>npm run dev</code>
        </li>
        <li>Sign out/in once, then click Test below (once)</li>
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
      </div>

      {!profile && (
        <p className="form-error">Sign in to OfficeEx before testing chat connection.</p>
      )}

      {result && <p className="form-success">{result}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
