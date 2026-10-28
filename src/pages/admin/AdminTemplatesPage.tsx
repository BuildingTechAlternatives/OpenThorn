import { useState, useEffect, useCallback, useRef } from 'react'
import { buildPreview } from '../../lib/preview-bundle'
import type { AgentCodeFile } from '../../lib/agent'
import {
  adminListTemplates,
  adminSaveTemplate,
  adminDeleteTemplate,
  type AdminTemplateRow,
  type TemplateDraft,
} from '../../lib/templates-admin'
import styles from './AdminTemplatesPage.module.css'

type Status = { kind: 'ok' | 'error'; text: string } | null

const CATEGORIES = ['Portfolio', 'SaaS', 'E-commerce', 'Restaurant', 'Blog']

const EMPTY_TEMPLATE: TemplateDraft = {
  template_key: '',
  name: '',
  description: '',
  category: 'SaaS',
  accent_color: '#2563eb',
  highlights: [],
  files: [
    {
      path: 'src/App.tsx',
      language: 'tsx',
      code: 'export default function App() { return <h1>Hello</h1> }',
    },
  ],
  featured: false,
  sort_order: 0,
  status: 'draft',
}

function cloneDraft(draft: TemplateDraft): TemplateDraft {
  return {
    ...draft,
    highlights: [...draft.highlights],
    files: draft.files.map(file => ({ ...file })),
  }
}

function rowToDraft(row: AdminTemplateRow): TemplateDraft {
  return {
    template_key: row.template_key,
    name: row.name,
    description: row.description,
    category: row.category,
    accent_color: row.accent_color,
    highlights: Array.isArray(row.highlights) ? row.highlights : [],
    files: Array.isArray(row.files) ? row.files : [],
    featured: row.featured,
    sort_order: row.sort_order,
    status: row.status,
  }
}

