import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../lib/AuthContext'
import styles from './DashboardSidebar.module.css'

interface Project {
  id: string
  title: string
}

interface DashboardSidebarProps {
  projects?: Project[]
}

interface NavItem {
  label: string
  icon: ReactNode
}

const iconSize = 20

const mainNavItems: NavItem[] = [
  {
    label: 'Home',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: 'Templates',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: 'Community',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
  {
    label: 'Providers',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
      </svg>
    ),
  },
]

const projectNavItems: NavItem[] = [
  {
    label: 'All projects',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    label: 'Starred',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    label: 'Created by me',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="8.5" cy="7" r="4"/>
        <line x1="20" y1="8" x2="20" y2="14"/>
        <line x1="23" y1="11" x2="17" y2="11"/>
      </svg>
    ),
  },
]

export default function DashboardSidebar({ projects = [] }: DashboardSidebarProps) {
  const { user, signOut } = useAuth()
  const [activeNav, setActiveNav] = useState('Home')
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const userInitial = firstName.charAt(0).toUpperCase()

  const notifications = [
    { text: 'Welcome to Bloom! Start building your first project.', time: 'Just now' },
    { text: 'New templates are available in the Templates section.', time: '2h ago' },
    { text: 'Community Apps feature coming soon.', time: '1d ago' },
  ]

  const renderNavItem = (item: NavItem, isActive: boolean, isSub = false) => (
    <button
      key={item.label}
      className={`${styles.navItem} ${isSub ? styles.navItemSub : ''} ${isActive ? styles.navItemActive : ''}`}
      onClick={() => setActiveNav(item.label)}
      type="button"
    >
      <span className={styles.navIcon}>{item.icon}</span>
      <span className={styles.navLabel}>{item.label}</span>
    </button>
  )

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoRow}>
        <a href="/dashboard" className={styles.logo}>
          <img src="/assets/logo.png" alt="Bloom" className={styles.logoImg} />
        </a>
        <button
          className={`${styles.bellBtn} ${notificationsOpen ? styles.bellBtnActive : ''}`}
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          aria-label="Notifications"
          type="button"
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </div>

      {/* Notification popover */}
      {notificationsOpen && (
        <>
          <div className={styles.notifBackdrop} onClick={() => setNotificationsOpen(false)} />
          <div className={styles.notifPopover}>
            <div className={styles.notifHeader}>
              <h4 className={styles.notifTitle}>What's new</h4>
            </div>
            {notifications.map((n, i) => (
              <div key={i} className={styles.notifItem}>
                <p className={styles.notifText}>{n.text}</p>
                <span className={styles.notifTime}>{n.time}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Scrollable nav area */}
      <nav className={styles.nav}>
        {/* Main navigation */}
        <div className={styles.navGroup}>
          {mainNavItems.map((item) => renderNavItem(item, activeNav === item.label))}
        </div>

        {/* Projects section */}
        <div className={styles.navGroup}>
          <div className={styles.sectionLabel}>Projects</div>
          {projectNavItems.map((item) => renderNavItem(item, activeNav === item.label, true))}
        </div>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div className={styles.navGroup}>
            <div className={styles.sectionLabel}>Recent</div>
            {projects.slice(0, 8).map((project) => (
              <button
                key={project.id}
                className={`${styles.navItem} ${styles.recentItem} ${activeNav === project.id ? styles.navItemActive : ''}`}
                onClick={() => setActiveNav(project.id)}
                type="button"
              >
                <span className={styles.recentDot} />
                <span className={styles.navLabel}>{project.title}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* User area at bottom */}
      <div className={styles.userFooter}>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{userInitial}</div>
          <div className={styles.userMeta}>
            <span className={styles.userName}>{firstName}</span>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
        </div>
        <button className={styles.signOutBtn} onClick={signOut} type="button" title="Sign out">
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}
