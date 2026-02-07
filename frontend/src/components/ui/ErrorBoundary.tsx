import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React Error Boundary that catches runtime errors in its child tree
 * and displays a styled Hebrew fallback UI.
 */
export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconWrapper}>
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent-danger, #ef4444)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2 style={styles.title}>
              {'\u05E0\u05EA\u05E7\u05DC\u05E0\u05D5 \u05D1\u05E9\u05D2\u05D9\u05D0\u05D4'}
            </h2>

            <p style={styles.message}>
              {this.state.error?.message || '\u05D0\u05D9\u05E8\u05E2\u05D4 \u05E9\u05D2\u05D9\u05D0\u05D4 \u05DC\u05D0 \u05E6\u05E4\u05D5\u05D9\u05D4'}
            </p>

            <button
              type="button"
              onClick={this.handleRetry}
              style={styles.button}
              onMouseEnter={(e) => {
                const target = e.currentTarget
                target.style.transform = 'translateY(-2px)'
                target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)'
              }}
              onMouseLeave={(e) => {
                const target = e.currentTarget
                target.style.transform = 'translateY(0)'
                target.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)'
              }}
            >
              {'\u05E0\u05E1\u05D4 \u05E9\u05D5\u05D1'}
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '300px',
    padding: '2rem',
    direction: 'rtl',
  },
  card: {
    background: 'var(--bg-card, #1e293b)',
    border: '1px solid var(--border-color, #334155)',
    borderRadius: 'var(--radius-lg, 16px)',
    padding: '2.5rem',
    textAlign: 'center' as const,
    maxWidth: '420px',
    width: '100%',
    boxShadow: 'var(--shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1))',
  },
  iconWrapper: {
    marginBottom: '1.25rem',
  },
  title: {
    color: 'var(--text-primary, #f8fafc)',
    fontSize: '1.5rem',
    fontWeight: 700,
    margin: '0 0 0.75rem 0',
    fontFamily: "'Heebo', sans-serif",
  },
  message: {
    color: 'var(--text-secondary, #cbd5e1)',
    fontSize: '0.95rem',
    margin: '0 0 1.5rem 0',
    lineHeight: 1.6,
    fontFamily: "'Heebo', sans-serif",
  },
  button: {
    background: 'var(--gradient-primary, linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%))',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    padding: '0.625rem 2rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Heebo', sans-serif",
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },
}