export default function AdminTemplatesPage() {
  const [rows, setRows] = useState<AdminTemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TemplateDraft>(() => cloneDraft(EMPTY_TEMPLATE))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await adminListTemplates())
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Load failed' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const editing = editingId !== null

  const setValue = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
  }

  const setFile = (index: number, patch: Partial<AgentCodeFile>) => {
    setDraft(current => ({
      ...current,
      files: current.files.map((file, fileIndex) => (
        fileIndex === index ? { ...file, ...patch } : file
      )),
    }))
  }

  const addFile = () => {
    setDraft(current => ({
      ...current,
      files: [...current.files, { path: 'src/new.tsx', language: 'tsx', code: '' }],
    }))
  }

  const removeFile = (index: number) => {
    setDraft(current => ({
      ...current,
      files: current.files.filter((_, fileIndex) => fileIndex !== index),
    }))
  }

  useEffect(() => {
    if (!editing) return
    if (previewTimer.current) clearTimeout(previewTimer.current)

    previewTimer.current = setTimeout(() => {
      buildPreview(draft.files.map(file => ({ path: file.path, content: file.code })))
        .then(result => {
          if (result.errors.length) {
            setPreviewError(result.errors[0])
          } else {
            setPreviewError(null)
            setPreviewHtml(result.html)
          }
        })
        .catch(err => {
          setPreviewError(err instanceof Error ? err.message : 'Preview failed')
        })
    }, 600)

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current)
    }
  }, [editing, draft.files])

  const openNew = () => {
    setDraft(cloneDraft(EMPTY_TEMPLATE))
    setEditingId('')
    setStatus(null)
    setPreviewHtml('')
    setPreviewError(null)
  }

  const openEdit = (row: AdminTemplateRow) => {
    setDraft(rowToDraft(row))
    setEditingId(row.id)
    setStatus(null)
    setPreviewHtml('')
    setPreviewError(null)
  }

  const closeEditor = () => {
    setEditingId(null)
    setStatus(null)
  }

  const save = async (publish: boolean) => {
    if (!draft.template_key.trim() || !draft.name.trim()) {
      setStatus({ kind: 'error', text: 'Key and name are required.' })
      return
    }
    if (draft.files.length === 0) {
      setStatus({ kind: 'error', text: 'At least one file is required.' })
      return
    }

    setBusy(true)
    setStatus(null)
    try {
      await adminSaveTemplate(
        { ...draft, status: publish ? 'published' : draft.status },
        editingId || undefined,
      )
      await load()
      setStatus({ kind: 'ok', text: publish ? 'Published and live on the gallery.' : 'Saved.' })
      if (editingId === '') setEditingId(null)
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Save failed' })
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: AdminTemplateRow) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    setBusy(true)
    setStatus(null)
    try {
      await adminDeleteTemplate(row.id)
      await load()
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Delete failed' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className={styles.muted}>Loading templates...</p>

  if (editing) {
    return (
      <div className={styles.page}>
        <div className={styles.editorHeader}>
          <button className={styles.btn} type="button" onClick={closeEditor}>Back</button>
          <div className={styles.actions}>
            <button className={styles.btn} type="button" disabled={busy} onClick={() => void save(false)}>
              Save draft
            </button>
            <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" disabled={busy} onClick={() => void save(true)}>
              Publish
            </button>
          </div>
        </div>
        {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Name</span>
            <input className={styles.input} value={draft.name} onChange={event => setValue('name', event.target.value)} />
          </label>
          <label className={styles.field}>
            <span>Key</span>
            <input className={styles.input} value={draft.template_key} onChange={event => setValue('template_key', event.target.value)} placeholder="my-template" />
          </label>
        </div>

        <label className={styles.field}>
          <span>Description</span>
          <input className={styles.input} value={draft.description} onChange={event => setValue('description', event.target.value)} />
        </label>

        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Category</span>
            <select className={styles.input} value={draft.category} onChange={event => setValue('category', event.target.value)}>
              {CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span>Accent color</span>
            <input className={styles.input} value={draft.accent_color} onChange={event => setValue('accent_color', event.target.value)} placeholder="#2563eb" />
          </label>
          <label className={styles.field}>
            <span>Sort order</span>
            <input className={styles.input} type="number" value={draft.sort_order} onChange={event => setValue('sort_order', Number(event.target.value) || 0)} />
          </label>
          <label className={`${styles.field} ${styles.checkField}`}>
            <input type="checkbox" checked={draft.featured} onChange={event => setValue('featured', event.target.checked)} />
            Featured
          </label>
        </div>

        <label className={styles.field}>
          <span>Highlights</span>
          <textarea
            className={styles.textarea}
            rows={3}
            value={draft.highlights.join('\n')}
            onChange={event => setValue('highlights', event.target.value.split('\n').map(line => line.trim()).filter(Boolean))}
          />
        </label>

        <div className={styles.split}>
          <div className={styles.filesPane}>
            <div className={styles.filesHeader}>
              <span>Files</span>
              <button className={styles.btnSmall} type="button" onClick={addFile}>Add file</button>
            </div>
            {draft.files.map((file, index) => (
              <div key={`${file.path}-${index}`} className={styles.fileBlock}>
                <div className={styles.fileTop}>
                  <input className={styles.filePath} value={file.path} onChange={event => setFile(index, { path: event.target.value })} />
                  <button className={styles.btnSmall} type="button" onClick={() => removeFile(index)}>Remove</button>
                </div>
                <textarea
                  className={styles.codeArea}
                  rows={10}
                  value={file.code}
                  spellCheck={false}
                  onChange={event => setFile(index, { code: event.target.value, language: file.language || 'tsx' })}
                />
              </div>
            ))}
          </div>

          <div className={styles.previewPane}>
            <div className={styles.previewLabel}>Live preview</div>
            {previewError && <div className={styles.error}>{previewError}</div>}
            <iframe className={styles.previewFrame} srcDoc={previewHtml} title="Template preview" sandbox="allow-scripts" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Templates</h1>
        <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={openNew}>New template</button>
      </header>
      {status && <div className={status.kind === 'ok' ? styles.ok : styles.error} role="status">{status.text}</div>}

      <div className={styles.list}>
        {rows.length === 0 && <p className={styles.muted}>No templates yet.</p>}
        {rows.map(row => (
          <article key={row.id} className={styles.row}>
            <div className={styles.rowMain}>
              <div className={styles.rowTitle}>
                {row.name}
                <span className={`${styles.badge} ${row.status === 'published' ? styles.badgePub : styles.badgeDraft}`}>{row.status}</span>
                {row.featured && <span className={`${styles.badge} ${styles.badgeFeatured}`}>featured</span>}
              </div>
              <p className={styles.rowMeta}>
                {row.category} / {row.template_key} / {row.files.length} files / order {row.sort_order}
              </p>
            </div>
            <div className={styles.rowActions}>
              <button className={styles.btn} type="button" onClick={() => openEdit(row)}>Edit</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} type="button" disabled={busy} onClick={() => void remove(row)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
