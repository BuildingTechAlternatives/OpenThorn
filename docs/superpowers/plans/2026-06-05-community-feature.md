# Community Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Community tab where users can publish their projects for others to discover, like, and fork; and remove the Resources sidebar tab.

**Architecture:** Two new Supabase tables (`community_posts`, `community_likes`) store published projects and likes. A new `CommunityPage` mirrors DashboardPage's grid/list/search/sort UI with an overlay detail view matching TemplatesPage. Publishing is triggered from DashboardPage's project context menu. Files are snapshotted at publish time from `projects.files`.

**Tech Stack:** React + TypeScript, Supabase (PostgreSQL + RLS + trigger), React Router, CSS Modules (matching existing dashboard patterns)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/pages/CommunityPage.tsx` | Browse, search, sort, like, overlay, fork |
| Create | `src/pages/CommunityPage.module.css` | Community page styles |
| Modify | `src/components/DashboardSidebar/DashboardSidebar.tsx` | Remove Resources nav item; add Community routing |
| Modify | `src/pages/DashboardPage.tsx` | Add "Publish to Community" context menu item + publish modal |
| Modify | `src/App.tsx` | Register `/community` route |

---

## Task 1: Supabase — Create community_posts and community_likes tables

**Files:** Supabase schema only (no local files changed)

- [ ] **Step 1: Run migration via Supabase MCP — create tables, RLS, and trigger**

Use `mcp__plugin_supabase_supabase__execute_sql` with this SQL:

```sql
-- community_posts: one row per published project
create table if not exists community_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  preview_url text,
  author_name text not null,
  files_snapshot jsonb not null default '[]'::jsonb,
  likes_count int not null default 0,
  published_at timestamptz not null default now()
);

alter table community_posts enable row level security;

create policy "community_posts_select" on community_posts
  for select using (true);

create policy "community_posts_insert" on community_posts
  for insert with check (auth.uid() = user_id);

create policy "community_posts_update" on community_posts
  for update using (auth.uid() = user_id);

create policy "community_posts_delete" on community_posts
  for delete using (auth.uid() = user_id);

-- community_likes: one row per (user, post) pair
create table if not exists community_likes (
  user_id uuid references auth.users(id) on delete cascade not null,
  post_id uuid references community_posts(id) on delete cascade not null,
  primary key (user_id, post_id)
);

alter table community_likes enable row level security;

create policy "community_likes_select" on community_likes
  for select using (true);

create policy "community_likes_insert" on community_likes
  for insert with check (auth.uid() = user_id);

create policy "community_likes_delete" on community_likes
  for delete using (auth.uid() = user_id);

