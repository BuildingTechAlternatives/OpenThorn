import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetOpenThornSection from './components/MeetOpenThornSection/MeetOpenThornSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import PricingPage from './pages/PricingPage'
import DashboardPage from './pages/DashboardPage'
import ProjectBuilderPage from './pages/ProjectBuilderPage'
import ProvidersPage from './pages/ProvidersPage'
import TemplatesPage from './pages/TemplatesPage'
import CommunityPage from './pages/CommunityPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthModal from './components/AuthModal/AuthModal'
import styles from './App.module.css'

function HomePage() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <>
      <HeroSection />
      <MeetOpenThornSection />
      <BYOKSection />
      <BottomCTA />
    </>
  )
}

function Layout({ children }: { children: React.ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin')

  const openSignIn = () => { setAuthModalMode('signin'); setAuthModalOpen(true) }
  const openSignUp = () => { setAuthModalMode('signup'); setAuthModalOpen(true) }

  useEffect(() => {
    const handleRequireAuth = () => openSignIn()
    window.addEventListener('florvia:require-auth', handleRequireAuth)
    return () => window.removeEventListener('florvia:require-auth', handleRequireAuth)
  }, [])

  return (
    <>
      <Header onSignIn={openSignIn} onSignUp={openSignUp} />
      <main>{children}</main>
      <Footer />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <div className={styles.app}>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/pricing" element={<Layout><PricingPage /></Layout>} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/:projectId" element={<ProjectBuilderPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/providers" element={<ProvidersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}
