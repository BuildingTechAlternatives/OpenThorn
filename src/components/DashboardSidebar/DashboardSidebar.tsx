import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../lib/AuthContext'
import styles from './DashboardSidebar.module.css'

interface Project {
  id: string
  title: string
}

export type ProjectFilter = 'all' | 'starred' | 'mine' | 'shared'

export interface SidebarNotification {
  id: string
  text: string
  time: string
  unread?: boolean
}

interface DashboardSidebarProps {
  projects?: Project[]
  activeFilter?: ProjectFilter
  onProjectFilterChange?: (filter: ProjectFilter) => void
  notifications?: SidebarNotification[]
  onNotificationsRead?: () => void
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
    label: 'Providers',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
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
  {
    label: 'Shared with me',
    icon: (
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/>
        <circle cx="6" cy="12" r="3"/>
        <circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
    ),
  },
]

const filterMap: Record<string, ProjectFilter> = {
  'All projects': 'all',
  'Starred': 'starred',
  'Created by me': 'mine',
  'Shared with me': 'shared',
}

export default function DashboardSidebar({ projects = [], activeFilter = 'all', onProjectFilterChange, notifications: externalNotifications, onNotificationsRead }: DashboardSidebarProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeNav, setActiveNav] = useState(() => {
    if (location.pathname === '/providers') return 'Providers'
    if (location.pathname === '/templates') return 'Templates'
    if (location.pathname === '/community') return 'Community'
    return 'Home'
  })
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  // Sync activeNav when the route changes (browser back/forward, etc.)
  useEffect(() => {
    if (location.pathname === '/providers') setActiveNav('Providers')
    else if (location.pathname === '/dashboard') setActiveNav('Home')
    else if (location.pathname === '/templates') setActiveNav('Templates')
    else if (location.pathname === '/community') setActiveNav('Community')
  }, [location.pathname])

  const handleNavClick = (label: string) => {
    setActiveNav(label)
    if (label === 'Providers') navigate('/providers')
    if (label === 'Home') navigate('/dashboard')
    if (label === 'Templates') navigate('/templates')
    if (label === 'Community') navigate('/community')
  }

  const handleProjectFilterClick = (label: string) => {
    const filter = filterMap[label]
    if (!filter) return
    if (onProjectFilterChange) onProjectFilterChange(filter)
    setActiveNav(label)
    navigate('/dashboard', { state: { activeFilter: filter, scrollToProjects: true } })
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const userInitial = firstName.charAt(0).toUpperCase()

  const staticNotifications = [
    { id: 'welcome', text: 'Welcome to OpenThorn! Start building your first project.', time: 'Just now' },
    { id: 'templates', text: 'New templates are available in the Templates section.', time: '2h ago' },
    { id: 'community', text: 'Community Apps feature coming soon.', time: '1d ago' },
  ]
  const notifications = externalNotifications && externalNotifications.length > 0
    ? [...externalNotifications, ...staticNotifications]
    : staticNotifications
  const unreadCount = (externalNotifications ?? []).filter((n) => n.unread).length

  const renderNavItem = (item: NavItem, isActive: boolean, isSub = false) => (
    <button
      key={item.label}
      className={`${styles.navItem} ${isSub ? styles.navItemSub : ''} ${isActive ? styles.navItemActive : ''}`}
      onClick={() => handleNavClick(item.label)}
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
          <img src="/assets/logo.png" alt="OpenThorn" className={styles.logoImg} />
        </a>
        <button
          className={`${styles.bellBtn} ${notificationsOpen ? styles.bellBtnActive : ''}`}
          onClick={() => {
            const opening = !notificationsOpen
            setNotificationsOpen(opening)
            if (opening && unreadCount > 0) onNotificationsRead?.()
          }}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          type="button"
        >
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount}</span>}
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
            {notifications.map((n) => (
              <div key={n.id} className={`${styles.notifItem} ${'unread' in n && n.unread ? styles.notifItemUnread : ''}`}>
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
          {projectNavItems.map((item) => (
            <button
              key={item.label}
              className={`${styles.navItem} ${styles.navItemSub} ${filterMap[item.label] === activeFilter ? styles.navItemActive : ''}`}
              onClick={() => handleProjectFilterClick(item.label)}
              type="button"
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Recent projects */}
        {projects.length > 0 && (
          <div className={styles.navGroup}>
            <div className={styles.sectionLabel}>Recent</div>
            {projects.slice(0, 8).map((project) => (
              <button
                key={project.id}
                className={`${styles.navItem} ${styles.recentItem} ${activeNav === project.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavClick(project.id)}
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
