import { Component } from 'react';

/**
 * Stops a render-time crash in any page from blanking the whole app, which is
 * what used to happen when a malformed AI response reached the dashboard.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="band mx-auto max-w-[44ch]">
        <p className="eyebrow">Error</p>
        <h1 className="t-lg mt-4">This page stopped.</h1>
        <p className="t-body mt-5 text-ink-soft">
          {this.state.error?.message || 'Something unexpected happened.'}
        </p>
        <button onClick={() => window.location.assign('/')} className="btn btn-fill mt-8">
          Back to start
        </button>
      </div>
    );
  }
}
