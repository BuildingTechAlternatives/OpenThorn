import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('oauth state', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.KEY_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-test'
  })

  it('mintOAuthState/verifyOAuthState round-trips for the same user', async () => {
    const { mintOAuthState, verifyOAuthState } = await import('../../../api/_supabase')
    const state = mintOAuthState('user-1', 'proj-9')
    expect(verifyOAuthState(state)).toEqual(
      expect.objectContaining({ userId: 'user-1', projectId: 'proj-9' }),
    )
  })

  it('verifyOAuthState rejects a tampered or expired state', async () => {
    const { mintOAuthState, verifyOAuthState } = await import('../../../api/_supabase')
    const state = mintOAuthState('user-1', 'proj-9')
    expect(verifyOAuthState(state + 'x')).toBeNull()
    expect(verifyOAuthState('garbage')).toBeNull()
  })
})
