import { useState } from 'react'
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import html from 'react-syntax-highlighter/dist/esm/languages/hljs/htmlbars'
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import { getProject, type ProjectFile } from '../../lib/project'
import styles from './CodePanel.module.css'

SyntaxHighlighter.registerLanguage('html', html)
SyntaxHighlighter.registerLanguage('css', css)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('json', json)

export type CodeView = 'files' | 'code'

function guessLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html': case 'htm': return 'html'
    case 'css': return 'css'
    case 'js': case 'mjs': case 'cjs': return 'javascript'
    case 'json': return 'json'
    case 'ts': case 'tsx': return 'typescript'
    case 'py': return 'python'
    default: return 'text'
  }
}

interface Props {
  initialView?: CodeView
  onClose: () => void
}

export default function CodePanel({ initialView = 'code', onClose }: Props) {
  const files = getProject().files
  const [activeFile, setActiveFile] = useState<ProjectFile | null>(files[0] ?? null)
  const [view, setView] = useState<CodeView>(initialView)

  const fileIcon = (file: ProjectFile): string => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'html': case 'htm': return '⬡'
      case 'css': return '🎨'
      case 'js': case 'mjs': return '⚡'
      case 'json': return '{ }'
      case 'ts': case 'tsx': return 'TS'
      default: return '📄'
    }
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${view === 'files' ? styles.tabActive : ''}`}
            onClick={() => setView('files')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
            Files
          </button>
          <button
            className={`${styles.tab} ${view === 'code' ? styles.tabActive : ''}`}
            onClick={() => setView('code')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/>
              <polyline points="8 6 2 12 8 18"/>
            </svg>
            Code
          </button>
        </div>
        <button className={styles.closeBtn} onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {/* File Tree */}
        <div className={styles.fileTree}>
          <div className={styles.fileTreeHeader}>Project Files</div>
          {files.map((file) => (
            <button
              key={file.name}
              className={`${styles.fileItem} ${activeFile?.name === file.name ? styles.fileActive : ''}`}
              onClick={() => { setActiveFile(file); setView('code') }}
            >
              <span className={styles.fileIcon}>{fileIcon(file)}</span>
              <span className={styles.fileName}>{file.name}</span>
              <span className={styles.filePath}>{file.name}</span>
            </button>
          ))}
        </div>

        {/* Code Viewer */}
        {view === 'code' && (
          <div className={styles.codeViewer}>
            <div className={styles.codeHeader}>
              <span className={styles.codeFileName}>{activeFile?.name}</span>
              <span className={styles.codeLang}>{activeFile ? guessLanguage(activeFile.name) : ''}</span>
            </div>
            <div className={styles.codeContent}>
              <SyntaxHighlighter
                language={activeFile ? guessLanguage(activeFile.name) : 'text'}
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
