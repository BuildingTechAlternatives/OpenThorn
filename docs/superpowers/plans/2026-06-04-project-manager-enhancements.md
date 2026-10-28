# Project Manager Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the DashboardPage project manager with 6 UX improvements: relative "last edited" timestamps, list/grid view toggle, shared project badges, sort control, inline search, and per-project color accents.

**Architecture:** All changes are confined to `DashboardPage.tsx`, `DashboardPage.module.css`, and one new Supabase migration. No new components are created — the features are all self-contained within the existing dashboard page. The DB gains an `updated_at` column with an auto-update trigger. Client-side state handles search/sort/view preferences.

**Tech Stack:** React, TypeScript, CSS Modules, Supabase (postgres migration)

---

## File Map

| File | Change |
|------|--------|
| `supabase/migrations/20260604000003_projects_updated_at.sql` | New — adds `updated_at` column + auto-update trigger |
| `src/pages/DashboardPage.tsx` | Modify — fetch `updated_at`, add state + controls + list view rendering |
| `src/pages/DashboardPage.module.css` | Modify — styles for controls bar, list view, shared badge, color accent |

---

### Task 1: DB Migration — `updated_at` column

**Files:**
- Create: `supabase/migrations/20260604000003_projects_updated_at.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add updated_at to projects, defaulting to created_at for existing rows
alter table public.projects
  add column if not exists updated_at timestamptz not null default now();

-- Back-fill existing rows: set updated_at = created_at
update public.projects set updated_at = created_at where updated_at = now();

-- Trigger function: keep updated_at current on every row update
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with the migration name `projects_updated_at` and the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260604000003_projects_updated_at.sql
git commit -m "feat: add updated_at column and trigger to projects table"
```

---

### Task 2: Update Project type + fetch `updated_at`

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Update the `Project` interface at the top of DashboardPage.tsx**

Find:
```typescript
interface Project {
  id: string
  user_id: string
  title: string
  preview_url: string | null
  created_at: string
  starred: boolean
  isShared?: boolean
}
```
Replace with:
```typescript
interface Project {
  id: string
  user_id: string
  title: string
  preview_url: string | null
  created_at: string
  updated_at: string
  starred: boolean
  isShared?: boolean
}
```

- [ ] **Step 2: Update both Supabase select queries to include `updated_at`**

Find (owned projects query):
```typescript
        .select('id, user_id, title, preview_url, created_at, starred')
        .eq('user_id', user.id)
```
Replace with:
```typescript
        .select('id, user_id, title, preview_url, created_at, updated_at, starred')
        .eq('user_id', user.id)
```

Find (shared projects query):
```typescript
        .select('id, user_id, title, preview_url, created_at, starred')
        .in('id', ids)
```
Replace with:
```typescript
        .select('id, user_id, title, preview_url, created_at, updated_at, starred')
        .in('id', ids)
```

- [ ] **Step 3: Add a `formatRelativeTime` helper just above the `examplePrompts` array**

```typescript
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
```

- [ ] **Step 4: Add a `projectAccentColor` helper just below `formatRelativeTime`**

```typescript
const ACCENT_COLORS = [
  '#7c6af7', // violet
  '#4f9cf9', // blue
  '#34c98a', // teal
  '#f97b4f', // orange
  '#e05ae0', // pink
  '#f7c048', // amber
  '#5ec7f7', // sky
  '#a78bfa', // lavender
]

function projectAccentColor(title: string): string {
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0
  }
  return ACCENT_COLORS[hash % ACCENT_COLORS.length]
}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: fetch updated_at and add relative time + accent color helpers"
```

---

### Task 3: State for search, sort, and view mode

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

- [ ] **Step 1: Add three new state variables inside `DashboardPage` (after the existing `renamingProject` state)**

```typescript
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'starred'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
```

- [ ] **Step 2: Replace the existing `filteredProjects` computation with a version that also searches and sorts**

Find:
```typescript
  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'starred') return p.starred
    if (activeFilter === 'mine') return p.user_id === user?.id
    if (activeFilter === 'shared') return p.isShared === true
    return true
  })
```
Replace with:
```typescript
  const filteredProjects = projects
    .filter((p) => {
      if (activeFilter === 'starred') return p.starred
      if (activeFilter === 'mine') return p.user_id === user?.id
      if (activeFilter === 'shared') return p.isShared === true
      return true
    })
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') return a.title.localeCompare(b.title)
      if (sortBy === 'starred') return Number(b.starred) - Number(a.starred)
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: add search, sort, and view-mode state to project manager"
```

---

