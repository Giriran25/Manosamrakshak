import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/**
 * The prototype must never show a stack trace. Anything that escapes a screen
 * lands here and the person is given a calm way back.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Diagnostics go to the console, never to the screen and never to a log
    // that could carry personal data.
    console.error('[boundary]', error.message, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="eyebrow">Something did not load</p>
        <h1 className="text-display-sm text-ink-900">This screen could not be shown</h1>
        <p className="text-sm leading-relaxed text-ink-500">
          Nothing has been lost. Reloading returns to the last saved state of the prototype.
        </p>
        <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
