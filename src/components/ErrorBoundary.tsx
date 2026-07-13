import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OfficeEx render error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="setup-page">
          <div className="setup-card">
            <h1>Something went wrong</h1>
            <p className="setup-lead">
              The app hit an unexpected error while loading.
            </p>
            <pre className="setup-code">{this.state.error.message}</pre>
            <button
              type="button"
              className="btn btn-primary btn-md"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
