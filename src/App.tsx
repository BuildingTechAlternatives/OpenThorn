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
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import CookiesPage from './pages/CookiesPage'
import ImprintPage from './pages/ImprintPage'
import DashboardPage from './pages/DashboardPage'
import ProjectBuilderPage from './pages/ProjectBuilderPage'
import ProvidersPage from './pages/ProvidersPage'
import TemplatesPage from './pages/TemplatesPage'
import CommunityPage from './pages/CommunityPage'
import BlogPage from './pages/BlogPage'
import BlogPostPage from './pages/BlogPostPage'
import FaqPage from './pages/FaqPage'
import ModerationPage from './pages/ModerationPage'
import NotFoundPage from './pages/NotFoundPage'
import AuthModal from './components/AuthModal/AuthModal'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
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
    window.addEventListener('openthorn:require-auth', handleRequireAuth)
    return () => window.removeEventListener('openthorn:require-auth', handleRequireAuth)
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
          <Route path="/privacy" element={<Layout><PrivacyPage /></Layout>} />
          <Route path="/terms" element={<Layout><TermsPage /></Layout>} />
          <Route path="/cookies" element={<Layout><CookiesPage /></Layout>} />
          <Route path="/imprint" element={<Layout><ImprintPage /></Layout>} />
          <Route path="/moderation" element={<Layout><ModerationPage /></Layout>} />
          <Route path="/blog" element={<Layout><BlogPage /></Layout>} />
          <Route path="/blog/:slug" element={<Layout><BlogPostPage /></Layout>} />
          <Route path="/faq" element={<Layout><FaqPage /></Layout>} />
          <Route path="/dashboard" element={<ProtectedRoute pageName="the Dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="/projects/:projectId" element={<ProtectedRoute pageName="your project"><ProjectBuilderPage /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute pageName="Templates"><TemplatesPage /></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute pageName="Community"><CommunityPage /></ProtectedRoute>} />
          <Route path="/providers" element={<ProtectedRoute pageName="Providers"><ProvidersPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </ErrorBoundary>
  )
}
