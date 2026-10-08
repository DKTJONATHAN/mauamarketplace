import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** When this changes, the boundary clears its error state (e.g. current route path). */
  resetKey?: string;
}

interface State {
  failed: boolean;
  message: string;
}

const CHUNK_RELOAD_KEY = 'maua-chunk-reload-at';
const CHUNK_RELOAD_WINDOW_MS = 30_000;

function isDynamicImportError(message: string): boolean {
  return /failed to fetch dynamically imported module|importing a module script failed|chunkloaderror|loading chunk [\w-]+ failed/i.test(message);
}

function tryRecoverFromChunkError(message: string): boolean {
  if (!isDynamicImportError(message)) return false;
  try {
    const previous = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? '0');
    const now = Date.now();
    if (now - previous < CHUNK_RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { failed: true, message: error?.message ?? 'Unexpected error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
    tryRecoverFromChunkError(error?.message ?? '');
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ failed: false, message: '' });
    }
  }

  private retry = () => {
    this.setState({ failed: false, message: '' });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wrap page">
        <h1>Something went wrong</h1>
        <p>The page hit an unexpected problem. You can try again without leaving the site.</p>
        {this.state.message && <p className="muted" role="status">{this.state.message}</p>}
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={this.retry}>
            Try again
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
