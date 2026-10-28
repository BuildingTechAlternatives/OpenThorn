/**
 * OpenThorn Hash Router — minimal react-router-dom v6 replacement.
 *
 * Uses window.location.hash + hashchange event. Zero dependencies,
 * no URL constructor, no history library. Works everywhere:
 * srcdoc iframes, sandboxed contexts, static deployments, GitHub Pages.
 *
 * Exports the same API as react-router-dom:
 *   HashRouter, Routes, Route, Link, NavLink,
 *   useNavigate, useParams, useLocation, Outlet
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, createElement, Children } from 'react'

// ─── Context ────────────────────────────────────────────────────────────────

const RouterContext = createContext(null)

// ─── Helpers ────────────────────────────────────────────────────────────────

function getHashPath() {
  const hash = window.location.hash || '#/'
  // Remove leading # and optional /
  let path = hash.slice(1) || '/'
  if (!path.startsWith('/')) path = '/' + path
  // Remove trailing slash (except root)
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

function matchRoute(pattern, path) {
  if (pattern === '*' || pattern === '/*') return { matches: true, params: {} }
  if (pattern === path) return { matches: true, params: {} }
  if (pattern === '/' && path === '') return { matches: true, params: {} }

  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = path.split('/').filter(Boolean)

  if (patternParts.length === 0 && pathParts.length === 0) return { matches: true, params: {} }

  // Check if lengths match (unless pattern has splat)
  const hasSplat = patternParts[patternParts.length - 1] === '*'
  if (!hasSplat && patternParts.length !== pathParts.length) return { matches: false, params: {} }

  const params = {}
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]
    const pt = pathParts[i]

    if (pp === '*') return { matches: true, params }

    if (pp.startsWith(':')) {
      params[pp.slice(1)] = pt || ''
      continue
    }

    if (pp !== pt) return { matches: false, params: {} }
  }

  return { matches: true, params }
}

// ─── HashRouter ─────────────────────────────────────────────────────────────

export function HashRouter({ children }) {
  const [path, setPath] = useState(getHashPath)
  const [params, setParams] = useState({})
  const [outletContext, setOutletContext] = useState(null)

  useEffect(() => {
    const handler = () => setPath(getHashPath())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = useCallback((to) => {
    if (typeof to === 'string') {
      window.location.hash = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)
    } else if (typeof to === 'number') {
      window.history.go(to)
    }
  }, [])

  const value = useMemo(() => ({ path, params, setParams, outletContext, setOutletContext, navigate }), [path, params, outletContext, navigate])

  return createElement(RouterContext.Provider, { value }, children)
}

// ─── useRouter ──────────────────────────────────────────────────────────────

function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('Router components must be used inside <HashRouter>')
  return ctx
}

// ─── Routes ─────────────────────────────────────────────────────────────────

export function Routes({ children }) {
  const { path, setParams } = useRouter()
  const childrenArr = Children.toArray(children)

  for (const child of childrenArr) {
    if (!child || !child.props) continue
    const pattern = child.props.path || '/'
    const result = matchRoute(pattern, path)
    if (result.matches) {
      // Clone element with route params
      const element = child.props.element
      return element || child
    }
  }

  return null
}

// ─── Route ──────────────────────────────────────────────────────────────────

export function Route({ path, element }) {
  // Route is only rendered via Routes
  return element || null
}

// ─── Link ───────────────────────────────────────────────────────────────────

export function Link({ to, children, className, style, ...props }) {
  const { navigate } = useRouter()

  const href = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)

  const handleClick = useCallback((e) => {
    e.preventDefault()
    navigate(to)
  }, [to, navigate])

  return createElement('a', { ...props, href, onClick: handleClick, className, style }, children)
}

// ─── NavLink ────────────────────────────────────────────────────────────────

export function NavLink({ to, children, className, style, activeClassName, activeStyle, ...props }) {
  const { path } = useRouter()
  const targetPath = to.startsWith('/') ? to : '/' + to
  const isActive = path === targetPath || (targetPath !== '/' && path.startsWith(targetPath))

  // Support className as function (like react-router-dom v6)
  let resolvedClassName = className
  if (typeof className === 'function') {
    resolvedClassName = className({ isActive })
  } else if (isActive && activeClassName) {
    resolvedClassName = (className || '') + ' ' + activeClassName
  }

  const resolvedStyle = isActive && activeStyle ? { ...style, ...activeStyle } : style

  const { navigate } = useRouter()
  const href = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to)

  const handleClick = useCallback((e) => {
    e.preventDefault()
    navigate(to)
  }, [to, navigate])

  return createElement('a', {
    ...props,
    href,
    onClick: handleClick,
    className: resolvedClassName,
    style: resolvedStyle,
    'aria-current': isActive ? 'page' : undefined,
  }, children)
}

// ─── useNavigate ────────────────────────────────────────────────────────────

export function useNavigate() {
  const { navigate } = useRouter()
  return navigate
}

// ─── useParams ──────────────────────────────────────────────────────────────

export function useParams() {
  const { path, params } = useRouter()
  // Extract params from the current path and the matched route
  // This is a simplified version — actual params come from the Route match
  return params || {}
}

// ─── useLocation ────────────────────────────────────────────────────────────

export function useLocation() {
  const { path } = useRouter()
  return { pathname: path, search: '', hash: window.location.hash, state: null, key: 'default' }
}

// ─── Outlet ─────────────────────────────────────────────────────────────────

export function Outlet() {
  const { outletContext } = useRouter()
  // Outlet is rendered by nested Routes — pass outletContext if set
  return outletContext || null
}

// ─── BrowserRouter (alias for HashRouter) ──────────────────────────────────

// Some projects import BrowserRouter — in srcdoc contexts it behaves
// identically to HashRouter since there's no server to handle paths.
export const BrowserRouter = HashRouter

// ─── Navigate (redirect component) ──────────────────────────────────────────

export function Navigate({ to, replace }) {
  const { navigate, setOutletContext } = useRouter()

  useEffect(() => {
    navigate(to)
    // Also propagate through outlet context for nested navigation
    if (setOutletContext) {
      setOutletContext({ to, replace })
    }
  }, [to, replace, navigate, setOutletContext])

  return null
}
