import { useEffect, useRef, useState } from 'react'
import type { EditSelection } from '../../lib/preview-edit'
import { anchorPopover } from '../../lib/preview-edit'
import styles from './PreviewEditPopover.module.css'

const CHIPS: { label: string; seed: string }[] = [
  { label: 'Restyle', seed: 'Restyle this element: ' },
  { label: 'Spacing', seed: 'Adjust the spacing/padding of this element: ' },
  { label: 'Delete', seed: 'Remove this element.' },
]

interface Props {
  selection: EditSelection
  /** Offset of the iframe within the page, in CSS px. */
  frameOffset: { top: number; left: number }
  busy: boolean
  /** Direct text content edit — no AI. */
  onTextEdit: (selection: EditSelection, newText: string) => void
  /** AI-assisted change. */
  onSubmit: (instruction: string, selection: EditSelection) => void
  onClose: () => void
}

const SIZE = { width: 300, height: 250 }

export default function PreviewEditPopover({
  selection,
  frameOffset,
  busy,
  onTextEdit,
  onSubmit,
  onClose,
}: Props) {
  const hasText = selection.text.trim().length > 0
  const [textValue, setTextValue] = useState(selection.text)
  const [aiValue, setAiValue] = useState('')
  const aiRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setTextValue(selection.text)
    setAiValue('')
  }, [selection])

  const pos = anchorPopover(
    {
      top: selection.rect.top + frameOffset.top,
      left: selection.rect.left + frameOffset.left,
      width: selection.rect.width,
      height: selection.rect.height,
    },
    SIZE,
    { width: window.innerWidth, height: window.innerHeight },
  )

  const textChanged = hasText && textValue.trim() !== selection.text.trim() && textValue.trim().length > 0
  const submitText = () => {
    if (!textChanged || busy) return
    onTextEdit(selection, textValue.trim())
  }
  const submitAi = () => {
    if (!aiValue.trim() || busy) return
    onSubmit(aiValue, selection)
  }

  const locLabel = selection.oeid ? selection.oeid.split(':').slice(0, 2).join(':') : 'unknown'

  return (
    <div
      className={styles.popover}
      style={{ top: pos.top, left: pos.left, width: SIZE.width }}
      role="dialog"
      aria-label="Edit selected element"
    >
      <div className={styles.header}>
        <span className={styles.tag}>&lt;{selection.tag}&gt;</span>
        <span className={styles.loc}>{locLabel}</span>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {hasText && (
        <div className={styles.section}>
          <label className={styles.label} htmlFor="oe-text">
            Text <span className={styles.badge}>instant</span>
          </label>
          <input
            id="oe-text"
            className={styles.textInput}
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submitText()
              }
            }}
          />
          <button
            className={styles.textBtn}
            onClick={submitText}
            disabled={!textChanged || busy}
          >
            Update text
          </button>
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.label}>Ask AI</span>
        <div className={styles.chips}>
          {CHIPS.map((c) => (
            <button
              key={c.label}
              className={styles.chip}
              onClick={() => {
                setAiValue(c.seed)
                aiRef.current?.focus()
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <textarea
          ref={aiRef}
          className={styles.input}
          value={aiValue}
          placeholder="Describe a change…"
          onChange={(e) => setAiValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitAi()
            }
          }}
        />
        <button className={styles.apply} onClick={submitAi} disabled={!aiValue.trim() || busy}>
          {busy ? 'Applying…' : 'Apply with AI'}
        </button>
      </div>
    </div>
  )
}
