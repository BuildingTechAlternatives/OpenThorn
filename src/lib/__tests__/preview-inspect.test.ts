import { describe, it, expect } from 'vitest'
import {
  parseCssColor,
  compositeOver,
  relativeLuminance,
  contrastRatio,
  contrastThreshold,
  formatInspectReport,
  dedupeIssues,
  inspectPreview,
  type InspectIssue,
  type InspectResult,
} from '../preview-inspect'

describe('parseCssColor', () => {
  it('parses rgb()', () => {
    expect(parseCssColor('rgb(255, 0, 128)')).toEqual({ r: 255, g: 0, b: 128, a: 1 })
  })

  it('parses rgba() with decimal alpha', () => {
    expect(parseCssColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
  })

  it('parses space/slash modern syntax', () => {
    expect(parseCssColor('rgb(10 20 30 / 50%)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 })
  })

  it('treats transparent as fully transparent black', () => {
    expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('returns null for gradients / unknown', () => {
    expect(parseCssColor('linear-gradient(red, blue)')).toBeNull()
    expect(parseCssColor('')).toBeNull()
    expect(parseCssColor('hotpink')).toBeNull()
  })
})

describe('compositeOver', () => {
  it('returns the foreground when fully opaque', () => {
    const fg = { r: 10, g: 20, b: 30, a: 1 }
    expect(compositeOver(fg, { r: 255, g: 255, b: 255, a: 1 })).toEqual({ ...fg })
  })

  it('blends a half-transparent black over white to grey', () => {
    const out = compositeOver({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 })
    expect(out).toEqual({ r: 128, g: 128, b: 128, a: 1 })
  })
})

describe('contrast math', () => {
  const black = { r: 0, g: 0, b: 0, a: 1 }
  const white = { r: 255, g: 255, b: 255, a: 1 }

  it('black on white is 21:1', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 0)
  })

  it('identical colours are 1:1', () => {
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5)
  })

  it('luminance of white is 1 and black is 0', () => {
    expect(relativeLuminance(white)).toBeCloseTo(1, 5)
    expect(relativeLuminance(black)).toBeCloseTo(0, 5)
  })

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(contrastRatio(white, black), 5)
  })

  it('flags a typical light-grey-on-white body text as failing 4.5:1', () => {
    const grey = { r: 170, g: 170, b: 170, a: 1 }
    expect(contrastRatio(grey, white)).toBeLessThan(4.5)
  })
})

describe('contrastThreshold', () => {
  it('requires 4.5 for normal body text', () => {
    expect(contrastThreshold(16, 400)).toBe(4.5)
  })

  it('requires only 3 for large text (>=24px)', () => {
    expect(contrastThreshold(32, 400)).toBe(3)
  })

  it('requires only 3 for bold 18.66px+ text', () => {
    expect(contrastThreshold(19, 700)).toBe(3)
    expect(contrastThreshold(19, 400)).toBe(4.5) // not bold → still 4.5
  })
})

describe('dedupeIssues', () => {
  it('removes duplicate (type, selector, message) keeping the first', () => {
    const issues: InspectIssue[] = [
      { type: 'overflow', severity: 'error', message: 'spills', selector: 'div.hero', viewport: 'mobile (390px)' },
      { type: 'overflow', severity: 'error', message: 'spills', selector: 'div.hero', viewport: 'desktop (1280px)' },
      { type: 'contrast', severity: 'warning', message: 'low', selector: 'p', viewport: 'mobile (390px)' },
    ]
    const out = dedupeIssues(issues)
    expect(out).toHaveLength(2)
    expect(out[0].viewport).toBe('mobile (390px)')
  })
})

describe('formatInspectReport', () => {
  const base: InspectResult = {
    ran: true,
    rendered: true,
    viewports: ['mobile (390px)', 'desktop (1280px)'],
    issues: [],
    summary: { elements: 50, buttons: 3, links: 5, inputs: 1, headings: 4, imagesWithoutAlt: 0 },
    consoleErrors: [],
  }

  it('returns null when the run did not run', () => {
    expect(formatInspectReport({ ...base, ran: false })).toBeNull()
  })

  it('returns null on a fully clean run', () => {
    expect(formatInspectReport(base)).toBeNull()
  })

  it('reports that nothing rendered', () => {
    const out = formatInspectReport({ ...base, rendered: false })
    expect(out).toContain('no visible content')
  })

  it('groups issues by type and marks errors as PROBLEM', () => {
    const out = formatInspectReport({
      ...base,
      issues: [
        { type: 'overflow', severity: 'error', message: 'Extends 120px past the right edge', selector: 'div.hero', viewport: 'mobile (390px)' },
        { type: 'contrast', severity: 'warning', message: 'Contrast 2.10:1 (needs 4.5:1)', selector: 'p.sub', viewport: 'desktop (1280px)' },
      ],
    })
    expect(out).toContain('[PROBLEM]')
    expect(out).toContain('Horizontal overflow')
    expect(out).toContain('120px past the right edge')
    expect(out).toContain('(div.hero)')
    expect(out).toContain('@ mobile (390px)')
    expect(out).toContain('[check]')
    expect(out).toContain('Low text contrast')
  })

  it('surfaces console errors', () => {
    const out = formatInspectReport({ ...base, consoleErrors: ['Warning: bad thing'] })
    expect(out).toContain('Console errors')
    expect(out).toContain('bad thing')
  })

  it('caps the number of issues shown per type', () => {
    const many: InspectIssue[] = Array.from({ length: 15 }, (_, i) => ({
      type: 'tap-target' as const,
      severity: 'warning' as const,
      message: `tiny ${i}`,
      selector: `button.b${i}`,
    }))
    const out = formatInspectReport({ ...base, issues: many })!
    expect(out).toContain('... and 7 more')
  })
})

describe('inspectPreview without a DOM', () => {
  it('returns ran:false gracefully in node', async () => {
    const result = await inspectPreview('<html><body></body></html>')
    expect(result.ran).toBe(false)
    expect(result.issues).toEqual([])
  })
})
