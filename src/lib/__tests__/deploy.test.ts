import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

vi.stubGlobal('fetch', fetchMock)

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    },
  },
}))

describe('deploySite', () => {
  beforeEach(() => {
    vi.resetModules()
    fetchMock.mockReset()
  })

  it('posts deploy requests to the same-origin deploy endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteId: 'ot-abc12345-xyz123',
        url: 'https://ot-abc12345-xyz123.pages.dev',
      }),
    })

    const { deploySite } = await import('../deploy')
    const result = await deploySite('project-12345678', '<!doctype html><html>OpenThorn</html>')

    expect(result).toEqual({
      siteId: 'ot-abc12345-xyz123',
      url: 'https://ot-abc12345-xyz123.pages.dev',
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        projectId: 'project-12345678',
        html: '<!doctype html><html>OpenThorn</html>',
      }),
    })
  })

  it('reuses an existing CF Pages project when one is saved', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        siteId: 'ot-existing-abc',
        url: 'https://ot-existing-abc.pages.dev',
      }),
    })

    const { deploySite } = await import('../deploy')
    const result = await deploySite('project-1', '<html></html>', 'ot-existing-abc')

    expect(result).toEqual({
      siteId: 'ot-existing-abc',
      url: 'https://ot-existing-abc.pages.dev',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({
        projectId: 'project-1',
        html: '<html></html>',
        existingSiteId: 'ot-existing-abc',
      }),
    })
  })
})
