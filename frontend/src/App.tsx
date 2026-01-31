import { BrowserRouter, Routes, Route, Link, useLocation, useSearchParams } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Trends from './pages/Trends'
import Layout from './components/common/Layout'
import './App.css'

function Navigation() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const baseQuery = sessionId ? `?session_id=${sessionId}` : ''

  return (
    <nav className="main-nav">
      <Link to={`/${baseQuery}`} className={location.pathname === '/' ? 'active' : ''}>
        📊 סקירה כללית
      </Link>
      <Link to={`/transactions${baseQuery}`} className={location.pathname === '/transactions' ? 'active' : ''}>
        📋 רשימת עסקאות
      </Link>
      <Link to={`/trends${baseQuery}`} className={location.pathname === '/trends' ? 'active' : ''}>
        📈 מגמות
      </Link>
    </nav>
  )
}

function AppContent() {
  return (
    <Layout>
      <Navigation />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/trends" element={<Trends />} />
      </Routes>
    </Layout>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
