import { AlertTriangle, Copy, ExternalLink } from 'lucide-react';
import { missingFirebaseKeys } from '../lib/firebase';

export function SetupRequired() {
  const copyExample = async () => {
    await navigator.clipboard.writeText('cp .env.example .env');
  };

  return (
    <div className="setup-page">
      <div className="setup-card">
        <div className="setup-icon">
          <AlertTriangle size={28} />
        </div>
        <h1>Firebase setup required</h1>
        <p className="setup-lead">
          The app loaded, but Firebase is not configured yet. Add your Firebase
          web app credentials to a <code>.env</code> file, then restart the dev
          server.
        </p>

        <div className="setup-steps">
          <h2>Quick setup</h2>
          <ol>
            <li>
              Create or open a Firebase project and enable{' '}
              <strong>Authentication → Email/Password</strong> and{' '}
              <strong>Realtime Database</strong>.
            </li>
            <li>
              Register a web app in Firebase and copy its config values.
            </li>
            <li>
              Run <code>cp .env.example .env</code> and paste your values.
            </li>
            <li>
              Restart with <code>npm run dev</code>.
            </li>
          </ol>
        </div>

        {missingFirebaseKeys.length > 0 && (
          <div className="setup-missing">
            <p>Missing environment variables:</p>
            <ul>
              {missingFirebaseKeys.map((key) => (
                <li key={key}>
                  <code>{key}</code>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="setup-actions">
          <button type="button" className="btn btn-secondary btn-md" onClick={copyExample}>
            <Copy size={16} />
            Copy setup command
          </button>
          <a
            className="btn btn-primary btn-md"
            href="https://console.firebase.google.com/"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={16} />
            Open Firebase Console
          </a>
        </div>
      </div>
    </div>
  );
}
