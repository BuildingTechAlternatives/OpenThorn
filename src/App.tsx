import Header from './components/Header/Header'
import HeroSection from './components/HeroSection/HeroSection'
import MeetBloomSection from './components/MeetBloomSection/MeetBloomSection'
import BYOKSection from './components/BYOKSection/BYOKSection'
import BottomCTA from './components/BottomCTA/BottomCTA'
import Footer from './components/Footer/Footer'
import InteractiveGradient from './components/InteractiveGradient/InteractiveGradient'
import styles from './App.module.css'

export default function App() {
  return (
    <div className={styles.app}>
      {/* Subtle page-wide ambient gradient */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.5 }}>
        <InteractiveGradient
          color1="#A78BFA"
          color2="#7B61FF"
          color3="#6366F1"
          blur={120}
          brightness={0.4}
          orbitRadius={20}
          followStrength={0.1}
          loopDuration={30}
          isStatic={false}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <Header />
        <main>
          <HeroSection />
          <MeetBloomSection />
          <BYOKSection />
          <BottomCTA />
        </main>
        <Footer />
      </div>
    </div>
  )
}
