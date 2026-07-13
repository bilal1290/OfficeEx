import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    await StatusBar.setStyle({ style: Style.Default });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