-- trigger: keep likes_count in sync automatically
create or replace function update_community_likes_count()
returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update community_posts set likes_count = likes_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update community_posts set likes_count = greatest(likes_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists community_likes_count_trigger on community_likes;
create trigger community_likes_count_trigger
  after insert or delete on community_likes
  for each row execute function update_community_likes_count();
```

- [ ] **Step 2: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` and confirm `community_posts` and `community_likes` appear.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: add community_posts and community_likes tables with RLS and likes trigger"
```

---

## Task 2: Remove Resources tab and wire Community routing in DashboardSidebar

**Files:**
- Modify: `src/components/DashboardSidebar/DashboardSidebar.tsx`

- [ ] **Step 1: Remove the Resources entry from `mainNavItems`**

In `DashboardSidebar.tsx`, find the `mainNavItems` array (starts around line 36). Delete the entire object for `'Resources'`:

```typescript
// DELETE this entire object from mainNavItems:
{
  label: 'Resources',
  icon: (
    <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
},
```

- [ ] **Step 2: Add Community to the `useEffect` and `handleNavClick` for routing**

Find the `useEffect` that syncs `activeNav` from the route (around line 151). Add a line for `/community`:

```typescript
useEffect(() => {
  if (location.pathname === '/providers') setActiveNav('Providers')
  else if (location.pathname === '/dashboard') setActiveNav('Home')
  else if (location.pathname === '/templates') setActiveNav('Templates')
  else if (location.pathname === '/community') setActiveNav('Community')
}, [location.pathname])
```

Find `handleNavClick` (around line 157). Add a Community case:

```typescript
const handleNavClick = (label: string) => {
  setActiveNav(label)
  if (label === 'Providers') navigate('/providers')
  if (label === 'Home') navigate('/dashboard')
  if (label === 'Templates') navigate('/templates')
  if (label === 'Community') navigate('/community')
}
```

Also update the initial state derivation (around line 143) to include `/community`:

```typescript
const [activeNav, setActiveNav] = useState(() => {
  if (location.pathname === '/providers') return 'Providers'
  if (location.pathname === '/templates') return 'Templates'
  if (location.pathname === '/community') return 'Community'
  return 'Home'
})
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardSidebar/DashboardSidebar.tsx
git commit -m "feat: remove Resources tab and wire Community navigation in sidebar"
```

---

## Task 3: Add "Publish to Community" to DashboardPage

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

This task adds a publish modal and a "Publish to Community" item in the project context menu.

- [ ] **Step 1: Add `publishingProject` state**

Near the other state declarations (around line 81, next to `renamingProject`), add:

```typescript
const [publishingProject, setPublishingProject] = useState<{ id: string; title: string; previewUrl: string | null } | null>(null)
const [publishDescription, setPublishDescription] = useState('')
const [publishing, setPublishing] = useState(false)
const [publishSuccess, setPublishSuccess] = useState<string | null>(null)
```

- [ ] **Step 2: Add `handlePublishStart` handler**

After `handleOpenInNewTab` (around line 299), add:

```typescript
const handlePublishStart = useCallback((project: Project, e: React.MouseEvent) => {
  e.stopPropagation()
  setContextMenu(null)
  setPublishDescription('')
  setPublishingProject({ id: project.id, title: project.title, previewUrl: project.preview_url })
}, [])
```

- [ ] **Step 3: Add `handlePublishSubmit` handler**

After `handlePublishStart`, add:

```typescript
const handlePublishSubmit = useCallback(async () => {
  if (!publishingProject || !user || publishing) return
  setPublishing(true)

  // Fetch project files from Supabase
  const { data: projectData, error: fetchError } = await supabase
    .from('projects')
    .select('files')
    .eq('id', publishingProject.id)
    .single()

  if (fetchError) {
    console.error('Failed to fetch project files:', fetchError.message)
    setPublishing(false)
    return
  }

  const authorName =
    user.user_metadata?.full_name ??
    user.email?.split('@')[0] ??
    'Anonymous'

  const { error } = await supabase.from('community_posts').insert({
    project_id: publishingProject.id,
    user_id: user.id,
    title: publishingProject.title,
    description: publishDescription.trim() || null,
    preview_url: publishingProject.previewUrl,
    author_name: authorName,
    files_snapshot: (projectData?.files ?? []) as unknown as Record<string, unknown>[],
  })

  setPublishing(false)
  if (error) {
    console.error('Failed to publish:', error.message)
    return
  }
  setPublishingProject(null)
  setPublishSuccess(publishingProject.title)
  setTimeout(() => setPublishSuccess(null), 3000)
}, [publishingProject, publishDescription, user, publishing])
```

- [ ] **Step 4: Add "Publish to Community" button to the context menu JSX**

In the context menu JSX (around line 672), add a new button after "Open in new tab" and before the `<hr>` divider:

```tsx
<button
  type="button"
  onClick={(e) => {
    const project = projects.find((p) => p.id === contextMenu.projectId)
    if (project) handlePublishStart(project, e)
  }}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
  Publish to Community
</button>
```

- [ ] **Step 5: Add the publish modal JSX**

At the very end of the returned JSX, before the closing `</div>` of the root, add:

```tsx
{/* Publish to Community modal */}
{publishingProject && (
  <div className={styles.publishBackdrop} onClick={(e) => { if (e.target === e.currentTarget) setPublishingProject(null) }}>
    <div className={styles.publishModal}>
      <button className={styles.publishClose} type="button" onClick={() => setPublishingProject(null)} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <h2 className={styles.publishTitle}>Publish to Community</h2>
      <p className={styles.publishSubtitle}>
        Share <strong>{publishingProject.title}</strong> with the OpenThorn community.
      </p>
      <label className={styles.publishLabel}>
        Description <span className={styles.publishOptional}>(optional)</span>
      </label>
      <textarea
        className={styles.publishTextarea}
        placeholder="What did you build? Add a short description…"
        value={publishDescription}
        onChange={(e) => setPublishDescription(e.target.value)}
        rows={3}
        maxLength={280}
      />
      <button
        className={styles.publishBtn}
        type="button"
        onClick={handlePublishSubmit}
        disabled={publishing}
      >
        {publishing ? 'Publishing…' : 'Publish →'}
      </button>
    </div>
  </div>
)}

{/* Success toast */}
{publishSuccess && (
  <div className={styles.publishToast}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    "{publishSuccess}" published to Community
  </div>
)}
```

- [ ] **Step 6: Add publish modal + toast CSS to `DashboardPage.module.css`**

Open `src/pages/DashboardPage.module.css` and append at the end:

```css
/* Publish modal */
.publishBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.publishModal {
  background: #1a1a2e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 28px 32px;
  width: 420px;
  max-width: calc(100vw - 32px);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.publishClose {
  position: absolute;
  top: 16px;
  right: 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}
.publishClose:hover { color: rgba(255, 255, 255, 0.8); }

.publishTitle {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  margin: 0;
}

.publishSubtitle {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
}
.publishSubtitle strong { color: rgba(255, 255, 255, 0.85); font-weight: 600; }

.publishLabel {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.publishOptional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.7;
}

.publishTextarea {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 12px 14px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.15s;
  line-height: 1.5;
}
.publishTextarea:focus {
  outline: none;
  border-color: rgba(167, 139, 250, 0.5);
}
.publishTextarea::placeholder { color: rgba(255, 255, 255, 0.3); }

.publishBtn {
  background: #7c6af7;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  align-self: flex-end;
}
.publishBtn:hover:not(:disabled) { background: #6a5ae0; }
.publishBtn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Success toast */
.publishToast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #1a2e1a;
  border: 1px solid rgba(52, 201, 138, 0.3);
  color: #34c98a;
  border-radius: 10px;
  padding: 10px 18px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 300;
  white-space: nowrap;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.module.css
git commit -m "feat: add Publish to Community action in project context menu with modal"
```

---

## Task 4: Register /community route in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the import and route**

In `src/App.tsx`, add the import after the TemplatesPage import:

```typescript
import CommunityPage from './pages/CommunityPage'
```

Add the route inside `<Routes>` after the `/templates` route:

```tsx
<Route path="/community" element={<CommunityPage />} />
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat: register /community route"
```

---

## Task 5: Create CommunityPage

**Files:**
- Create: `src/pages/CommunityPage.tsx`
- Create: `src/pages/CommunityPage.module.css`

This page is the main Community browse experience. It uses the same grid/list + search/sort controls as DashboardPage's projects section. Clicking a card opens a full-screen overlay (same pattern as TemplatesPage) with a preview screenshot on the left and project info + like button + "Use this project" button on the right.

### CommunityPage.tsx

- [ ] **Step 1: Create `src/pages/CommunityPage.tsx`**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import type { AgentCodeFile } from '../lib/agent'
import DashboardSidebar from '../components/DashboardSidebar/DashboardSidebar'
import ModelSelector, { type SelectedModel } from '../components/ModelSelector/ModelSelector'
import styles from './CommunityPage.module.css'

interface CommunityPost {
  id: string
  project_id: string
  user_id: string
  title: string
  description: string | null
  preview_url: string | null
  author_name: string
  files_snapshot: AgentCodeFile[]
  likes_count: number
  published_at: string
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const ACCENT_COLORS = [
  '#7c6af7', '#4f9cf9', '#34c98a', '#f97b4f',
  '#e05ae0', '#f7c048', '#5ec7f7', '#a78bfa',
]

function postAccentColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0
  }
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}

export default function CommunityPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [postsLoading, setPostsLoading] = useState(true)
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'likes'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selected, setSelected] = useState<CommunityPost | null>(null)
  const [selectedModel, setSelectedModel] = useState<SelectedModel | null>(null)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    if (!loading && !user) navigate('/', { replace: true })
  }, [loading, user, navigate])

  // Load posts
  useEffect(() => {
    if (!user) return
    const fetchPosts = async () => {
      const { data } = await supabase
        .from('community_posts')
        .select('*')
        .order('published_at', { ascending: false })
      setPosts((data ?? []) as CommunityPost[])
      setPostsLoading(false)
    }
    fetchPosts()
  }, [user])

  // Load current user's likes
  useEffect(() => {
    if (!user) return
    supabase
      .from('community_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setLikedSet(new Set(data.map((r) => r.post_id as string)))
      })
  }, [user])

  // Escape closes overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleLikeToggle = useCallback(async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) return
    const isLiked = likedSet.has(postId)

    // Optimistic update
    setLikedSet((prev) => {
      const next = new Set(prev)
      isLiked ? next.delete(postId) : next.add(postId)
      return next
    })
    setPosts((prev) => prev.map((p) => p.id === postId
      ? { ...p, likes_count: Math.max(0, p.likes_count + (isLiked ? -1 : 1)) }
      : p
    ))

    if (isLiked) {
      await supabase.from('community_likes').delete()
        .eq('user_id', user.id).eq('post_id', postId)
    } else {
      await supabase.from('community_likes').insert({ user_id: user.id, post_id: postId })
    }
  }, [user, likedSet])

  const handleUseProject = useCallback(async () => {
    if (!user || !selected || !selectedModel) return
    setLaunching(true)
    const projectId = crypto.randomUUID()

    const { error } = await supabase.from('projects').upsert({
      id: projectId,
      user_id: user.id,
      title: selected.title,
      preview_url: selected.preview_url,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (error) {
      console.error('Failed to fork project:', error.message)
      setLaunching(false)
      return
    }

    navigate(`/projects/${projectId}`, {
      state: {
        title: selected.title,
        templateFiles: selected.files_snapshot,
        isTemplate: true,
        templateName: selected.title,
        selectedModel,
        thinkingLevel: 'medium',
      },
    })
  }, [user, selected, selectedModel, navigate])

  const filteredPosts = posts
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || (p.author_name ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'likes') return b.likes_count - a.likes_count
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    })

  if (loading) return null

  return (
    <div className={styles.root}>
      <DashboardSidebar />

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Community</h1>
          <p className={styles.subheading}>Projects built by the OpenThorn community.</p>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search projects or authors…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className={styles.searchClear} type="button" onClick={() => setSearchQuery('')} aria-label="Clear search">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select
            className={styles.sortSelect}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'likes')}
            aria-label="Sort posts"
          >
            <option value="recent">Recent</option>
            <option value="likes">Most Liked</option>
          </select>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
              type="button"
              aria-label="Grid view"
              onClick={() => setViewMode('grid')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              type="button"
              aria-label="List view"
              onClick={() => setViewMode('list')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {postsLoading ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Loading community projects…</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3 className={styles.emptyTitle}>
              {searchQuery ? 'No projects match' : 'No community projects yet'}
            </h3>
            <p className={styles.emptyText}>
              {searchQuery
                ? `No projects found for "${searchQuery}".`
                : 'Be the first to publish a project from your dashboard.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.grid}>
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className={styles.card}
                role="button"
                tabIndex={0}
                style={{ '--accent': postAccentColor(post.title) } as React.CSSProperties}
                onClick={() => { setSelected(post); setSelectedModel(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSelected(post); setSelectedModel(null) } }}
              >
                <div className={styles.cardAccentBar} />
                <div className={styles.cardPreview}>
                  {post.preview_url ? (
                    <img src={post.preview_url} alt={post.title} className={styles.cardPreviewImg} draggable={false} />
                  ) : (
                    <div className={styles.cardPlaceholder}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
                  )}
                  <div className={styles.cardOverlay}>
                    <button className={styles.previewBtn} type="button" tabIndex={-1}>Preview</button>
                  </div>
                </div>
                <div className={styles.cardMeta}>
                  <h3 className={styles.cardTitle}>{post.title}</h3>
                  <div className={styles.cardFooter}>
                    <div className={styles.authorRow}>
                      <div className={styles.authorAvatar}>{post.author_name.charAt(0).toUpperCase()}</div>
                      <span className={styles.authorName}>{post.author_name}</span>
                    </div>
                    <button
                      className={`${styles.likeBtn} ${likedSet.has(post.id) ? styles.likeBtnActive : ''}`}
                      type="button"
                      aria-label={likedSet.has(post.id) ? 'Unlike' : 'Like'}
                      onClick={(e) => handleLikeToggle(post.id, e)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={likedSet.has(post.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                      <span>{post.likes_count}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className={styles.listRow}
                role="button"
                tabIndex={0}
                style={{ '--accent': postAccentColor(post.title) } as React.CSSProperties}
                onClick={() => { setSelected(post); setSelectedModel(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') { setSelected(post); setSelectedModel(null) } }}
              >
                <div className={styles.listRowAccent} />
                <div className={styles.listRowMain}>
                  <span className={styles.listRowTitle}>{post.title}</span>
                </div>
                <div className={styles.listRowMeta}>
                  <div className={styles.authorRow}>
                    <div className={styles.authorAvatar}>{post.author_name.charAt(0).toUpperCase()}</div>
                    <span className={styles.authorName}>{post.author_name}</span>
                  </div>
                  <span className={styles.listRowDate}>{formatRelativeTime(post.published_at)}</span>
                </div>
                <div className={styles.listRowActions}>
                  <button
                    className={`${styles.likeBtn} ${likedSet.has(post.id) ? styles.likeBtnActive : ''}`}
                    type="button"
                    aria-label={likedSet.has(post.id) ? 'Unlike' : 'Like'}
                    onClick={(e) => handleLikeToggle(post.id, e)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={likedSet.has(post.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span>{post.likes_count}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Detail overlay — same pattern as TemplatesPage */}
      {selected && (
        <div
          className={styles.overlayBackdrop}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div className={styles.overlayContent}>

            {/* Preview pane */}
            <div className={styles.overlayPreview}>
              <button
                className={styles.overlayClose}
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close preview"
              >
                ✕
              </button>
              <div className={styles.overlayImgWrapper}>
                {selected.preview_url ? (
                  <img src={selected.preview_url} alt={selected.title} className={styles.overlayImg} />
                ) : (
                  <div className={styles.overlayImgPlaceholder}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p>No preview available</p>
                  </div>
                )}
              </div>
            </div>

            {/* Info panel */}
            <div className={styles.overlayPanel}>
              {/* Author */}
              <div className={styles.overlayAuthorRow}>
                <div className={styles.overlayAuthorAvatar}>{selected.author_name.charAt(0).toUpperCase()}</div>
                <div className={styles.overlayAuthorInfo}>
                  <span className={styles.overlayAuthorLabel}>Published by</span>
                  <span className={styles.overlayAuthorName}>{selected.author_name}</span>
                </div>
                <button
                  className={`${styles.overlayLikeBtn} ${likedSet.has(selected.id) ? styles.overlayLikeBtnActive : ''}`}
                  type="button"
                  aria-label={likedSet.has(selected.id) ? 'Unlike' : 'Like'}
                  onClick={(e) => handleLikeToggle(selected.id, e)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill={likedSet.has(selected.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  <span>{selected.likes_count}</span>
                </button>
              </div>

              <h2 className={styles.overlayTitle}>{selected.title}</h2>

              {selected.description && (
                <p className={styles.overlayDesc}>{selected.description}</p>
              )}

              <p className={styles.overlayDate}>Published {formatRelativeTime(selected.published_at)}</p>

              <div className={styles.modelSection}>
                <span className={styles.modelLabel}>Select model to use</span>
                <ModelSelector
                  page="dashboard"
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                  placement="bottom"
                  subLayout="stacked"
                />
              </div>

              <div className={styles.spacer} />

              <button
                className={styles.useBtn}
                type="button"
                onClick={handleUseProject}
                disabled={!selectedModel || launching}
                style={{ background: postAccentColor(selected.title) }}
              >
                {launching ? 'Starting…' : 'Use this project →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

### CommunityPage.module.css

- [ ] **Step 2: Create `src/pages/CommunityPage.module.css`**

```css
/* Layout */
.root {
  display: flex;
  min-height: 100vh;
  background: #0d0d1a;
  color: #e8e8f0;
}

.main {
  flex: 1;
  padding: 48px 48px 64px;
  overflow-y: auto;
}

/* Header */
.header {
  margin-bottom: 32px;
}

.heading {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}

.subheading {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
  margin: 0;
}

/* Controls bar — identical to DashboardPage */
.controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.searchWrapper {
  position: relative;
  flex: 1;
  min-width: 180px;
  max-width: 320px;
}

.searchIcon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.35);
  pointer-events: none;
}

.searchInput {
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 7px 32px 7px 30px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  outline: none;
  transition: border-color 0.15s;
}
.searchInput:focus { border-color: rgba(167, 139, 250, 0.4); }
.searchInput::placeholder { color: rgba(255, 255, 255, 0.3); }

.searchClear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}
.searchClear:hover { color: rgba(255, 255, 255, 0.7); }

.sortSelect {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.viewToggle {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.viewBtn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 7px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
}
.viewBtn:hover { color: rgba(255, 255, 255, 0.7); }
.viewBtnActive { color: rgba(255, 255, 255, 0.9) !important; background: rgba(255, 255, 255, 0.1); }

/* Empty state */
.emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 80px 20px;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
}

.emptyIcon { opacity: 0.4; }

.emptyTitle {
  font-size: 16px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

.emptyText {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.35);
  max-width: 320px;
  line-height: 1.5;
  margin: 0;
}

/* Grid */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

/* Card */
.card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  position: relative;
  display: flex;
  flex-direction: column;
}
.card:hover {
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.cardAccentBar {
  height: 3px;
  background: var(--accent, #7c6af7);
  width: 100%;
}

.cardPreview {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.03);
  position: relative;
}

.cardPreviewImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cardPlaceholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.15);
}

.cardOverlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.card:hover .cardOverlay { opacity: 1; }

.previewBtn {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  pointer-events: none;
}

.cardMeta {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.cardTitle {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cardFooter {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Author row */
.authorRow {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.authorAvatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c6af7, #4f9cf9);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.authorName {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Like button */
.likeBtn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}
.likeBtn:hover { color: #e05ae0; background: rgba(224, 90, 224, 0.1); }
.likeBtnActive { color: #e05ae0 !important; }
.likeBtnActive svg { fill: #e05ae0; }

/* List view */
.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.listRow {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  position: relative;
  overflow: hidden;
}
.listRow:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
}

.listRowAccent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent, #7c6af7);
  border-radius: 3px 0 0 3px;
}

.listRowMain {
  flex: 1;
  min-width: 0;
  padding-left: 4px;
}

.listRowTitle {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.listRowMeta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.listRowDate {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
}

.listRowActions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* Overlay */
.overlayBackdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  z-index: 100;
  display: flex;
  align-items: stretch;
}

.overlayContent {
  display: flex;
  width: 100%;
  height: 100%;
}

.overlayPreview {
  flex: 1;
  background: #0a0a16;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.overlayClose {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  transition: background 0.15s, color 0.15s;
}
.overlayClose:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }

.overlayImgWrapper {
  width: 85%;
  max-width: 900px;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.overlayImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.overlayImgPlaceholder {
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.2);
  font-size: 13px;
}

/* Info panel */
.overlayPanel {
  width: 340px;
  flex-shrink: 0;
  background: #13131f;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.overlayAuthorRow {
  display: flex;
  align-items: center;
  gap: 10px;
}

.overlayAuthorAvatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c6af7, #4f9cf9);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.overlayAuthorInfo {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.overlayAuthorLabel {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 600;
}

.overlayAuthorName {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.overlayLikeBtn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.overlayLikeBtn:hover { color: #e05ae0; background: rgba(224, 90, 224, 0.1); border-color: rgba(224, 90, 224, 0.3); }
.overlayLikeBtnActive { color: #e05ae0 !important; background: rgba(224, 90, 224, 0.1); border-color: rgba(224, 90, 224, 0.3); }
.overlayLikeBtnActive svg { fill: #e05ae0; }

.overlayTitle {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.overlayDesc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.6;
  margin: 0;
}

.overlayDate {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.3);
  margin: 0;
}

.modelSection {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modelLabel {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.spacer { flex: 1; }

.useBtn {
  color: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px 20px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  width: 100%;
  text-align: center;
}
.useBtn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.useBtn:disabled { opacity: 0.45; cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/CommunityPage.tsx src/pages/CommunityPage.module.css src/App.tsx
git commit -m "feat: add CommunityPage with grid/list view, likes, search, sort and project fork overlay"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Users can publish projects to Community → Task 3 (context menu + modal)
- [x] Community tab in sidebar shows published projects → Tasks 2 + 4 + 5
- [x] Like/unlike → CommunityPage `handleLikeToggle` + `community_likes` table
- [x] Sort by Recent / Most Liked → CommunityPage `sortBy` state + `.sort()`
- [x] Search → CommunityPage `searchQuery` filters by title + author
- [x] Author is public → `author_name` column shown in card footer + overlay
- [x] Same card/list/search/sort display as Projects → identical controls pattern
- [x] Opening uses same overlay as Templates → full-screen preview + info panel
- [x] Resources tab removed → Task 2
- [x] "Use this project" forks via `templateFiles` state → same as `handleUseTemplate` in TemplatesPage

**Placeholder scan:** None found.

**Type consistency:**
- `CommunityPost.files_snapshot: AgentCodeFile[]` used in Task 5 matches `AgentCodeFile` imported from `'../lib/agent'`
- `handleUseProject` passes `templateFiles: selected.files_snapshot` matching `ProjectRouteState.templateFiles?: AgentCodeFile[]`
- `handlePublishSubmit` inserts `files_snapshot: projectData?.files ?? []` from `projects.files` (same type)
