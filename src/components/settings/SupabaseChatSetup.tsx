import { useState } from 'react';
import { Database, PlayCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { checkSupabaseConnection } from '../../lib/supabase-auth';
import { isSupabaseConfigured, missingSupabaseKeys, supabaseConfig } from '../../lib/supabase';
import { Button } from '../ui/Button';

export function SupabaseChatSetup() {
  const { isAdmin } = useAuth();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  if (!isAdmin) {
    return null;
  }

  const handleTest = async () => {
    setTesting(true);
    setResult('');
    setError('');
    try {
      const status = await checkSupabaseConnection();
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
        Supabase project: <code>{supabaseConfig.url || 'not set'}</code>
      </p>

      <ol className="chat-drive-checklist-list">
        <li>
          Add to <code>.env</code>: <code>VITE_SUPABASE_URL</code>,{' '}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>
        </li>
        <li>
          Run <code>supabase/migrations/001_chat.sql</code> in Supabase SQL Editor
        </li>
        <li>
          Supabase → Authentication → Email → disable <strong>Confirm email</strong>
        </li>
        <li>Restart <code>npm run dev</code></li>
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
        <Button variant="secondary" onClick={handleTest} disabled={testing}>
          <PlayCircle size={16} />
          {testing ? 'Testing...' : 'Test chat connection'}
        </Button>
      </div>

      {result && <p className="form-success">{result}</p>}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