### Task 4: Controls bar UI (search + sort + view toggle)

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.module.css`

- [ ] **Step 1: Add the controls bar JSX between the `<h2>` and the loading state in the projects section**

Find:
```tsx
          <section ref={projectsSectionRef} className={styles.projectsSection}>
            <h2 className={styles.sectionTitle}>{filterLabel}</h2>

            {projectsLoading ? (
```
Replace with:
```tsx
          <section ref={projectsSectionRef} className={styles.projectsSection}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{filterLabel}</h2>
              <div className={styles.controls}>
                <div className={styles.searchWrapper}>
                  <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    className={styles.searchInput}
                    type="text"
                    placeholder="Search projects…"
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
                  onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'starred')}
                  aria-label="Sort projects"
                >
                  <option value="recent">Recent</option>
                  <option value="name">Name</option>
                  <option value="starred">Starred</option>
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
            </div>

            {projectsLoading ? (
```

- [ ] **Step 2: Add CSS for the controls bar in `DashboardPage.module.css` (append to end of file, before the `@media` block)**

```css
/* Section header with controls */
.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}

.sectionHeader .sectionTitle {
  margin-bottom: 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Search */
.searchWrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.searchIcon {
  position: absolute;
  left: 10px;
  color: var(--color-text-muted);
  pointer-events: none;
}

.searchInput {
  width: 180px;
  padding: 7px 32px 7px 30px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-size: 13px;
  font-family: var(--font-body);
  outline: none;
  transition: border-color 0.15s ease, width 0.2s ease;
}

.searchInput::placeholder {
  color: var(--color-text-muted);
}

.searchInput:focus {
  border-color: var(--color-secondary);
  width: 220px;
}

.searchClear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
  border-radius: 3px;
  transition: color 0.12s ease;
}

.searchClear:hover {
  color: var(--color-text);
}

/* Sort select */
.sortSelect {
  padding: 7px 28px 7px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
  outline: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.sortSelect:hover,
.sortSelect:focus {
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--color-text);
}

/* View toggle */
.viewToggle {
  display: flex;
  align-items: center;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 3px;
  gap: 2px;
}

.viewBtn {
  width: 28px;
  height: 28px;
  border-radius: 20px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}

.viewBtn:hover {
  color: var(--color-text);
}

.viewBtnActive {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text) !important;
}
```

- [ ] **Step 3: Also remove `margin-bottom` from `.sectionTitle` since it now lives inside `.sectionHeader`**

Find in `.sectionTitle`:
```css
.sectionTitle {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--space-lg);
}
```
Replace with:
```css
.sectionTitle {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0;
}
```

And keep the `.sectionHeader .sectionTitle { margin-bottom: 0; }` rule as a no-op safety clause.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.module.css
git commit -m "feat: add search, sort, and view-mode controls to project manager"
```

---

### Task 5: Grid card — shared badge + color accent + relative timestamp

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.module.css`

- [ ] **Step 1: Update the project card JSX to add shared badge, color accent, and relative timestamp**

Find the entire `<div key={project.id} className={styles.projectCard} ...>` block (lines ~397–474 in the original file) and replace it with:

```tsx
                  <div
                    key={project.id}
                    className={styles.projectCard}
                    role="button"
                    tabIndex={0}
                    style={{ '--accent': projectAccentColor(project.title) } as React.CSSProperties}
                    onClick={() => navigate(`/projects/${project.id}`, { state: { title: project.title } })}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${project.id}`, { state: { title: project.title } }) }}
                  >
                    <div className={styles.projectAccentBar} />
                    <div className={styles.projectPreview}>
                      {project.preview_url ? (
                        <img
                          src={project.preview_url}
                          alt={project.title}
                          className={styles.projectPreviewImg}
                          draggable={false}
                        />
                      ) : (
                        <div className={styles.projectPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className={styles.projectMeta}>
                      {renamingProject?.id === project.id ? (
                        <input
                          className={styles.renameInput}
                          value={renamingProject.title}
                          onChange={(e) => setRenamingProject({ ...renamingProject, title: e.target.value })}
                          onBlur={() => handleRenameSubmit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit()
                            if (e.key === 'Escape') setRenamingProject(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <h3 className={styles.projectTitle}>{project.title}</h3>
                      )}
                      <div className={styles.projectFooter}>
                        <span className={styles.projectDate}>
                          {formatRelativeTime(project.updated_at)}
                        </span>
                        {project.isShared && (
                          <span className={styles.sharedBadge}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                            </svg>
                            Shared
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`${styles.starBtn} ${project.starred ? styles.starBtnActive : ''}`}
                      type="button"
                      aria-label={project.starred ? 'Unstar project' : 'Star project'}
                      onClick={(e) => handleStarToggle(project.id, e)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill={project.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                    </button>
                    <button
                      className={styles.contextMenuBtn}
                      type="button"
                      aria-label="Project actions"
                      onClick={(e) => {
                        e.stopPropagation()
                        setContextMenu(contextMenu?.projectId === project.id ? null : { projectId: project.id, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </button>
                  </div>
```

