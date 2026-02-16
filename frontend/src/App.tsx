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

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Layout>
                <Transactions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/trends"
          element={
            <ProtectedRoute>
              <Layout>
                <Trends />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <Layout>
                <Insights />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/merchants"
          element={
            <ProtectedRoute>
              <Layout>
                <Merchants />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/income"
          element={
            <ProtectedRoute>
              <Layout>
                <Income />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/budget"
          element={
            <ProtectedRoute>
              <Layout>
                <Budget />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/savings"
          element={
            <ProtectedRoute>
              <Layout>
                <SavingsGoals />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/data-management"
          element={
            <ProtectedRoute>
              <Layout>
                <DataManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
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
