import { AlertTriangle } from 'lucide-react';

interface DataErrorBannerProps {
  message: string;
}

export function DataErrorBanner({ message }: DataErrorBannerProps) {
  return (
    <div className="alert-banner">
      <AlertTriangle size={20} />
      <div>
        <strong>Could not load Firebase data</strong>
        <p>{message}</p>
        <p>
          Check that Realtime Database is enabled, security rules are deployed, and
          your <code>.env</code> file includes a valid{' '}
          <code>VITE_FIREBASE_DATABASE_URL</code>.
        </p>
      </div>
    </div>
  );
}
