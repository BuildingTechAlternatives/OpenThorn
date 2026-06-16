import { useEffect, useRef, useState } from 'react'
import type { EditSelection } from '../../lib/preview-edit'
import { anchorPopover } from '../../lib/preview-edit'
import styles from './PreviewEditPopover.module.css'

const CHIPS: { label: string; seed: (s: EditSelection) => string }[] = [
  { label: 'Edit text', seed: (s) => `Change the text to: ${s.text}` },
  { label: 'Restyle', seed: () => 'Restyle this element: ' },
  { label: 'Spacing', seed: () => 'Adjust the spacing/padding of this element: ' },
  { label: 'Delete', seed: () => 'Remove this element.' },
]

interface Props {
  selection: EditSelection
  /** Offset of the iframe within the page, in CSS px. */
  frameOffset: { top: number; left: number }
  busy: boolean
  onSubmit: (instruction: string, selection: EditSelection) => void
  onClose: () => void
}

const SIZE = { width: 300, height: 190 }

export default function PreviewEditPopover({
  selection,
  frameOffset,
  busy,
  onSubmit,
  onClose,
}: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [selection])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

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

  const submit = () => {
    if (!text.trim() || busy) return
    onSubmit(text, selection)
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
      <div className={styles.chips}>
        {CHIPS.map((c) => (
          <button
            key={c.label}
            className={styles.chip}
            onClick={() => {
              setText(c.seed(selection))
              inputRef.current?.focus()
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        ref={inputRef}
        className={styles.input}
        value={text}
        placeholder="Describe the change…"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <button className={styles.apply} onClick={submit} disabled={!text.trim() || busy}>
        {busy ? 'Applying…' : 'Apply change'}
      </button>
    </div>
  )
}
