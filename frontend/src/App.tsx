import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Layout from './components/common/Layout'
import { Loader2 } from 'lucide-react'

// Lazy-loaded pages for code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Trends = lazy(() => import('./pages/Trends'))
const Insights = lazy(() => import('./pages/Insights'))
const Merchants = lazy(() => import('./pages/Merchants'))
const Income = lazy(() => import('./pages/Income'))
const DataManagement = lazy(() => import('./pages/DataManagement'))
const Budget = lazy(() => import('./pages/Budget'))
const SavingsGoals = lazy(() => import('./pages/SavingsGoals'))

// Full-screen loader — used only for auth state and the Login page
function PageLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div className="text-center">
        <Loader2
          className="w-8 h-8 animate-spin mx-auto mb-3"
          style={{ color: 'var(--accent-primary)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          ...טוען
        </p>
      </div>
    </div>
  )
}

// Inline content loader — renders inside the Layout so the header/sidebar stay visible
function ContentLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '280px',
      }}
    >
      <Loader2
        size={28}
        className="animate-spin"
        style={{ color: 'var(--accent-primary)' }}
      />
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <PageLoader />
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginRoute() {
  const { user } = useAuth()
  if (user) return <Navigate to="/" replace />
  return <Login />
}

// Wraps every protected page: auth guard + shared Layout + per-route Suspense
// so the header and sidebar are never unmounted during page transitions.
function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={<ContentLoader />}>
          {children}
        </Suspense>
      </Layout>
    </ProtectedRoute>
  )
}

function AppRoutes() {
  return (
    // Outer Suspense handles the lazy Login page (no Layout needed there)
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
        <Route path="/transactions" element={<ProtectedPage><Transactions /></ProtectedPage>} />
        <Route path="/trends" element={<ProtectedPage><Trends /></ProtectedPage>} />
        <Route path="/insights" element={<ProtectedPage><Insights /></ProtectedPage>} />
        <Route path="/merchants" element={<ProtectedPage><Merchants /></ProtectedPage>} />
        <Route path="/income" element={<ProtectedPage><Income /></ProtectedPage>} />
        <Route path="/budget" element={<ProtectedPage><Budget /></ProtectedPage>} />
        <Route path="/savings" element={<ProtectedPage><SavingsGoals /></ProtectedPage>} />
        <Route path="/data-management" element={<ProtectedPage><DataManagement /></ProtectedPage>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}
