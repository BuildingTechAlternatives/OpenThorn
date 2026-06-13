import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) }
}

interface FakeRes {
  statusCode: number
  body: unknown
  status: (code: number) => FakeRes
  json: (body: unknown) => void
}

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res },
    json(body: unknown) { res.body = body },
  }
  return res
}

function makeReq(body: unknown, method = 'POST') {
  return { method, headers: { authorization: 'Bearer caller-token' }, body }
}

/** fetch stub: caller-token resolves to ADMIN_ID; admin check configurable. */
function stubFetch({ callerIsAdmin }: { callerIsAdmin: boolean }) {
  fetchMock.mockImplementation(async (url: unknown) => {
    const u = String(url)
    if (u.includes('/auth/v1/user')) return jsonResponse({ id: ADMIN_ID, email: 'admin@test.dev' })
    if (u.includes(`/rest/v1/profiles?id=eq.${ADMIN_ID}`)) return jsonResponse([{ is_admin: callerIsAdmin }])
    if (u.includes('/auth/v1/admin/users/')) return jsonResponse({})
    if (u.includes('/rest/v1/profiles?id=eq.')) return jsonResponse([])
    return jsonResponse({ error: 'unexpected' }, false, 404)
  })
}

describe('api/admin handler', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  it('rejects non-POST', async () => {
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({}, 'GET'), res)
    expect(res.statusCode).toBe(405)
  })

  it('rejects missing/invalid auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false, 401))
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler({ method: 'POST', headers: {}, body: { action: 'delete-user', userId: TARGET_ID } }, res)
    expect(res.statusCode).toBe(401)
  })

  it('rejects callers who are not admins', async () => {
    stubFetch({ callerIsAdmin: false })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(403)
  })

  it('rejects unknown actions and bad user ids', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')

    const res1 = makeRes()
    await handler(makeReq({ action: 'nuke-everything', userId: TARGET_ID }), res1)
    expect(res1.statusCode).toBe(400)

    const res2 = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: 'not-a-uuid' }), res2)
    expect(res2.statusCode).toBe(400)
  })

  it('rejects acting on yourself', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: ADMIN_ID }), res)
    expect(res.statusCode).toBe(400)
  })

  it('suspend-user bans the target via the auth admin API', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'suspend-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    const adminCall = fetchMock.mock.calls.find(([u]) => String(u).includes(`/auth/v1/admin/users/${TARGET_ID}`))
    expect(adminCall).toBeDefined()
    expect(adminCall![1].method).toBe('PUT')
  })

  it('delete-user deletes the target via the auth admin API', async () => {
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(200)
    const adminCall = fetchMock.mock.calls.find(
      ([u, init]) => String(u).includes(`/auth/v1/admin/users/${TARGET_ID}`) && init.method === 'DELETE',
    )
    expect(adminCall).toBeDefined()
  })

  it('returns 503 when the service role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    stubFetch({ callerIsAdmin: true })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'delete-user', userId: TARGET_ID }), res)
    expect(res.statusCode).toBe(503)
  })

  it('trigger-deploy fires the hook for an admin (no userId required)', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc'
    fetchMock.mockImplementation(async (url: unknown) => {
      const u = String(url)
      if (u.includes('/auth/v1/user')) return jsonResponse({ id: ADMIN_ID, email: 'a@test.dev' })
      if (u.includes(`/rest/v1/profiles?id=eq.${ADMIN_ID}`)) return jsonResponse([{ is_admin: true }])
      if (u.startsWith('https://api.vercel.com/')) return jsonResponse({ job: { id: 'j' } })
      return jsonResponse({ error: 'unexpected' }, false, 404)
    })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'trigger-deploy' }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true })
    const hookCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith('https://api.vercel.com/'))
    expect(hookCall).toBeDefined()
  })

  it('trigger-deploy is rejected for non-admins', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.com/v1/integrations/deploy/abc'
    stubFetch({ callerIsAdmin: false })
    const { default: handler } = await import('../../../api/admin')
    const res = makeRes()
    await handler(makeReq({ action: 'trigger-deploy' }), res)
    expect(res.statusCode).toBe(403)
  })
})
