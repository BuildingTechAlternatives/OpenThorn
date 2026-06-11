import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { usePageTitle } from './lib/usePageTitle'
import { useJsonLd } from './lib/useJsonLd'
import { getErrorMessage, logError } from './lib/errors'
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary'
import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetOpenThornSection from './components/MeetOpenThornSection/MeetOpenThornSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import AuthModal from './components/AuthModal/AuthModal'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import styles from './App.module.css'

// Route pages are code-split so the heavy builder/preview stack (esbuild-wasm,
// jszip, html2canvas, the agent) isn't pulled into the initial landing bundle.
const PricingPage = lazy(() => import('./pages/PricingPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))
const CookiesPage = lazy(() => import('./pages/CookiesPage'))
const ImprintPage = lazy(() => import('./pages/ImprintPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProjectBuilderPage = lazy(() => import('./pages/ProjectBuilderPage'))
const ProvidersPage = lazy(() => import('./pages/ProvidersPage'))
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ChangelogPage = lazy(() => import('./pages/ChangelogPage'))
const ModerationPage = lazy(() => import('./pages/ModerationPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function HomePage() {
  usePageTitle()
  useJsonLd({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'OpenThorn',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    description:
      'OpenThorn is the BYOK AI website builder — describe what you want, get a complete, deployable website. No subscription, no lock-in.',
    url: 'https://www.openthorn.app',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free to use — bring your own API keys',
    },
  })

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
  const [globalError, setGlobalError] = useState<string | null>(null)

  useEffect(() => {
    const handleUnhandledError = (event: ErrorEvent) => {
      logError('UnhandledError', event.error ?? event.message)
      setGlobalError(getErrorMessage(event.error ?? event.message, 'The app hit an unexpected error.'))
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError('UnhandledRejection', event.reason)
      setGlobalError(getErrorMessage(event.reason, 'A background action failed. Please try again.'))
    }

    window.addEventListener('error', handleUnhandledError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleUnhandledError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return (
    <ErrorBoundary>
      <div className={styles.app}>
        <Suspense fallback={<div className={styles.routeLoading}>Loading...</div>}>
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
            <Route path="/changelog" element={<Layout><ChangelogPage /></Layout>} />
            <Route path="/dashboard" element={<ProtectedRoute pageName="the Dashboard"><DashboardPage /></ProtectedRoute>} />
            <Route path="/projects/:projectId" element={<ProtectedRoute pageName="your project"><ProjectBuilderPage /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute pageName="Templates"><TemplatesPage /></ProtectedRoute>} />
            <Route path="/community" element={<ProtectedRoute pageName="Community"><CommunityPage /></ProtectedRoute>} />
            <Route path="/providers" element={<ProtectedRoute pageName="Providers"><ProvidersPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute pageName="Profile"><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute pageName="Settings"><SettingsPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        {globalError && (
          <div className={styles.globalError} role="alert">
            <span>{globalError}</span>
            <button type="button" onClick={() => setGlobalError(null)} aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        )}
      </div>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  )
}
