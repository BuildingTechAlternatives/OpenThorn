import { NavLink, Outlet, Link } from 'react-router-dom'
import { usePageTitle } from '../../lib/usePageTitle'
import styles from './AdminLayout.module.css'

const NAV_ITEMS = [
  { to: '/admin', label: 'Moderation', end: true },
  { to: '/admin/users', label: 'Users', end: false },
  { to: '/admin/config', label: 'Config', end: false },
]

export default function AdminLayout() {
  usePageTitle('Admin')

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link to="/dashboard" className={styles.logo}>
          <img src="/assets/logo.png" alt="OpenThorn" className={styles.logoImg} />
          <span className={styles.logoText}>Admin</span>
        </Link>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? `${styles.navItem} ${styles.navItemActive}` : styles.navItem}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/dashboard" className={styles.backLink}>← Back to app</Link>
      </aside>
      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}
