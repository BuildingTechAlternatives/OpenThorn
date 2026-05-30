import { useState, useEffect } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import html from 'react-syntax-highlighter/dist/esm/languages/hljs/htmlbars'
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { getWorkspace, subscribeToWorkspace, type WorkspaceFile } from '../../lib/workspace'
import styles from './CodePanel.module.css'

SyntaxHighlighter.registerLanguage('html', html)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('typescript', typescript)
SyntaxHighlighter.registerLanguage('json', json)

export type CodeView = 'files' | 'code'

function guessLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'ts':
      return 'typescript'
    case 'tsx':
      return 'typescript'
    case 'json':
      return 'json'
    case 'py':
      return 'python'
    default:
      return 'text'
  }
}

function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
    case 'htm':
      return 'HTML'
    case 'css':
      return 'CSS'
    case 'js':
    case 'mjs':
      return 'JS'
    case 'ts':
      return 'TS'
    case 'tsx':
      return 'TSX'
    case 'json':
      return '{}'
    case 'md':
      return 'MD'
    default:
      return '--'
  }
}

interface Props {
  initialView?: CodeView
  onClose: () => void
}

export default function CodePanel({ initialView = 'code', onClose }: Props) {
  const [files, setFiles] = useState<WorkspaceFile[]>(getWorkspace().files)
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(
    files[0] ?? null
  )
  const [view, setView] = useState<CodeView>(initialView)

  // Subscribe to workspace changes
  useEffect(() => {
    return subscribeToWorkspace(() => {
      const updated = getWorkspace().files
      setFiles(updated)
      // Keep active file selection if it still exists
      setActiveFile((prev) => {
        if (!prev) return updated[0] ?? null
        const stillExists = updated.find((f) => f.path === prev.path)
        return stillExists ?? updated[0] ?? null
      })
    })
  }, [])

  // Build file tree with folder grouping
  const fileTree = buildFileTree(files)

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${view === 'files' ? styles.tabActive : ''}`}
            onClick={() => setView('files')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            Files
          </button>
          <button
            className={`${styles.tab} ${view === 'code' ? styles.tabActive : ''}`}
            onClick={() => setView('code')}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code
          </button>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Close">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* File Tree */}
        <div className={styles.fileTree}>
          <div className={styles.fileTreeHeader}>
            Project Files
            <span className={styles.fileCount}>{files.length}</span>
          </div>
          {fileTree.map((entry) => {
            if ('folder' in entry) {
              return (
                <div key={entry.folder} className={styles.folder}>
                  <span className={styles.folderName}>{entry.folder}/</span>
                </div>
              )
            }
            const file = entry as WorkspaceFile
            return (
              <button
                key={file.path}
                className={`${styles.fileItem} ${activeFile?.path === file.path ? styles.fileActive : ''}`}
                onClick={() => {
                  setActiveFile(file)
                  setView('code')
                }}
              >
                <span className={styles.fileIcon}>{fileIcon(file.path)}</span>
                <span className={styles.fileName}>
                  {file.path.split('/').pop()}
                </span>
                <span className={styles.filePath}>{file.path}</span>
              </button>
            )
          })}
        </div>

        {/* Code Viewer */}
        {view === 'code' && (
          <div className={styles.codeViewer}>
            <div className={styles.codeHeader}>
              <span className={styles.codeFileName}>{activeFile?.path}</span>
              <span className={styles.codeLang}>
                {activeFile ? guessLanguage(activeFile.path) : ''}
              </span>
            </div>
            <div className={styles.codeContent}>
              <SyntaxHighlighter
                language={
                  activeFile ? guessLanguage(activeFile.path) : 'text'
                }
                style={atomOneDark}
                showLineNumbers
                wrapLines
                customStyle={{
                  margin: 0,
                  padding: '20px',
                  background: '#1e1e1e',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  fontFamily: "'Fira Code', 'Cascadia Code', monospace",
                  borderRadius: 0,
                }}
                lineNumberStyle={{
                  color: '#3d3d4a',
                  minWidth: '2em',
                  paddingRight: '1.5em',
                  userSelect: 'none',
                }}
              >
                {activeFile?.content ?? ''}
              </SyntaxHighlighter>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── File Tree Builder ────────────────────────────── */

interface FolderEntry {
  folder: string
}

function buildFileTree(
  files: WorkspaceFile[]
): (WorkspaceFile | FolderEntry)[] {
  const folders = new Map<string, WorkspaceFile[]>()
  const root: WorkspaceFile[] = []

  for (const f of files) {
    const parts = f.path.split('/')
    if (parts.length === 1) {
      root.push(f)
    } else {
      const folder = parts.slice(0, -1).join('/')
      if (!folders.has(folder)) folders.set(folder, [])
      folders.get(folder)!.push(f)
    }
  }

  const result: (WorkspaceFile | FolderEntry)[] = []

  // Root files first
  for (const f of root) result.push(f)

  // Then folders with their files
  for (const [folder, folderFiles] of folders) {
    result.push({ folder })
    for (const f of folderFiles.sort((a, b) => a.path.localeCompare(b.path)))
      result.push(f)
  }

  return result
}
