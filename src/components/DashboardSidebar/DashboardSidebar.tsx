import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../lib/AuthContext'
import styles from './DashboardSidebar.module.css'

interface NavItem {
  label: string
  icon: ReactNode
  active?: boolean
  href?: string
}

export default function DashboardSidebar() {
  const { user, signOut } = useAuth()
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [activeNav, setActiveNav] = useState('Home')

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  const userInitial = firstName.charAt(0).toUpperCase()

  const topNavItems: NavItem[] = [
    {
      label: 'Home',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      ),
    },
    {
      label: 'Templates',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      label: 'Community Apps',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Resources',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      ),
    },
  ]

  // Dummy notifications
  const notifications = [
    { text: 'Welcome to Bloom! Start building your first project.', time: 'Just now' },
    { text: 'New templates are available in the Templates section.', time: '2h ago' },
    { text: 'Community Apps feature coming soon.', time: '1d ago' },
  ]

  return (
    <aside className={styles.sidebar}>
      {/* Top: user area + logo */}
      <div className={styles.topBar}>
        <div className={styles.userArea}>
          <div className={styles.avatar} title={user?.email}>
            {userInitial}
          </div>
          <button
            className={`${styles.bellBtn} ${notificationsOpen ? styles.bellBtnActive : ''}`}
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            aria-label="Notifications"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>
        <a href="/dashboard" className={styles.logo}>
          <img src="/assets/logo.png" alt="Bloom" className={styles.logoImg} />
        </a>
      </div>

      {/* Notifications dropdown */}
      {notificationsOpen && (
        <div className={styles.notifications}>
          <h4 className={styles.notifTitle}>What's new</h4>
          {notifications.map((n, i) => (
            <div key={i} className={styles.notifItem}>
              <p className={styles.notifText}>{n.text}</p>
              <span className={styles.notifTime}>{n.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <nav className={styles.nav}>
        {topNavItems.map((item) => (
          <button
            key={item.label}
            className={`${styles.navItem} ${activeNav === item.label ? styles.navItemActive : ''}`}
            onClick={() => setActiveNav(item.label)}
            type="button"
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom: sign out */}
      <div className={styles.bottom}>
        <button className={styles.signOutBtn} onClick={signOut} type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