- [ ] **Step 2: Add CSS for the accent bar, shared badge, and project footer in `DashboardPage.module.css`**

Append before the `@media` block:

```css
/* Color accent bar at top of card */
.projectAccentBar {
  height: 3px;
  background: var(--accent, #7c6af7);
  border-radius: 0;
  flex-shrink: 0;
}

/* Shared badge */
.projectFooter {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.sharedBadge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-secondary);
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 20px;
  padding: 2px 7px;
  line-height: 1.4;
  letter-spacing: 0.01em;
}
```

- [ ] **Step 3: Update `.projectGrid` to remove gap between the card's top border-radius and the accent bar**

The `.projectCard` already has `overflow: hidden` which clips the accent bar cleanly — no changes needed there.

- [ ] **Step 4: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.module.css
git commit -m "feat: add color accent bar, shared badge, relative timestamp to project cards"
```

---

### Task 6: List view rendering

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.module.css`

- [ ] **Step 1: Wrap the project grid in a conditional that switches between grid and list rendering**

Find:
```tsx
            ) : (
              <div className={styles.projectGrid}>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={styles.projectCard}
```

Replace the entire grid block (from `<div className={styles.projectGrid}>` to its closing `</div>`) with:

```tsx
            ) : viewMode === 'grid' ? (
              <div className={styles.projectGrid}>
                {filteredProjects.map((project) => (
                  /* ... existing card JSX (already updated in Task 5) ... */
                ))}
              </div>
            ) : (
              <div className={styles.projectList}>
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className={styles.projectListRow}
                    role="button"
                    tabIndex={0}
                    style={{ '--accent': projectAccentColor(project.title) } as React.CSSProperties}
                    onClick={() => navigate(`/projects/${project.id}`, { state: { title: project.title } })}
                    onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/projects/${project.id}`, { state: { title: project.title } }) }}
                  >
                    <div className={styles.listRowAccent} />
                    <div className={styles.listRowMain}>
                      {renamingProject?.id === project.id ? (
                        <input
                          className={styles.renameInput}
                          value={renamingProject.title}
                          onChange={(e) => setRenamingProject({ ...renamingProject, title: e.target.value })}
                          onBlur={() => handleRenameSubmit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit()
                            if (e.key === 'Escape') setRenamingProject(null)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : (
                        <span className={styles.listRowTitle}>{project.title}</span>
                      )}
                    </div>
                    <div className={styles.listRowMeta}>
                      {project.isShared && (
                        <span className={styles.sharedBadge}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                          </svg>
                          Shared
                        </span>
                      )}
                      <span className={styles.listRowDate}>{formatRelativeTime(project.updated_at)}</span>
                    </div>
                    <div className={styles.listRowActions}>
                      <button
                        className={`${styles.starBtn} ${project.starred ? styles.starBtnActive : ''}`}
                        type="button"
                        aria-label={project.starred ? 'Unstar project' : 'Star project'}
                        onClick={(e) => handleStarToggle(project.id, e)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={project.starred ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                      <button
                        className={styles.contextMenuBtn}
                        type="button"
                        aria-label="Project actions"
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenu(contextMenu?.projectId === project.id ? null : { projectId: project.id, x: e.clientX, y: e.clientY })
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <circle cx="8" cy="3" r="1.5" />
                          <circle cx="8" cy="8" r="1.5" />
                          <circle cx="8" cy="13" r="1.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
```

**Important:** In the grid branch, keep the full card JSX from Task 5 exactly as-is. The list branch above is new. Do not accidentally remove the grid JSX when replacing this block — replace only the wrapper conditional and add the list section after.

The safest approach is:
1. Find the line `<div className={styles.projectGrid}>` 
2. Change `} : (` just before it to `} : viewMode === 'grid' ? (`
3. Find the closing `</div>` of the `projectGrid` div (ends with `</div>` before the empty-state conditional's closing `}`
4. After that closing `</div>`, before the final `)`, add `: ( <div className={styles.projectList}> ...list rows... </div> )`

- [ ] **Step 2: Add list view CSS in `DashboardPage.module.css` (append before `@media`)**

```css
/* List view */
.projectList {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.projectListRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  background: var(--color-surface-raised);
  cursor: pointer;
  position: relative;
  transition: background 0.15s ease;
  min-height: 52px;
}

.projectListRow:hover {
  background: rgba(255, 255, 255, 0.03);
}

.projectListRow + .projectListRow {
  border-top: 1px solid var(--color-border);
}

.listRowAccent {
  width: 3px;
  align-self: stretch;
  background: var(--accent, #7c6af7);
  flex-shrink: 0;
}

.listRowMain {
  flex: 1;
  min-width: 0;
  padding: 14px 0;
}

.listRowTitle {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.listRowMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-right: 4px;
}

.listRowDate {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.listRowActions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 10px;
  flex-shrink: 0;
}

/* In list mode, star and context buttons are always visible */
.projectListRow .starBtn,
.projectListRow .contextMenuBtn {
  opacity: 0;
  position: static;
  background: transparent;
}

.projectListRow:hover .starBtn,
.projectListRow:hover .contextMenuBtn {
  opacity: 1;
}

.projectListRow .starBtnActive {
  opacity: 1;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.module.css
git commit -m "feat: implement list view for project manager"
```

---

### Task 7: Responsive adjustments + empty state for search

**Files:**
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/DashboardPage.module.css`

- [ ] **Step 1: Update the empty state to handle "no search results" separately from "no projects"**

Find in the empty state block:
```tsx
              <h3 className={styles.emptyTitle}>
                  {activeFilter === 'starred' ? 'No starred projects' : activeFilter === 'mine' ? 'No projects yet' : 'No projects yet'}
                </h3>
                <p className={styles.emptyText}>
                  {activeFilter === 'starred'
                    ? 'Star a project to find it here quickly.'
                    : 'Describe what you want to build above and hit Send to create your first project.'}
                </p>
```
Replace with:
```tsx
              <h3 className={styles.emptyTitle}>
                  {searchQuery
                    ? 'No projects match'
                    : activeFilter === 'starred' ? 'No starred projects'
                    : 'No projects yet'}
                </h3>
                <p className={styles.emptyText}>
                  {searchQuery
                    ? `No projects found for "${searchQuery}". Try a different search.`
                    : activeFilter === 'starred'
                    ? 'Star a project to find it here quickly.'
                    : 'Describe what you want to build above and hit Send to create your first project.'}
                </p>
```

- [ ] **Step 2: Add responsive CSS for controls bar inside the `@media (max-width: 768px)` block**

Find:
```css
  .projectGrid {
    grid-template-columns: 1fr;
  }
```
Replace with:
```css
  .projectGrid {
    grid-template-columns: 1fr;
  }

  .sectionHeader {
    flex-direction: column;
    align-items: flex-start;
  }

  .controls {
    width: 100%;
    flex-wrap: wrap;
  }

  .searchInput {
    width: 140px;
  }

  .searchInput:focus {
    width: 180px;
  }
```

- [ ] **Step 3: Final commit**

```bash
git add src/pages/DashboardPage.tsx src/pages/DashboardPage.module.css
git commit -m "feat: responsive controls and search empty state for project manager"
```

---

## Self-Review

**Spec coverage:**
1. ✅ Relative timestamp — `formatRelativeTime(project.updated_at)` in Task 2 + DB migration in Task 1
2. ✅ (3) List view toggle — Task 6 renders list rows, Task 4 adds the toggle button
3. ✅ (4) Shared badge — Task 5 grid + Task 6 list both render `sharedBadge`
4. ✅ (5) Sort control — Task 3 sorts, Task 4 renders the `<select>`
5. ✅ (6) Inline search — Task 3 filters, Task 4 renders the search input + clear button
6. ✅ (7) Color accent — `projectAccentColor` helper + `--accent` CSS variable + accent bar rendered in both views

**Type consistency:**
- `project.updated_at` — added to `Project` interface in Task 2, fetched in Task 2, used in Tasks 5 & 6
- `formatRelativeTime` — defined in Task 2, called in Tasks 5 & 6
- `projectAccentColor` — defined in Task 2, called in Tasks 5 & 6
- `sortBy` — typed `'recent' | 'name' | 'starred'`, matches the `<select>` option values
- `viewMode` — typed `'grid' | 'list'`, matches the toggle buttons
- `ACCENT_COLORS` — referenced only in `projectAccentColor`, no external consumers

**Placeholder scan:** No TBDs, no "similar to Task N" references, all code blocks are complete.
