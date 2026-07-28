import { Component } from 'react'

// Without this, an uncaught render error silently kills the whole React
// tree: the last-painted DOM stays on screen but every event handler is
// gone, so every button looks frozen with no visible error (especially in
// a production build, which has no dev error overlay).
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Stoa crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
        <p style={{ color: '#888', fontSize: 14 }}>
          Your data is safe — it's saved as you go. Reload to keep going.
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#c66' }}>
          {String(this.state.error?.stack || this.state.error)}
        </pre>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }
}
