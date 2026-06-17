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

describe('connection persistence', () => {
  const USER = '11111111-1111-4111-8111-111111111111'
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.KEY_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-test'
    process.env.SUPABASE_OAUTH_CLIENT_ID = 'cid'
    process.env.SUPABASE_OAUTH_CLIENT_SECRET = 'csecret'
    process.env.SUPABASE_URL = 'https://openthorn.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('storeConnection upserts encrypted tokens via the service role', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const { storeConnection } = await import('../../../api/_supabase')
    await storeConnection(USER, {
      orgId: 'org_1',
      tokens: { accessToken: 'AT', refreshToken: 'RT', expiresIn: 86400 },
      scopes: 'all',
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/supabase_connections')
    expect(init.headers.Authorization).toBe('Bearer service-key')
    const row = JSON.parse(init.body as string)
    expect(row.user_id).toBe(USER)
    expect(row.org_id).toBe('org_1')
    expect(row.access_token_enc).not.toContain('AT')
    expect(row.access_token_enc.startsWith('senc:')).toBe(true)
  })

  it('getValidAccessToken returns the stored token when not expired', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const future = new Date(Date.now() + 3600_000).toISOString()
    fetchMock.mockResolvedValueOnce(jsonResponse([{
      org_id: 'org_1',
      access_token_enc: encryptForUser('AT', USER),
      refresh_token_enc: encryptForUser('RT', USER),
      expires_at: future,
    }]))
    const { getValidAccessToken } = await import('../../../api/_supabase')
    await expect(getValidAccessToken(USER)).resolves.toBe('AT')
  })

  it('getValidAccessToken refreshes + re-persists when expired', async () => {
    const { encryptForUser } = await import('../../../api/_shared')
    const past = new Date(Date.now() - 1000).toISOString()
    fetchMock
      .mockResolvedValueOnce(jsonResponse([{
        org_id: 'org_1',
        access_token_enc: encryptForUser('OLD', USER),
        refresh_token_enc: encryptForUser('RT', USER),
        expires_at: past,
      }]))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'NEW', refresh_token: 'RT2', expires_in: 86400 }))
      .mockResolvedValueOnce(jsonResponse({}))
    const { getValidAccessToken } = await import('../../../api/_supabase')
    await expect(getValidAccessToken(USER)).resolves.toBe('NEW')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://api.supabase.com/v1/oauth/token')
  })
})

describe('management api', () => {
  const USER = '11111111-1111-4111-8111-111111111111'
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://openthorn.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('listOrgProjects maps the Management API response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([
      { id: 'ref1', name: 'App One', organization_id: 'org_1', region: 'us-east-1', status: 'ACTIVE_HEALTHY' },
    ]))
    const { listOrgProjects } = await import('../../../api/_supabase')
    const projects = await listOrgProjects('AT')
    expect(projects[0]).toEqual({ ref: 'ref1', name: 'App One', orgId: 'org_1', region: 'us-east-1', status: 'ACTIVE_HEALTHY' })
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer AT')
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://api.supabase.com/v1/projects')
  })

  it('getProjectConnectionInfo returns url + legacy anon key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([
      { name: 'anon', api_key: 'anon-xyz' },
      { name: 'service_role', api_key: 'secret-should-be-ignored' },
    ]))
    const { getProjectConnectionInfo } = await import('../../../api/_supabase')
    const info = await getProjectConnectionInfo('AT', 'ref1')
    expect(info).toEqual({ supabaseUrl: 'https://ref1.supabase.co', anonKey: 'anon-xyz' })
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api-keys?reveal=true')
  })

  it('getProjectConnectionInfo prefers the new publishable key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([
      { name: 'sb_secret', type: 'secret', api_key: 'sb_secret_xxx' },
      { name: 'default', type: 'publishable', api_key: 'sb_publishable_abc' },
    ]))
    const { getProjectConnectionInfo } = await import('../../../api/_supabase')
    const info = await getProjectConnectionInfo('AT', 'ref1')
    expect(info.anonKey).toBe('sb_publishable_abc')
  })

  it('getProjectConnectionInfo throws a clear error when no client key exists', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'sb_secret', type: 'secret', api_key: 'x' }]))
    const { getProjectConnectionInfo } = await import('../../../api/_supabase')
    await expect(getProjectConnectionInfo('AT', 'ref1')).rejects.toThrow(/publishable\/anon/)
  })

  it('saveProjectBackend upserts the public connection row', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))
    const { saveProjectBackend } = await import('../../../api/_supabase')
    await saveProjectBackend(USER, 'proj-9', 'ref1', { supabaseUrl: 'https://ref1.supabase.co', anonKey: 'anon-xyz' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/rest/v1/project_backends')
    const row = JSON.parse(init.body as string)
    expect(row).toEqual(expect.objectContaining({
      project_id: 'proj-9', user_id: USER, project_ref: 'ref1',
      supabase_url: 'https://ref1.supabase.co', supabase_anon_key: 'anon-xyz',
    }))
  })
})

describe('backend-connection client', () => {
  beforeEach(() => { vi.resetModules(); fetchMock.mockReset() })

  it('pickProject POSTs the chosen ref with the auth token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, supabaseUrl: 'https://ref1.supabase.co' }))
    const { pickProject } = await import('../backend-connection')
    const out = await pickProject('tok', 'proj-9', 'ref1')
    expect(out.supabaseUrl).toBe('https://ref1.supabase.co')
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/supabase-oauth')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string)).toEqual({ action: 'pick-project', projectId: 'proj-9', ref: 'ref1' })
  })

  it('authorizeUrl encodes token + projectId into the start URL', async () => {
    const { authorizeUrl } = await import('../backend-connection')
    const out = authorizeUrl('to ken', 'proj 9')
    expect(out.startsWith('/api/supabase-oauth?')).toBe(true)
    const q = new URLSearchParams(out.split('?')[1])
    expect(q.get('action')).toBe('start')
    expect(q.get('token')).toBe('to ken')
    expect(q.get('projectId')).toBe('proj 9')
  })

  it('pickProject throws the server error message on failure', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'No Supabase connection' }, false, 400))
    const { pickProject } = await import('../backend-connection')
    await expect(pickProject('tok', 'p', 'r')).rejects.toThrow('No Supabase connection')
  })
})
