import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Trends from './pages/Trends'
import Layout from './components/common/Layout'
import { Loader2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1120' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#818cf8] mx-auto mb-3" />
          <p className="text-sm text-[#94a3b8]">טוען...</p>
        </div>
      </div>
    )
  }
  
  if (!user) return <Navigate to="/login" />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b1120' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#818cf8]" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
      <Route path="/trends" element={<ProtectedRoute><Layout><Trends /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
