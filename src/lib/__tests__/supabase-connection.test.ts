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

describe('oauth token exchange', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_OAUTH_CLIENT_ID = 'cid'
    process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'csecret'
  })

  it('exchangeOAuthCode posts the authorization_code grant with basic auth', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 86400 }),
    )
    const { exchangeOAuthCode } = await import('../../../api/_supabase')
    const tok = await exchangeOAuthCode('the-code', 'https://app/cb')
    expect(tok).toEqual({ accessToken: 'at', refreshToken: 'rt', expiresIn: 86400 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('https://api.supabase.com/v1/oauth/token')
    expect(init.headers.Authorization).toBe('Basic ' + Buffer.from('cid:csecret').toString('base64'))
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('the-code')
    expect(body.get('redirect_uri')).toBe('https://app/cb')
  })

  it('refreshOAuthToken posts the refresh_token grant', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ access_token: 'at2', refresh_token: 'rt2', expires_in: 86400 }),
    )
    const { refreshOAuthToken } = await import('../../../api/_supabase')
    const tok = await refreshOAuthToken('old-rt')
    expect(tok.accessToken).toBe('at2')
    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('old-rt')
  })

  it('exchangeOAuthCode throws on a non-OK response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, false, 400))
    const { exchangeOAuthCode } = await import('../../../api/_supabase')
    await expect(exchangeOAuthCode('x', 'y')).rejects.toThrow()
  })
})
