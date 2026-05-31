import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Hoist mock data so it's available to hoisted vi.mock factories
const mockFiles = vi.hoisted(() => [
  {
    path: 'index.html',
    content: `<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
    lastModified: 1,
  },
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'test',
      dependencies: { react: '^19.2.0', 'react-dom': '^19.2.0' },
    }),
    lastModified: 1,
  },
  {
    path: 'src/main.tsx',
    content: `import { createRoot } from 'react-dom/client'; import App from './App'; createRoot(document.getElementById('root')!).render(<App/>)`,
    lastModified: 1,
  },
  {
    path: 'src/App.tsx',
    content: `export default function App() { return <div>Hello</div> }`,
    lastModified: 1,
  },
])

// Mock capabilities — transpiler path
vi.mock('../../../lib/capabilities', () => ({
  detectCapability: vi.fn().mockReturnValue('transpiler'),
}))

// Mock the webcontainer module (should not be called in transpiler path)
vi.mock('../../../lib/webcontainer', () => ({
  boot: vi.fn(),
  ensureRunning: vi.fn(),
  subscribeWcState: vi.fn().mockReturnValue(() => {}),
  getWcState: vi.fn().mockReturnValue({
    phase: 'booting' as const,
    url: null,
    error: null,
    installOutput: '',
    serverOutput: '',
  }),
}))

// Mock the workspace module
vi.mock('../../../lib/workspace', () => ({
  getWorkspace: vi.fn().mockReturnValue({
    files: mockFiles,
    buildResult: null,
    previewUrl: null,
  }),
  subscribeToWorkspace: vi.fn().mockReturnValue(() => {}),
}))

import PreviewFrame from '../PreviewFrame'

describe('PreviewFrame', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const { container } = render(<PreviewFrame device="pc" />)
    expect(container.querySelector('iframe')).toBeTruthy()
  })

  it('shows iframe with sandbox attributes', () => {
    render(<PreviewFrame device="pc" />)
    const iframe = screen.getByTitle('Website preview')
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts')
  })

  it('uses srcDoc in transpiler mode', () => {
    render(<PreviewFrame device="pc" />)
    const iframe = screen.getByTitle('Website preview')
    // In transpiler mode, should have srcDoc set
    expect(iframe.getAttribute('srcDoc')).toBeTruthy()
    expect((iframe.getAttribute('srcDoc') ?? '').length).toBeGreaterThan(50)
  })

  it('renders with phone device width', () => {
    const { container } = render(<PreviewFrame device="phone" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).toContain('framed')
  })

  it('renders without frame in pc mode', () => {
    const { container } = render(<PreviewFrame device="pc" />)
    const wrapper = container.firstElementChild!
    expect(wrapper.className).not.toContain('framed')
  })

  it('renders device frame chrome in phone mode', () => {
    const { container } = render(<PreviewFrame device="phone" />)
    expect(container.textContent).toContain('localhost')
  })
})
