import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const USER_ID = '11111111-1111-4111-8111-111111111111'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

describe('admin server helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('isAdminUser returns true when the profile row has is_admin', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ is_admin: true }]))
    const { isAdminUser } = await import('../../../api/_shared')
    await expect(isAdminUser(USER_ID)).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain(`/rest/v1/profiles?id=eq.${USER_ID}`)
    expect(init.headers.Authorization).toBe('Bearer service-key')
  })

  it('isAdminUser returns false on non-admin, error, or missing service key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ is_admin: false }]))
    const shared = await import('../../../api/_shared')
    await expect(shared.isAdminUser(USER_ID)).resolves.toBe(false)

    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    await expect(shared.isAdminUser(USER_ID)).resolves.toBe(false)
  })

  it('adminSetUserSuspended bans via the auth admin API and mirrors the flag', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminSetUserSuspended } = await import('../../../api/_shared')
    await adminSetUserSuspended(USER_ID, true)

    const calls = fetchMock.mock.calls.map(([u]) => String(u))
    expect(calls[0]).toBe(`https://test.supabase.co/auth/v1/admin/users/${USER_ID}`)
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ban_duration: '876000h' })
    expect(calls[1]).toContain(`/rest/v1/profiles?id=eq.${USER_ID}`)
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ suspended: true })
  })

  it('adminSetUserSuspended(false) lifts the ban', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminSetUserSuspended } = await import('../../../api/_shared')
    await adminSetUserSuspended(USER_ID, false)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ban_duration: 'none' })
  })

  it('adminDeleteUser deletes via the auth admin API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}))
    const { adminDeleteUser } = await import('../../../api/_shared')
    await adminDeleteUser(USER_ID)
    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://test.supabase.co/auth/v1/admin/users/${USER_ID}`)
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })

  it('admin mutations throw when the auth admin API errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'nope' }, false, 500))
    const { adminDeleteUser } = await import('../../../api/_shared')
    await expect(adminDeleteUser(USER_ID)).rejects.toThrow()
  })

  it('triggerDeploy posts to the configured hook and throws without it', async () => {
    const shared = await import('../../../api/_shared')

    delete process.env.VERCEL_DEPLOY_HOOK_URL
    await expect(shared.triggerDeploy()).rejects.toThrow()

    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc'
    fetchMock.mockResolvedValueOnce(jsonResponse({ job: { id: 'j1' } }))
    await shared.triggerDeploy()
    const last = fetchMock.mock.calls[fetchMock.mock.calls.length - 1]
    expect(String(last[0])).toBe('https://api.vercel.com/v1/integrations/deploy/abc')
    expect(last[1].method).toBe('POST')
  })
})
