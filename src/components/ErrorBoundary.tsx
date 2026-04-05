import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

interface Props {
  children?: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#fff',
          padding: 16,
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, marginBottom: 8 }}>Etwas ist schiefgelaufen</p>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '6px 12px',
              background: '#444',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 12,
            }}
          >
            Erneut versuchen
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
