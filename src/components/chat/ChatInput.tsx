import { useState, useRef, useEffect } from 'react'
import PlusMenu from './PlusMenu'
import ProviderSelector from './ProviderSelector'
import styles from './ChatInput.module.css'

interface Props {
  mode: 'plan' | 'build'
  onToggleMode: (m: 'plan' | 'build') => void
  onSend: (text: string) => void
  providerId: string | null
  model: string | null
  onProviderSelect: (providerId: string, model: string) => void
  streaming: boolean
}

export default function ChatInput({ mode, onToggleMode, onSend, providerId, model, onProviderSelect, streaming }: Props) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [modeOpen, setModeOpen] = useState(false)
  const modeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!modeOpen) return
    const onClick = (e: MouseEvent) => {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) {
        setModeOpen(false)
      }
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [modeOpen])

  return (
    <div className={styles.wrapper}>
      {/* Input Row */}
      <div className={styles.inputRow}>
        <div className={styles.inputWrapper}>
          <textarea
            className={styles.textarea}
            placeholder={streaming ? 'Bloom is generating...' : mode === 'plan' ? 'Describe your plan...' : 'Describe what you want to build...'}
            rows={2}
            value={text}
            disabled={streaming}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !streaming) {
                e.preventDefault()
                if (text.trim()) {
                  onSend(text.trim())
                  setText('')
                }
              }
            }}
          />

          <div className={styles.actions}>
            <PlusMenu />

            <ProviderSelector
              selectedProviderId={providerId}
              selectedModel={model}
              onSelect={onProviderSelect}
            />

            {/* Mode dropdown */}
            <div className={styles.modeDropdown} ref={modeRef}>
              <button
                className={styles.modeBtn}
                onClick={() => setModeOpen(!modeOpen)}
                title="Toggle mode"
              >
                {mode === 'build' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                )}
                <span>{mode === 'build' ? 'Build' : 'Plan'}</span>
                <svg className={styles.chevron} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {modeOpen && (
                <div className={styles.modeMenu}>
                  <button
                    className={`${styles.modeOption} ${mode === 'plan' ? styles.modeOptionActive : ''}`}
                    onClick={() => { onToggleMode('plan'); setModeOpen(false) }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    <div className={styles.modeOptionText}>
                      <span className={styles.modeOptionLabel}>Plan</span>
                      <span className={styles.modeOptionDesc}>Sketch architecture first</span>
                    </div>
                  </button>
                  <button
                    className={`${styles.modeOption} ${mode === 'build' ? styles.modeOptionActive : ''}`}
                    onClick={() => { onToggleMode('build'); setModeOpen(false) }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"/>
                      <polyline points="8 6 2 12 8 18"/>
                    </svg>
                    <div className={styles.modeOptionText}>
                      <span className={styles.modeOptionLabel}>Build</span>
                      <span className={styles.modeOptionDesc}>Generate working code</span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <div className={styles.divider} />

            <button
              className={`${styles.voiceBtn} ${listening ? styles.listening : ''}`}
              onClick={() => setListening(!listening)}
              title="Voice input"
            >
              {listening ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4 M8 22h8"/>
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4 M8 22h8"/>
                </svg>
              )}
            </button>

            <button
              className={`${styles.sendBtn} ${streaming ? styles.sendStop : ''} ${text.trim() && !streaming ? styles.hasText : ''}`}
              disabled={!streaming && !text.trim()}
              title={streaming ? 'Stop' : 'Send'}
              onClick={() => {
                if (streaming) return
                if (text.trim()) {
                  onSend(text.trim())
                  setText('')
                }
              }}
            >
              {streaming ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="m21.426 11.095-17-8A.999.999 0 0 0 3.03 4.242L4.969 12 3.03 19.758a.998.998 0 0 0 1.396 1.147l17-8a1 1 0 0 0 0-1.81z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Listening indicator */}
      {listening && (
        <div className={styles.listeningBar}>
          <div className={styles.waveform}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={styles.bar} style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <span className={styles.listeningText}>Listening…</span>
        </div>
      )}
    </div>
  )
}
